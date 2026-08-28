"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GradeCard, type GradeView } from "./GradeCard";
import { readSseStream } from "@/lib/client/sse";
import { useVoiceSession, type SpokenTurnPayload } from "@/lib/voice/useVoiceSession";

export type LearnFixitView = {
  id: string;
  concept: string;
  subtopicName: string;
  areaName: string;
  status: string;
  attempts: number;
  checkStage: number;
  gaps: string[];
  corrections: string[];
  nextCheckAt: number | null;
  dueForCheck: boolean;
};

export type LearnQuestionView = {
  id: string;
  promptText: string;
  setupFactsJson: string[];
  difficulty: number;
};

export type LearnChatTurn = {
  id: string;
  role: "coach" | "you" | "system";
  content: string;
};

export type LearnInitialState = {
  fixit: LearnFixitView;
  /** The missed question, for the context card. */
  sourceQuestion: { promptText: string; setupFacts: string[] } | null;
  kind: "lesson" | "spotcheck";
  /** Resumable lesson state, if any. */
  resume: {
    sessionId: string;
    anchorQuestionId: string;
    turns: LearnChatTurn[];
    activeProof: LearnQuestionView | null;
  } | null;
  proofTarget: number;
  voiceAvailable: boolean;
  voiceFake: boolean;
};

type Phase = "starting" | "lesson" | "proving" | "closed" | "error";

export function LearnRunner({ initial }: { initial: LearnInitialState }) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [fixit, setFixit] = useState(initial.fixit);
  const [sessionId, setSessionId] = useState<string | null>(initial.resume?.sessionId ?? null);
  const [chat, setChat] = useState<LearnChatTurn[]>(initial.resume?.turns ?? []);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [coachSaysReady, setCoachSaysReady] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Proving state
  const [proof, setProof] = useState<LearnQuestionView | null>(initial.resume?.activeProof ?? null);
  const [proofTurns, setProofTurns] = useState<{ role: string; content: string }[]>([]);
  const [proofAnswer, setProofAnswer] = useState("");
  const [proofStreaming, setProofStreaming] = useState<string | null>(null);
  const [proofGrade, setProofGrade] = useState<GradeView | null>(null);
  const [passes, setPasses] = useState(0);
  const [lastProofFailed, setLastProofFailed] = useState(false);

  const [voiceOn, setVoiceOn] = useState(false);
  const startedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<Phase>("starting");
  const sessionIdRef = useRef<string | null>(initial.resume?.sessionId ?? null);
  const proofRef = useRef<LearnQuestionView | null>(initial.resume?.activeProof ?? null);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  useEffect(() => {
    proofRef.current = proof;
  }, [proof]);

  const voice = useVoiceSession({
    enabled: voiceOn,
    fake: initial.voiceFake,
    sessionId: sessionId ?? "",
    personaId: "coach",
    interruptionsEnabled: false,
    onTurn: (turn) => void handleSpokenTurn(turn),
    onError: () => setVoiceOn(false),
  });
  const voiceRef = useRef(voice);
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  async function handleSpokenTurn(turn: SpokenTurnPayload) {
    const sid = sessionIdRef.current;
    if (!sid) return;
    if (phaseRef.current === "lesson") {
      await runCoachTurn(sid, turn.transcript);
    } else if (phaseRef.current === "proving" && proofRef.current) {
      await submitProofCore(turn.transcript, turn.voice);
    }
  }

  async function toggleVoice() {
    if (voiceOn) {
      voiceRef.current.endListening();
      voiceRef.current.disconnect();
      setVoiceOn(false);
      return;
    }
    const sid = sessionIdRef.current;
    try {
      if (sid && initial.kind === "lesson") {
        await fetch(`/api/fixits/${initial.fixit.id}/lesson`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voice: true }),
        });
      }
      setVoiceOn(true);
      await voiceRef.current.connect();
      if (phaseRef.current === "lesson" || phaseRef.current === "proving") {
        voiceRef.current.beginListening();
      }
    } catch {
      setVoiceOn(false);
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat, streamingText]);

  // Bootstrap on mount.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      try {
        if (initial.kind === "spotcheck") {
          const res = await fetch(`/api/fixits/${initial.fixit.id}/spotcheck`, { method: "POST" });
          if (!res.ok) throw new Error((await res.json()).error ?? "Could not start the spot-check");
          const body = (await res.json()) as { sessionId: string; question: LearnQuestionView };
          setSessionId(body.sessionId);
          setProof(body.question);
          setPhase("proving");
          return;
        }
        // Lesson
        const res = await fetch(`/api/fixits/${initial.fixit.id}/lesson`, { method: "POST" });
        if (!res.ok) throw new Error((await res.json()).error ?? "Could not start the lesson");
        const body = (await res.json()) as { sessionId: string };
        setSessionId(body.sessionId);
        if (initial.resume?.activeProof) {
          setPhase("proving");
          return;
        }
        setPhase("lesson");
        if ((initial.resume?.turns.length ?? 0) === 0) {
          await runCoachTurn(body.sessionId, null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start");
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runCoachTurn(sid: string, text: string | null) {
    setBusy(true);
    if (text) {
      setChat((c) => [...c, { id: `you-${Date.now()}`, role: "you", content: text }]);
    }
    setStreamingText("");
    try {
      const res = await fetch(`/api/learn/${sid}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) {
        throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Coach unavailable");
      }
      let spoken = "";
      let action = "coach";
      await readSseStream(res, {
        onDelta: (t) => {
          spoken += t;
          setStreamingText(spoken);
          if (voiceOn) voiceRef.current.speakDelta(t);
        },
        onDone: (d) => {
          action = d.action;
        },
      });
      setChat((c) => [...c, { id: `coach-${Date.now()}`, role: "coach", content: spoken }]);
      setStreamingText(null);
      if (action === "check") setCoachSaysReady(true);
      if (voiceOn) {
        await voiceRef.current.speakFlush();
        voiceRef.current.beginListening();
      }
    } catch (err) {
      setStreamingText(null);
      setError(err instanceof Error ? err.message : "Coach turn failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!sessionId || message.trim().length === 0 || busy) return;
    const text = message.trim();
    setMessage("");
    await runCoachTurn(sessionId, text);
  }

  async function startCheck() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/next`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not get a check question");
      const body = (await res.json()) as { done: boolean; question?: LearnQuestionView };
      if (body.done || !body.question) {
        await refreshFixit();
        setPhase("closed");
        return;
      }
      setProof(body.question);
      setProofTurns([]);
      setProofAnswer("");
      setProofGrade(null);
      setLastProofFailed(false);
      setPhase("proving");
      if (voiceOn) voiceRef.current.beginListening();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start the check");
    } finally {
      setBusy(false);
    }
  }

  async function submitProofAnswer() {
    if (proofAnswer.trim().length === 0 || busy) return;
    const submitted = proofAnswer.trim();
    setProofAnswer("");
    await submitProofCore(submitted, null);
  }

  async function submitProofCore(submitted: string, voicePayload: SpokenTurnPayload["voice"] | null) {
    const sid = sessionIdRef.current;
    const q = proofRef.current;
    if (!sid || !q) return;
    setProofTurns((t) => [...t, { role: "you", content: submitted }]);
    setBusy(true);
    setProofStreaming("");
    try {
      const res = await fetch(`/api/sessions/${sid}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q.id, answer: submitted, voice: voicePayload }),
      });
      if (!res.ok || !res.body) {
        throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Failed to submit");
      }
      let spoken = "";
      let action = "wrapup";
      await readSseStream(res, {
        onDelta: (t) => {
          spoken += t;
          setProofStreaming(spoken);
          if (voiceOn) voiceRef.current.speakDelta(t);
        },
        onDone: (d) => {
          action = d.action;
        },
      });
      setProofTurns((t) => [...t, { role: "interviewer", content: spoken }]);
      setProofStreaming(null);
      if (voiceOn) await voiceRef.current.speakFlush();
      if (action === "wrapup") {
        await gradeProof(q.id);
      } else if (voiceOn) {
        voiceRef.current.beginListening();
      }
    } catch (err) {
      setProofStreaming(null);
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  async function gradeProof(questionId: string) {
    const res = await fetch(`/api/sessions/${sessionId}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Grading failed");
    const body = (await res.json()) as { grade: GradeView };
    setProofGrade(body.grade);
    const passed = body.grade.overall >= 70;
    setLastProofFailed(!passed);
    if (passed) setPasses((p) => p + 1);
    const updated = await refreshFixit();
    // Spot-checks always close after one grade; lessons close once resolved.
    if (initial.kind === "spotcheck" || updated?.status === "resolved") setPhase("closed");
  }

  async function refreshFixit(): Promise<LearnFixitView | null> {
    const res = await fetch(`/api/fixits/${initial.fixit.id}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { fixit: LearnFixitView };
    setFixit(body.fixit);
    return body.fixit;
  }

  function backToLesson() {
    setProof(null);
    setProofGrade(null);
    setChat((c) => [
      ...c,
      {
        id: `sys-${Date.now()}`,
        role: "system",
        content: "Check missed — back to the lesson. The coach knows what happened.",
      },
    ]);
    setCoachSaysReady(false);
    setPhase("lesson");
  }

  // ---------- render ----------

  const header = (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
          <Link href="/" className="hover:text-slate-300">
            Dashboard
          </Link>
          <span>/</span>
          <span>{initial.kind === "spotcheck" ? "Spot-check" : "Learn"}</span>
        </div>
        <h1 className="mt-1 text-xl font-semibold text-slate-100">{fixit.concept}</h1>
        <p className="text-sm text-slate-500">
          {fixit.subtopicName} · {fixit.areaName}
          {fixit.attempts > 0 && ` · missed ${fixit.attempts + 1}×`}
        </p>
      </div>
      {initial.voiceAvailable && (phase === "lesson" || phase === "proving") && (
        <button
          onClick={() => void toggleVoice()}
          className={`shrink-0 rounded px-3 py-1.5 text-xs font-semibold ${
            voiceOn
              ? "bg-indigo-600 text-white hover:bg-indigo-500"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          {voiceOn ? "🎙 Voice on" : "🎙 Talk it through"}
        </button>
      )}
    </div>
  );

  const captionsStrip = voiceOn && voice.listening && (
    <div className="mt-3 rounded-lg border border-indigo-500/40 bg-indigo-500/5 p-3 text-sm italic text-slate-300">
      <span className="mr-2 not-italic text-xs uppercase tracking-wide text-indigo-300">
        listening
      </span>
      {voice.captions || "…"}
    </div>
  );

  if (phase === "starting") {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <Spinner label={initial.kind === "spotcheck" ? "Writing your spot-check…" : "Getting the coach…"} />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <p className="text-sm text-rose-400">{error}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-indigo-400 hover:text-indigo-300">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  if (phase === "closed") {
    const cleared = fixit.status === "resolved" && fixit.nextCheckAt === null;
    const reopened = fixit.status === "open";
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        {proofGrade && <GradeCard grade={proofGrade} />}
        <div
          className={`mt-5 rounded-lg border p-5 ${
            reopened
              ? "border-rose-500/40 bg-rose-500/10"
              : "border-emerald-500/40 bg-emerald-500/10"
          }`}
        >
          {reopened ? (
            <>
              <h2 className="font-semibold text-rose-300">Not there yet — it&apos;s back in your queue</h2>
              <p className="mt-1 text-sm text-slate-300">
                The concept reopened with your latest miss as the new starting point.
              </p>
              <Link
                href={`/learn/${fixit.id}`}
                className="mt-3 inline-block rounded bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500"
              >
                Relearn it now →
              </Link>
            </>
          ) : cleared ? (
            <>
              <h2 className="font-semibold text-emerald-300">Cleared for good 🎉</h2>
              <p className="mt-1 text-sm text-slate-300">
                You&apos;ve proven this twice over spaced checks. It&apos;s out of your queue.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-semibold text-emerald-300">
                {initial.kind === "spotcheck" ? "Spot-check passed" : "Proven — nice work"}
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                It&apos;ll resurface for a quick spot-check{" "}
                {fixit.nextCheckAt ? `on ${new Date(fixit.nextCheckAt).toLocaleDateString()}` : "soon"} to make
                sure it stuck.
              </p>
            </>
          )}
        </div>
        <Link href="/" className="mt-5 inline-block text-sm text-indigo-400 hover:text-indigo-300">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  if (phase === "proving" && proof) {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <div className="mb-4 flex items-center justify-between text-sm text-slate-400">
          <span>
            {initial.kind === "spotcheck"
              ? "Spot-check — one question, cold."
              : `Prove it: ${passes}/${initial.proofTarget} passed${passes > 0 ? " in a row" : ""}`}
          </span>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
          <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-100">{proof.promptText}</p>
          {proof.setupFactsJson.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-slate-800 pt-3 text-sm text-slate-400">
              {proof.setupFactsJson.map((f, i) => (
                <li key={i} className="font-mono">
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>

        {proofTurns.length > 0 && (
          <div className="mt-4 space-y-3">
            {proofTurns.map((t, i) => (
              <Bubble key={i} role={t.role === "you" ? "you" : "coach"} label={t.role === "you" ? "You" : "Checker"}>
                {t.content}
              </Bubble>
            ))}
          </div>
        )}
        {proofStreaming !== null && (
          <div className="mt-3">
            <Bubble role="coach" label="Checker">
              {proofStreaming || <Spinner label="thinking" inline />}
            </Bubble>
          </div>
        )}
        {captionsStrip}

        {proofGrade ? (
          <div className="mt-5 space-y-4">
            <GradeCard grade={proofGrade} />
            {lastProofFailed ? (
              <div className="flex gap-3">
                <button
                  onClick={backToLesson}
                  className="flex-1 rounded bg-indigo-600 px-4 py-2.5 text-sm font-semibold hover:bg-indigo-500"
                >
                  Back to the lesson
                </button>
                <button
                  onClick={() => void startCheck()}
                  className="flex-1 rounded bg-slate-800 px-4 py-2.5 text-sm font-semibold hover:bg-slate-700"
                >
                  Try another question
                </button>
              </div>
            ) : (
              <button
                onClick={() => void startCheck()}
                className="w-full rounded bg-indigo-600 px-4 py-2.5 text-sm font-semibold hover:bg-indigo-500"
              >
                {passes >= initial.proofTarget ? "Finish →" : "Next check question →"}
              </button>
            )}
          </div>
        ) : (
          !busy &&
          proofStreaming === null && (
            <div className="mt-4 space-y-3">
              <textarea
                autoFocus
                value={proofAnswer}
                onChange={(e) => setProofAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    void submitProofAnswer();
                  }
                }}
                rows={5}
                placeholder="Answer cold — no notes, no coach. (Cmd/Ctrl+Enter to submit)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={() => void submitProofAnswer()}
                disabled={proofAnswer.trim().length === 0}
                className="rounded bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40"
              >
                Submit answer
              </button>
            </div>
          )
        )}
        {busy && proofStreaming === null && !proofGrade && <Spinner label="Grading…" />}
      </div>
    );
  }

  // lesson phase
  return (
    <div className="mx-auto max-w-3xl">
      {header}

      {initial.sourceQuestion && (
        <details className="mb-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm">
          <summary className="cursor-pointer text-slate-400">The question you missed</summary>
          <p className="mt-2 whitespace-pre-wrap text-slate-200">{initial.sourceQuestion.promptText}</p>
          {initial.sourceQuestion.setupFacts.map((f, i) => (
            <div key={i} className="mt-1 font-mono text-xs text-slate-500">
              {f}
            </div>
          ))}
        </details>
      )}

      <div className="space-y-3">
        {chat.map((t) =>
          t.role === "system" ? (
            <div key={t.id} className="text-center text-xs text-slate-500">
              — {t.content} —
            </div>
          ) : (
            <Bubble key={t.id} role={t.role} label={t.role === "coach" ? "Coach" : "You"}>
              {t.content}
            </Bubble>
          ),
        )}
        {streamingText !== null && (
          <Bubble role="coach" label="Coach">
            {streamingText || <Spinner label="thinking" inline />}
          </Bubble>
        )}
        {captionsStrip}
        <div ref={chatEndRef} />
      </div>

      {coachSaysReady && (
        <button
          onClick={() => void startCheck()}
          disabled={busy}
          className="mt-4 w-full rounded bg-emerald-600 px-4 py-2.5 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-40"
        >
          Start the check — prove it on fresh questions →
        </button>
      )}

      <div className="mt-4 space-y-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
          rows={2}
          disabled={busy}
          placeholder="Reply to the coach, or ask anything… (Enter to send)"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between">
          <button
            onClick={() => void sendMessage()}
            disabled={busy || message.trim().length === 0}
            className="rounded bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40"
          >
            Send
          </button>
          {!coachSaysReady && (
            <button
              onClick={() => void startCheck()}
              disabled={busy}
              className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40"
            >
              I&apos;m ready — test me
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
    </div>
  );
}

function Bubble({
  role,
  label,
  children,
}: {
  role: string;
  label: string;
  children: React.ReactNode;
}) {
  const isCoach = role === "coach";
  return (
    <div className={`flex ${isCoach ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
          isCoach
            ? "border border-slate-700 bg-slate-800/80 text-slate-200"
            : "border border-indigo-500/30 bg-indigo-500/10 text-slate-100"
        }`}
      >
        <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
        {children}
      </div>
    </div>
  );
}

function Spinner({ label, inline = false }: { label: string; inline?: boolean }) {
  return (
    <span
      className={`${inline ? "inline-flex" : "mt-4 flex justify-center"} items-center gap-2 text-sm text-slate-400`}
    >
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
      {label}
    </span>
  );
}

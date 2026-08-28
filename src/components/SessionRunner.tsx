"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CountdownTimer, CountUpTimer } from "./Timer";
import { GradeCard, type GradeView } from "./GradeCard";
import { TranscriptView, type TurnView } from "./TranscriptView";
import {
  useVoiceSession,
  type InterjectionEvent,
  type SpokenTurnPayload,
} from "@/lib/voice/useVoiceSession";

export type QuestionView = {
  id: string;
  askedIndex: number;
  subtopicId: string;
  difficulty: number;
  promptText: string;
  setupFactsJson: string[];
  answerFormat: string;
  status: string;
  roundId?: string | null;
};

export type SessionView = {
  id: string;
  mode: "drill" | "mock" | "rapid" | "superday";
  status: string;
  configJson: {
    personaId: string | null;
    secondsPerQuestion: number | null;
    questionCount: number;
    rounds: { personaId: string; focusAreaId: string; questionCount: number }[] | null;
    voiceMode?: boolean;
  };
};

export type RunnerInitialState = {
  session: SessionView;
  questions: (QuestionView & { turns: TurnView[] })[];
  activeQuestionId: string | null;
  followUpCap: number;
  areaNames: Record<string, string>;
  personaNames: Record<string, string>;
  subtopicNames: Record<string, string>;
  /** Server says a fake voice transport should be used (VOICE_FAKE=1). */
  voiceFake: boolean;
};

type Phase =
  | "voiceCheck"
  | "interviewerSpeaking"
  | "listening"
  | "answering"
  | "streaming"
  | "grading"
  | "review"
  | "advancing"
  | "roundBreak"
  | "completing"
  | "done"
  | "error";

export function SessionRunner({ initial }: { initial: RunnerInitialState }) {
  const router = useRouter();
  const { session, followUpCap } = initial;
  const mode = session.mode;

  const [question, setQuestion] = useState<QuestionView | null>(() => {
    return initial.questions.find((q) => q.id === initial.activeQuestionId) ?? null;
  });
  const [turns, setTurns] = useState<TurnView[]>(() => {
    const q = initial.questions.find((it) => it.id === initial.activeQuestionId);
    return q?.turns ?? [];
  });
  const [answeredCount, setAnsweredCount] = useState(
    () => initial.questions.filter((q) => q.status !== "active").length,
  );
  const [roundIndex, setRoundIndex] = useState<number | null>(() =>
    initial.session.mode === "superday" && initial.activeQuestionId ? 0 : null,
  );
  const [pendingRound, setPendingRound] = useState<number | null>(null);

  const [voiceActive, setVoiceActive] = useState(session.configJson.voiceMode === true);
  const [phase, setPhase] = useState<Phase>(() => {
    if (!initial.activeQuestionId) return "completing";
    return session.configJson.voiceMode === true ? "voiceCheck" : "answering";
  });
  const [answer, setAnswer] = useState("");
  const [scratchpad, setScratchpad] = useState("");
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [grade, setGrade] = useState<GradeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkHeard, setCheckHeard] = useState(false);

  const answerStartRef = useRef(0);
  const completedRef = useRef(false);
  const phaseRef = useRef<Phase>(phase);
  const questionRef = useRef(question);
  const bargedRef = useRef(false);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    questionRef.current = question;
  }, [question]);
  useEffect(() => {
    if (answerStartRef.current === 0) answerStartRef.current = Date.now();
  }, []);

  const currentPersonaId = useMemo(() => {
    if (mode === "superday" && roundIndex !== null) {
      return session.configJson.rounds?.[roundIndex]?.personaId ?? session.configJson.personaId;
    }
    return session.configJson.personaId;
  }, [mode, roundIndex, session.configJson]);

  const totalQuestions = useMemo(() => {
    if (mode === "superday" && session.configJson.rounds) {
      return session.configJson.rounds.reduce((n, r) => n + r.questionCount, 0);
    }
    return session.configJson.questionCount;
  }, [mode, session.configJson]);

  // ---------- shared session flow (typed + voice) ----------

  async function complete() {
    if (completedRef.current) return;
    completedRef.current = true;
    setPhase("completing");
    try {
      const res = await fetch(`/api/sessions/${session.id}/complete`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to complete session");
      router.push(`/train/${session.id}/debrief`);
    } catch (err) {
      completedRef.current = false;
      setError(err instanceof Error ? err.message : "Failed to complete session");
      setPhase("error");
    }
  }

  const voice = useVoiceSession({
    enabled: voiceActive,
    fake: initial.voiceFake,
    sessionId: session.id,
    personaId: currentPersonaId,
    onTurn: (turn) => void handleSpokenTurn(turn),
    onBargeIn: () => {
      bargedRef.current = true;
      setStreamingText("");
      voiceBeginListening();
    },
    onInterject: (event) => void handleInterjection(event),
    onError: (message) => {
      // Voice failures degrade to typing, never dead-end the session.
      setVoiceActive(false);
      setError(`Voice dropped (${message}) — continuing with typing.`);
      if (phaseRef.current === "listening" || phaseRef.current === "interviewerSpeaking") {
        setPhase("answering");
      }
    },
  });
  const voiceRef = useRef(voice);
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  function voiceBeginListening() {
    voiceRef.current.beginListening();
    answerStartRef.current = Date.now();
    setPhase("listening");
  }

  function resetForQuestion(q: QuestionView) {
    setQuestion(q);
    setTurns([]);
    setAnswer("");
    setScratchpad("");
    setStreamingText("");
    setGrade(null);
    answerStartRef.current = Date.now();
  }

  /** Voice mode: have the interviewer speak the question opening, then listen. */
  async function openQuestion(q: QuestionView) {
      setPhase("interviewerSpeaking");
      bargedRef.current = false;
      voiceRef.current.resetQuestion();
      try {
        const res = await fetch(`/api/sessions/${session.id}/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: q.id }),
        });
        if (!res.ok || !res.body) {
          throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Opening failed");
        }
        let spoken = "";
        await readSseStream(res, {
          onDelta: (text) => {
            spoken += text;
            setStreamingText(spoken);
            voiceRef.current.speakDelta(text);
          },
        });
        setTurns((t) => [
          ...t,
          { id: `local-open-${Date.now()}`, role: "interviewer", content: spoken },
        ]);
        setStreamingText("");
        if (!bargedRef.current) {
          await voiceRef.current.speakFlush();
          voiceBeginListening();
        }
      } catch (err) {
        // Opening failed — fall back to showing the written question + listening.
        setStreamingText("");
        if (voiceActive) voiceBeginListening();
        else {
          setError(err instanceof Error ? err.message : "Opening failed");
          setPhase("answering");
        }
      }
    }

  async function advance() {
    setPhase("advancing");
    try {
      const res = await fetch(`/api/sessions/${session.id}/next`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to get next question");
      const body = (await res.json()) as {
        done: boolean;
        question?: QuestionView;
        roundIndex?: number | null;
      };
      if (body.done || !body.question) {
        await complete();
        return;
      }
      const nextRound = body.roundIndex ?? null;
      if (mode === "superday" && nextRound !== null && nextRound !== roundIndex && roundIndex !== null) {
        setPendingRound(nextRound);
        setRoundIndex(nextRound);
        resetForQuestion(body.question);
        setPhase("roundBreak");
        return;
      }
      setRoundIndex(nextRound);
      resetForQuestion(body.question);
      if (voiceActive) await openQuestion(body.question);
      else setPhase("answering");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to advance");
      setPhase("error");
    }
  }

  async function runGrade(questionId: string, showReview: boolean) {
      voiceRef.current.endListening();
      setPhase("grading");
      try {
        const res = await fetch(`/api/sessions/${session.id}/grade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Grading failed");
        const body = (await res.json()) as { grade: GradeView };
        setAnsweredCount((n) => n + 1);
        if (showReview) {
          setGrade(body.grade);
          setPhase("review");
        } else {
          await advance();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Grading failed");
        setPhase("error");
      }
    }

  async function submitRapid(finalAnswer: string) {
      if (!questionRef.current) return;
      setPhase("advancing");
      try {
        const res = await fetch(`/api/sessions/${session.id}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: questionRef.current.id,
            answer: finalAnswer,
            elapsedMs: Date.now() - answerStartRef.current,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to submit");
        setAnsweredCount((n) => n + 1);
        const stateRes = await fetch(`/api/sessions/${session.id}`);
        const state = (await stateRes.json()) as {
          activeQuestionId: string | null;
          questions: (QuestionView & { turns: TurnView[] })[];
        };
        const next = state.questions.find((q) => q.id === state.activeQuestionId);
        if (!next) {
          await complete();
          return;
        }
        resetForQuestion(next);
        setPhase("answering");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit");
        setPhase("error");
      }
    }

  /** Core submit for drill/mock/superday, shared by typed and spoken paths. */
  async function submitCore(submitted: string,
      extras: { scratchpad?: string | null; voice?: SpokenTurnPayload["voice"] | null },) {
      const q = questionRef.current;
      if (!q) return;
      const candidateTurn: TurnView = {
        id: `local-${Date.now()}`,
        role: "candidate",
        content: submitted,
        scratchpad: extras.scratchpad ?? null,
        elapsedMs: Date.now() - answerStartRef.current,
        interruption: extras.voice?.bargeIn ? "barge_in" : null,
      };
      setTurns((t) => [...t, candidateTurn]);
      setStreamingText("");
      bargedRef.current = false;
      setPhase("streaming");
      try {
        const res = await fetch(`/api/sessions/${session.id}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: q.id,
            answer: submitted,
            scratchpad: extras.scratchpad ?? null,
            elapsedMs: candidateTurn.elapsedMs,
            voice: extras.voice ?? null,
          }),
        });
        if (!res.ok || !res.body) {
          throw new Error(
            res.ok ? "No response stream" : ((await res.json()).error ?? "Failed to submit answer"),
          );
        }
        let spoken = "";
        let done: { action: string } | null = null;
        await readSseStream(res, {
          onDelta: (text) => {
            spoken += text;
            setStreamingText(spoken);
            if (voiceActive) voiceRef.current.speakDelta(text);
          },
          onDone: (d) => {
            done = d;
          },
        });
        setTurns((t) => [
          ...t,
          { id: `local-i-${Date.now()}`, role: "interviewer", content: spoken },
        ]);
        setStreamingText("");
        const action = (done as { action: string } | null)?.action ?? "wrapup";
        if (action === "wrapup") {
          if (voiceActive && !bargedRef.current) await voiceRef.current.speakFlush();
          await runGrade(q.id, mode === "drill");
        } else if (voiceActive) {
          if (!bargedRef.current) {
            await voiceRef.current.speakFlush();
            voiceBeginListening();
          }
          // if she barged in we're already listening
        } else {
          answerStartRef.current = Date.now();
          setPhase("answering");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit answer");
        setPhase("error");
      }
    }

  async function submitTyped() {
    if (answer.trim().length === 0) return;
    if (mode === "rapid") {
      await submitRapid(answer.trim());
      return;
    }
    const submitted = answer.trim();
    setAnswer("");
    await submitCore(submitted, { scratchpad: scratchpad.trim() || null });
  }

  async function handleSpokenTurn(turn: SpokenTurnPayload) {
      if (phaseRef.current === "voiceCheck") {
        setCheckHeard(true);
        return;
      }
      if (phaseRef.current !== "listening") return;
      await submitCore(turn.transcript, { voice: turn.voice });
    }

  async function handleInterjection(event: InterjectionEvent) {
      const q = questionRef.current;
      if (!q) return;
      setTurns((t) => [
        ...t,
        {
          id: `local-cut-${Date.now()}`,
          role: "candidate",
          content: event.partialTranscript || "(cut off)",
          interruption: "cut_off",
        },
        {
          id: `local-ij-${Date.now()}`,
          role: "interviewer",
          content: event.line,
          interruption: "interjection",
        },
      ]);
      try {
        await fetch(`/api/sessions/${session.id}/interject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: q.id,
            answer: event.partialTranscript,
            elapsedMs: event.elapsedMs,
            voice: event.voice,
            trigger: event.trigger,
            interjectionText: event.line,
          }),
        });
      } catch {
        // best-effort; the session continues either way
      }
      voiceBeginListening();
    }

  function onRapidExpire() {
    if (phaseRef.current !== "answering") return;
    void submitRapid(answer.trim() || "(time expired — no answer)");
  }

  function onKeyDown(e: React.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void submitTyped();
      }
    }

  async function startVoiceCheck() {
    try {
      await voiceRef.current.connect();
      voiceRef.current.beginListening();
    } catch {
      // error state handled by the hook; banner shows below
    }
  }

  function beginVoiceInterview() {
    voiceRef.current.endListening();
    const q = questionRef.current;
    if (q) void openQuestion(q);
  }

  function continueTyping() {
    voiceRef.current.disconnect();
    setVoiceActive(false);
    setError(null);
    setPhase("answering");
  }

  // ---------- render ----------

  if (phase === "completing") {
    return (
      <CenterCard title="Preparing your debrief…">
        <Spinner label="Grading remaining answers and writing the debrief" />
      </CenterCard>
    );
  }

  if (phase === "error") {
    return (
      <CenterCard title="Something went wrong">
        <p className="text-sm text-rose-400">{error}</p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => {
              setError(null);
              setPhase(voiceActive ? "listening" : "answering");
              if (voiceActive) voiceRef.current.beginListening();
            }}
            className="rounded bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
          >
            Keep going
          </button>
          <button
            onClick={() => void complete()}
            className="rounded bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500"
          >
            End session &amp; debrief
          </button>
        </div>
      </CenterCard>
    );
  }

  if (!question) {
    return (
      <CenterCard title="No active question">
        <button
          onClick={() => void complete()}
          className="rounded bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500"
        >
          Finish session
        </button>
      </CenterCard>
    );
  }

  if (phase === "voiceCheck") {
    return (
      <CenterCard title="Voice check">
        <p className="text-sm text-slate-400">
          You&apos;ll answer out loud. A few seconds of silence ends your turn — just like a real
          interview. Headphones are strongly recommended.
        </p>
        {voice.status === "idle" && (
          <button
            onClick={() => void startVoiceCheck()}
            className="mt-4 rounded bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500"
          >
            Enable microphone
          </button>
        )}
        {voice.status === "connecting" && <Spinner label="Connecting voice…" />}
        {voice.status === "ready" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-300">Say something — you should see it appear:</p>
            <div className="min-h-10 rounded border border-slate-800 bg-slate-950 p-3 text-sm italic text-slate-300">
              {voice.captions || "…"}
            </div>
            {checkHeard && <p className="text-sm text-emerald-400">Mic and captions working.</p>}
            <button
              onClick={beginVoiceInterview}
              disabled={!checkHeard && !initial.voiceFake}
              className="w-full rounded bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40"
            >
              Start the interview
            </button>
          </div>
        )}
        {voice.status === "error" && (
          <p className="mt-3 text-sm text-rose-400">{voice.error}</p>
        )}
        <button onClick={continueTyping} className="mt-4 text-xs text-slate-500 hover:text-slate-300">
          Continue with typing instead
        </button>
      </CenterCard>
    );
  }

  if (phase === "roundBreak" && pendingRound !== null) {
    const round = session.configJson.rounds?.[pendingRound];
    return (
      <RoundBreak
        roundNumber={pendingRound + 1}
        totalRounds={session.configJson.rounds?.length ?? 0}
        areaName={round ? (initial.areaNames[round.focusAreaId] ?? round.focusAreaId) : ""}
        personaName={round ? (initial.personaNames[round.personaId] ?? round.personaId) : ""}
        onStart={() => {
          setPendingRound(null);
          answerStartRef.current = Date.now();
          if (voiceActive) {
            void (async () => {
              try {
                await voiceRef.current.reconnect(round?.personaId ?? null);
              } catch {
                // hook degrades to typing via onError
              }
              const q = questionRef.current;
              if (q && voiceRef.current.status !== "error") await openQuestion(q);
            })();
          } else {
            setPhase("answering");
          }
        }}
      />
    );
  }

  const currentRound =
    mode === "superday" && roundIndex !== null ? session.configJson.rounds?.[roundIndex] : null;
  const personaName = currentPersonaId
    ? (initial.personaNames[currentPersonaId] ?? currentPersonaId)
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-slate-400">
          <span className="font-semibold text-slate-200 capitalize">{modeLabel(mode)}</span>
          {currentRound && roundIndex !== null && (
            <span>
              {" "}
              · Round {roundIndex + 1}/{session.configJson.rounds?.length} —{" "}
              {initial.areaNames[currentRound.focusAreaId] ?? currentRound.focusAreaId}
            </span>
          )}
          {voiceActive && personaName && <span> · with {personaName}</span>}
          <span>
            {" "}
            · Question {Math.min(answeredCount + 1, totalQuestions)}/{totalQuestions}
          </span>
          <span> · {initial.subtopicNames[question.subtopicId] ?? question.subtopicId}</span>
        </div>
        {mode === "rapid" && session.configJson.secondsPerQuestion ? (
          <CountdownTimer
            key={question.id}
            seconds={session.configJson.secondsPerQuestion}
            running={phase === "answering"}
            onExpire={onRapidExpire}
          />
        ) : (
          <CountUpTimer
            key={question.id}
            running={phase === "answering" || phase === "streaming" || phase === "listening"}
          />
        )}
      </div>

      {/* Question card (voice mode shows it as reference after the opening is spoken) */}
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
        <p className="text-base leading-relaxed text-slate-100 whitespace-pre-wrap">
          {question.promptText}
        </p>
        {question.setupFactsJson.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-slate-800 pt-3 text-sm text-slate-400">
            {question.setupFactsJson.map((fact, i) => (
              <li key={i} className="font-mono">
                {fact}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Thread */}
      {mode !== "rapid" && turns.length > 0 && (
        <div className="mt-5">
          <TranscriptView turns={turns} />
        </div>
      )}

      {/* Interviewer speaking / streaming */}
      {(phase === "streaming" || phase === "interviewerSpeaking") && (
        <div className="mt-3 flex justify-start">
          <div className="max-w-[85%] rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
            <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
              {personaName ?? "Interviewer"}
              {voiceActive && <SpeakingDots />}
            </div>
            {streamingText || <Spinner label="thinking" inline />}
          </div>
        </div>
      )}

      {/* Voice: listening (or the interviewer holding the floor mid-interjection) */}
      {phase === "listening" && (
        <div
          data-listening={voice.listening ? "true" : "false"}
          className="mt-5 rounded-lg border border-indigo-500/40 bg-indigo-500/5 p-4"
        >
          <div className="flex items-center gap-2 text-sm text-indigo-300">
            {voice.listening ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-400" />
                </span>
                {personaName ?? "The interviewer"} is listening — speak your answer
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                {personaName ?? "The interviewer"} has the floor…
              </>
            )}
          </div>
          <div className="mt-3 min-h-12 text-sm italic leading-relaxed text-slate-300">
            {voice.captions || "…"}
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Pause for a few seconds when you&apos;re done — your answer submits automatically.
          </p>
        </div>
      )}

      {/* Grading interstitial */}
      {phase === "grading" && (
        <div className="mt-5">
          <Spinner
            label={mode === "drill" ? "Grading your answer…" : "Interviewer is taking notes…"}
          />
        </div>
      )}

      {/* Drill review */}
      {phase === "review" && grade && (
        <div className="mt-5 space-y-4">
          <GradeCard grade={grade} />
          <button
            onClick={() => void advance()}
            className="w-full rounded bg-indigo-600 px-4 py-2.5 text-sm font-semibold hover:bg-indigo-500"
          >
            Next question →
          </button>
        </div>
      )}

      {phase === "advancing" && (
        <div className="mt-5">
          <Spinner label={mode === "rapid" ? "Next…" : "Writing the next question…"} />
        </div>
      )}

      {/* Typed answer box */}
      {phase === "answering" && (
        <div className="mt-5 space-y-3">
          <textarea
            autoFocus
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={onKeyDown}
            rows={mode === "rapid" ? 2 : 6}
            placeholder={
              mode === "rapid"
                ? "Answer fast — Enter to submit"
                : "Answer as you would out loud in the interview… (Cmd/Ctrl+Enter to submit)"
            }
            onKeyDownCapture={
              mode === "rapid"
                ? (e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submitTyped();
                    }
                  }
                : undefined
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
          />
          {mode !== "rapid" && (
            <div>
              <button
                onClick={() => setShowScratchpad((v) => !v)}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                {showScratchpad ? "▾ hide scratchpad" : "▸ scratchpad (arithmetic — not graded)"}
              </button>
              {showScratchpad && (
                <textarea
                  value={scratchpad}
                  onChange={(e) => setScratchpad(e.target.value)}
                  rows={4}
                  placeholder="100 × 1.1^5 ≈ 161…"
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300 placeholder:text-slate-700 focus:border-slate-600 focus:outline-none"
                />
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <button
              onClick={() => void submitTyped()}
              disabled={answer.trim().length === 0}
              className="rounded bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Submit answer
            </button>
            <button
              onClick={() => void complete()}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              End session early
            </button>
          </div>
          {mode !== "rapid" && (
            <p className="text-xs text-slate-600">Follow-ups allowed on this question: {followUpCap}</p>
          )}
        </div>
      )}

      {/* Voice-mode footer actions */}
      {voiceActive && (phase === "listening" || phase === "interviewerSpeaking") && (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
          <span>{phase === "listening" ? "You can interrupt the interviewer by speaking." : ""}</span>
          <button onClick={() => void complete()} className="hover:text-slate-300">
            End session early
          </button>
        </div>
      )}
    </div>
  );
}

async function readSseStream(
  res: Response,
  handlers: { onDelta?: (text: string) => void; onDone?: (done: { action: string }) => void },
): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const line = event.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const payload = JSON.parse(line.slice(6)) as {
        type: string;
        text?: string;
        action?: string;
        error?: string;
      };
      if (payload.type === "delta") handlers.onDelta?.(payload.text ?? "");
      else if (payload.type === "done") handlers.onDone?.({ action: payload.action ?? "wrapup" });
      else if (payload.type === "error") throw new Error(payload.error ?? "Stream failed");
    }
  }
}

function modeLabel(mode: string): string {
  return { drill: "Topic drill", mock: "Mock interview", rapid: "Rapid fire", superday: "Superday" }[
    mode
  ] ?? mode;
}

function CenterCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
      <h2 className="mb-4 text-lg font-semibold text-slate-100">{title}</h2>
      {children}
    </div>
  );
}

function Spinner({ label, inline = false }: { label: string; inline?: boolean }) {
  return (
    <span className={`${inline ? "inline-flex" : "flex justify-center"} items-center gap-2 text-sm text-slate-400`}>
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
      {label}
    </span>
  );
}

function SpeakingDots() {
  return (
    <span className="inline-flex items-end gap-0.5" aria-label="speaking">
      <span className="h-1.5 w-1 animate-pulse rounded-sm bg-indigo-400 [animation-delay:0ms]" />
      <span className="h-2.5 w-1 animate-pulse rounded-sm bg-indigo-400 [animation-delay:150ms]" />
      <span className="h-1.5 w-1 animate-pulse rounded-sm bg-indigo-400 [animation-delay:300ms]" />
    </span>
  );
}

function RoundBreak({
  roundNumber,
  totalRounds,
  areaName,
  personaName,
  onStart,
}: {
  roundNumber: number;
  totalRounds: number;
  areaName: string;
  personaName: string;
  onStart: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(60);
  const onStartRef = useRef(onStart);
  useEffect(() => {
    onStartRef.current = onStart;
  }, [onStart]);
  useEffect(() => {
    let left = 60;
    const iv = setInterval(() => {
      left -= 1;
      setSecondsLeft(Math.max(0, left));
      if (left <= 0) {
        clearInterval(iv);
        onStartRef.current();
      }
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <CenterCard title={`Round ${roundNumber} of ${totalRounds}`}>
      <p className="text-sm text-slate-300">
        {areaName} — with <span className="font-semibold text-slate-100">{personaName}</span>
      </p>
      <p className="mt-4 text-xs text-slate-500">
        Take a breath. Next round starts in {secondsLeft}s.
      </p>
      <button
        onClick={onStart}
        className="mt-4 rounded bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500"
      >
        I&apos;m ready — start now
      </button>
    </CenterCard>
  );
}

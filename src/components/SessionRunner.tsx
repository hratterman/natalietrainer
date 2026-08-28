"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CountdownTimer, CountUpTimer } from "./Timer";
import { GradeCard, type GradeView } from "./GradeCard";
import { TranscriptView, type TurnView } from "./TranscriptView";

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
  };
};

export type RunnerInitialState = {
  session: SessionView;
  questions: (QuestionView & { turns: TurnView[] })[];
  activeQuestionId: string | null;
  followUpCap: number;
  /** areaId → display name, personaId → display name (for superday headers). */
  areaNames: Record<string, string>;
  personaNames: Record<string, string>;
  subtopicNames: Record<string, string>;
};

type Phase =
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
  const [phase, setPhase] = useState<Phase>(question ? "answering" : "completing");
  const [answer, setAnswer] = useState("");
  const [scratchpad, setScratchpad] = useState("");
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [grade, setGrade] = useState<GradeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roundIndex, setRoundIndex] = useState<number | null>(() =>
    initial.session.mode === "superday" && initial.activeQuestionId ? 0 : null,
  );
  const [pendingRound, setPendingRound] = useState<number | null>(null);
  const answerStartRef = useRef(Date.now());
  const completedRef = useRef(false);

  const totalQuestions = useMemo(() => {
    if (mode === "superday" && session.configJson.rounds) {
      return session.configJson.rounds.reduce((n, r) => n + r.questionCount, 0);
    }
    return session.configJson.questionCount;
  }, [mode, session.configJson]);

  const resetForQuestion = useCallback((q: QuestionView) => {
    setQuestion(q);
    setTurns([]);
    setAnswer("");
    setScratchpad("");
    setStreamingText("");
    setGrade(null);
    setPhase("answering");
    answerStartRef.current = Date.now();
  }, []);

  const complete = useCallback(async () => {
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
  }, [router, session.id]);

  const advance = useCallback(async () => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to advance");
      setPhase("error");
    }
  }, [complete, mode, resetForQuestion, roundIndex, session.id]);

  const runGrade = useCallback(
    async (questionId: string, showReview: boolean) => {
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
    },
    [advance, session.id],
  );

  const submitRapid = useCallback(
    async (finalAnswer: string) => {
      if (!question) return;
      setPhase("advancing");
      try {
        const res = await fetch(`/api/sessions/${session.id}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: question.id,
            answer: finalAnswer,
            elapsedMs: Date.now() - answerStartRef.current,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to submit");
        setAnsweredCount((n) => n + 1);
        // Rapid questions were all created upfront; find the next unanswered.
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit");
        setPhase("error");
      }
    },
    [complete, question, resetForQuestion, session.id],
  );

  const submitAnswer = useCallback(async () => {
    if (!question || answer.trim().length === 0) return;
    if (mode === "rapid") {
      await submitRapid(answer.trim());
      return;
    }
    const submitted = answer.trim();
    const candidateTurn: TurnView = {
      id: `local-${Date.now()}`,
      role: "candidate",
      content: submitted,
      scratchpad: scratchpad.trim() || null,
      elapsedMs: Date.now() - answerStartRef.current,
    };
    setTurns((t) => [...t, candidateTurn]);
    setAnswer("");
    setStreamingText("");
    setPhase("streaming");
    try {
      const res = await fetch(`/api/sessions/${session.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          answer: submitted,
          scratchpad: candidateTurn.scratchpad,
          elapsedMs: candidateTurn.elapsedMs,
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(
          res.ok ? "No response stream" : ((await res.json()).error ?? "Failed to submit answer"),
        );
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let spoken = "";
      let done: { action: string } | null = null;
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
          if (payload.type === "delta") {
            spoken += payload.text ?? "";
            setStreamingText(spoken);
          } else if (payload.type === "done") {
            done = { action: payload.action ?? "wrapup" };
          } else if (payload.type === "error") {
            throw new Error(payload.error ?? "Interviewer failed");
          }
        }
      }
      const interviewerTurn: TurnView = {
        id: `local-i-${Date.now()}`,
        role: "interviewer",
        content: spoken,
      };
      setTurns((t) => [...t, interviewerTurn]);
      setStreamingText("");
      if (done?.action === "wrapup") {
        await runGrade(question.id, mode === "drill");
      } else {
        answerStartRef.current = Date.now();
        setPhase("answering");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit answer");
      setPhase("error");
    }
  }, [answer, mode, question, runGrade, scratchpad, session.id, submitRapid]);

  const onRapidExpire = useCallback(() => {
    if (phase !== "answering") return;
    void submitRapid(answer.trim() || "(time expired — no answer)");
  }, [answer, phase, submitRapid]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void submitAnswer();
      }
    },
    [submitAnswer],
  );

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
              setPhase("answering");
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
          setPhase("answering");
        }}
      />
    );
  }

  const currentRound =
    mode === "superday" && roundIndex !== null ? session.configJson.rounds?.[roundIndex] : null;

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
              {initial.areaNames[currentRound.focusAreaId] ?? currentRound.focusAreaId} with{" "}
              {initial.personaNames[currentRound.personaId] ?? currentRound.personaId}
            </span>
          )}
          <span>
            {" "}
            · Question {Math.min(answeredCount + 1, totalQuestions)}/{totalQuestions}
          </span>
          <span> · {initial.subtopicNames[question.subtopicId] ?? question.subtopicId}</span>
          <span> · difficulty {question.difficulty}</span>
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
            running={phase === "answering" || phase === "streaming"}
          />
        )}
      </div>

      {/* Question card */}
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
      {phase === "streaming" && (
        <div className="mt-3 flex justify-start">
          <div className="max-w-[85%] rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Interviewer</div>
            {streamingText || <Spinner label="thinking" inline />}
          </div>
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

      {/* Answer box */}
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
                      void submitAnswer();
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
              onClick={() => void submitAnswer()}
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
          <p className="text-xs text-slate-600">
            Follow-ups allowed on this question: {followUpCap}
          </p>
        </div>
      )}
    </div>
  );
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

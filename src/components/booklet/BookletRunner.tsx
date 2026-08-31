"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";

export type BookletQueueEntry = {
  itemId: string;
  kind: "carryover" | "review" | "new";
  question: string;
  sectionName: string;
};

type Outcome = {
  verdict: "right" | "partial" | "wrong";
  missing: string[];
  note: string;
  canonicalAnswer: string;
  requeue: boolean;
};

const KIND_LABEL: Record<BookletQueueEntry["kind"], string> = {
  carryover: "Retry",
  review: "Review",
  new: "New",
};

const VERDICT_VIEW = {
  right: { label: "Nailed it", cls: "border-good/40 bg-good-tint text-good" },
  partial: { label: "Partly there", cls: "border-warn/40 bg-warn-tint text-warn" },
  wrong: { label: "Not yet", cls: "border-bad/40 bg-bad-tint text-bad" },
} as const;

/**
 * The rep loop: question → typed recall → verdict + canonical answer → next.
 * Items graded wrong come back later in the same session (requeue) until
 * they land — that's the learning-to-criterion step.
 */
export function BookletRunner({
  initial,
}: {
  initial: { entries: BookletQueueEntry[]; estMinutes: number };
}) {
  const [queue, setQueue] = useState<BookletQueueEntry[]>(initial.entries);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tally, setTally] = useState({ right: 0, partial: 0, wrong: 0 });
  const [totalMs, setTotalMs] = useState(0);

  const busyRef = useRef(false);
  // Stamped in handlers only (render must stay pure); null = first question,
  // whose timing is simply not logged.
  const questionStartRef = useRef<number | null>(null);

  const current = index < queue.length ? queue[index] : undefined;

  async function submit(giveUp: boolean) {
    if (busyRef.current || !current) return;
    const trimmed = answer.trim();
    if (!giveUp && trimmed.length === 0) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const msSpent =
      questionStartRef.current != null
        ? Math.min(3_600_000, Date.now() - questionStartRef.current)
        : null;
    try {
      const res = await fetch("/api/booklet/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: current.itemId,
          answer: trimmed,
          msSpent,
          giveUp,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Grading failed (HTTP ${res.status}).`);
      }
      const result = (await res.json()) as Outcome;
      setTally((t) => ({ ...t, [result.verdict]: t[result.verdict] + 1 }));
      if (msSpent != null) setTotalMs((t) => t + msSpent);
      if (result.requeue) {
        setQueue((q) => [...q, { ...current, kind: "carryover" }]);
      }
      setOutcome(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't grade that answer — try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function next() {
    setOutcome(null);
    setAnswer("");
    setError(null);
    // The next question renders immediately after this handler, so this
    // stamp is its start time.
    questionStartRef.current = Date.now();
    setIndex((i) => i + 1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit(false);
    }
  }

  // ---- terminal states -----------------------------------------------------

  if (queue.length === 0) {
    return (
      <div className="mx-auto max-w-xl card card-pad text-center">
        <h1 className="text-lg font-semibold text-ink-900">Nothing due right now</h1>
        <p className="mt-2 text-sm text-ink-600">
          You&apos;re caught up on the booklet for today. Reviews come back on their spacing
          schedule — or raise the daily minutes to pull new questions forward.
        </p>
        <Link href="/booklet" className="btn btn-secondary mt-4">
          Back to the Booklet
        </Link>
      </div>
    );
  }

  if (!current) {
    const minutes = Math.max(1, Math.round(totalMs / 60_000));
    return (
      <div className="mx-auto max-w-xl card card-pad text-center">
        <h1 className="text-lg font-semibold text-ink-900">Session done</h1>
        <p className="mt-2 text-sm text-ink-600">
          {tally.right} right · {tally.partial} partial · {tally.wrong} missed — about {minutes} min
          of recall. Everything you missed comes back on a tighter schedule.
        </p>
        <Link href="/booklet" className="btn btn-primary mt-4">
          Back to the Booklet
        </Link>
      </div>
    );
  }

  const verdictView = outcome ? VERDICT_VIEW[outcome.verdict] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-600">
          <span className="font-semibold text-ink-900">{index + 1}</span> of {queue.length}
          <span className="ml-2 text-xs text-ink-400">
            {tally.right > 0 && `${tally.right} right`}
            {tally.wrong + tally.partial > 0 &&
              `${tally.right > 0 ? " · " : ""}${tally.wrong + tally.partial} to retighten`}
          </span>
        </span>
        <Link href="/booklet" className="text-xs font-medium text-ink-400 hover:text-ink-900">
          End session early
        </Link>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(index / queue.length) * 100}%` }}
        />
      </div>

      {/* Question card */}
      <div className="card card-pad">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600">
            {current.sectionName}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              current.kind === "new"
                ? "bg-primary-tint text-primary"
                : current.kind === "carryover"
                  ? "bg-warn-tint text-warn"
                  : "bg-surface-2 text-ink-600"
            }`}
          >
            {KIND_LABEL[current.kind]}
          </span>
        </div>
        <p className="text-base font-medium leading-relaxed text-ink-900">{current.question}</p>
      </div>

      {/* Answer or feedback */}
      {!outcome ? (
        <div className="card card-pad">
          <textarea
            className="input min-h-36 w-full resize-y"
            placeholder="Answer from memory — substance over wording. Cmd+Enter submits."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy}
            autoFocus
            data-testid="booklet-answer"
          />
          {error && (
            <p className="mt-2 text-sm text-bad" role="alert">
              {error}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void submit(true)}
              disabled={busy}
            >
              Show the answer — counts as a miss
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void submit(false)}
              disabled={busy || answer.trim().length === 0}
            >
              {busy ? <Spinner label="Checking…" inline /> : "Submit answer"}
            </button>
          </div>
        </div>
      ) : (
        <div className="card card-pad space-y-4">
          <div
            className={`flex items-center justify-between rounded-control border px-3 py-2 ${verdictView!.cls}`}
          >
            <span className="text-sm font-semibold">{verdictView!.label}</span>
            {outcome.requeue && <span className="text-xs">comes back this session</span>}
          </div>
          {outcome.missing.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-900">
              {outcome.missing.map((miss, i) => (
                <li key={`${i}-${miss}`}>{miss}</li>
              ))}
            </ul>
          )}
          {outcome.note && <p className="text-sm text-ink-600">{outcome.note}</p>}
          <div className="rounded-card border border-line bg-surface-0 p-4">
            <h3 className="section-label mb-2">Canonical answer</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-900">
              {outcome.canonicalAnswer}
            </p>
          </div>
          <div className="flex justify-end">
            <button type="button" className="btn btn-primary" onClick={next} autoFocus>
              {index + 1 >= queue.length ? "Finish session" : "Next question"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

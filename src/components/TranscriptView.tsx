import { Bubble } from "./ui/Bubble";

export type TurnView = {
  id: string;
  role: "interviewer" | "candidate";
  content: string;
  scratchpad?: string | null;
  elapsedMs?: number | null;
  interruption?: string | null;
};

const INTERRUPTION_LABELS: Record<string, string> = {
  cut_off: "cut off",
  barge_in: "talked over the interviewer",
  interjection: "interrupting",
};

export function TranscriptView({ turns }: { turns: TurnView[] }) {
  return (
    <div className="space-y-3">
      {turns.map((turn) => (
        <TurnBubble key={turn.id} turn={turn} />
      ))}
    </div>
  );
}

export function TurnBubble({ turn }: { turn: TurnView }) {
  const isInterviewer = turn.role === "interviewer";
  return (
    <Bubble
      side={isInterviewer ? "them" : "you"}
      label={isInterviewer ? "Interviewer" : "You"}
      meta={
        <>
          {turn.elapsedMs != null && (
            <span className="normal-case">answered in {Math.round(turn.elapsedMs / 1000)}s</span>
          )}
          {turn.interruption && INTERRUPTION_LABELS[turn.interruption] && (
            <span className="rounded border border-bad/30 bg-bad-tint px-1.5 py-0.5 normal-case text-bad">
              {INTERRUPTION_LABELS[turn.interruption]}
            </span>
          )}
        </>
      }
    >
      {turn.content}
      {turn.scratchpad && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-ink-400">scratchpad</summary>
          <pre className="mt-1 overflow-x-auto rounded-control bg-surface-2 p-2 font-mono text-xs text-ink-600">
            {turn.scratchpad}
          </pre>
        </details>
      )}
    </Bubble>
  );
}

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
    <div className={`flex ${isInterviewer ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isInterviewer
            ? "border border-slate-700 bg-slate-800/80 text-slate-200"
            : "border border-indigo-500/30 bg-indigo-500/10 text-slate-100"
        }`}
      >
        <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
          {isInterviewer ? "Interviewer" : "You"}
          {turn.elapsedMs != null && (
            <span className="normal-case">answered in {Math.round(turn.elapsedMs / 1000)}s</span>
          )}
          {turn.interruption && INTERRUPTION_LABELS[turn.interruption] && (
            <span className="rounded bg-rose-500/15 px-1.5 py-0.5 normal-case text-rose-300">
              {INTERRUPTION_LABELS[turn.interruption]}
            </span>
          )}
        </div>
        {turn.content}
        {turn.scratchpad && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-slate-500">scratchpad</summary>
            <pre className="mt-1 overflow-x-auto rounded bg-slate-950 p-2 font-mono text-xs text-slate-400">
              {turn.scratchpad}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

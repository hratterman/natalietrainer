/**
 * One chat bubble for every conversation surface (interviewer, coach, you).
 * `meta` renders small chips/notes beside the label (elapsed time, cut-off).
 */
export function Bubble({
  side,
  label,
  meta,
  children,
}: {
  /** "them" = interviewer/coach (left), "you" = candidate (right). */
  side: "them" | "you";
  label: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isThem = side === "them";
  return (
    <div className={`flex ${isThem ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-card border px-4 py-2.5 text-sm leading-relaxed ${
          isThem
            ? "border-line bg-surface-1 text-ink-900"
            : "border-primary/25 bg-primary-tint text-ink-900"
        }`}
      >
        <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-ink-400">
          {label}
          {meta}
        </div>
        {children}
      </div>
    </div>
  );
}

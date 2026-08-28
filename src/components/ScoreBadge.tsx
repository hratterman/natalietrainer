export function scoreColor(overall: number): string {
  if (overall >= 80) return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
  if (overall >= 60) return "text-amber-400 border-amber-500/40 bg-amber-500/10";
  return "text-rose-400 border-rose-500/40 bg-rose-500/10";
}

export function ScoreBadge({ overall, size = "md" }: { overall: number; size?: "md" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border font-semibold ${scoreColor(overall)} ${
        size === "lg" ? "h-16 w-16 text-xl" : "h-10 w-10 text-sm"
      }`}
    >
      {Math.round(overall)}
    </span>
  );
}

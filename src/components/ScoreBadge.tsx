import { TIER_CHIP, tierFromOverall } from "@/lib/score";

export function ScoreBadge({ overall, size = "md" }: { overall: number; size?: "md" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border font-bold tabular-nums ${TIER_CHIP[tierFromOverall(overall)]} ${
        size === "lg" ? "h-16 w-16 text-xl" : "h-10 w-10 text-sm"
      }`}
    >
      {Math.round(overall)}
    </span>
  );
}

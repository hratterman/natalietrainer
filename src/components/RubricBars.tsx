import { TIER_FILL, tierFromRubric } from "@/lib/score";

export function RubricBars({
  accuracy,
  completeness,
  structure,
  delivery,
}: {
  accuracy: number;
  completeness: number;
  structure: number;
  /** Spoken answers only; hidden when null/undefined. */
  delivery?: number | null;
}) {
  const rows: [string, number][] = [
    ["Accuracy", accuracy],
    ["Completeness", completeness],
    ["Structure", structure],
    ...(delivery != null ? ([["Delivery", delivery]] as [string, number][]) : []),
  ];
  return (
    <div className="space-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 text-ink-600">{label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full ${TIER_FILL[tierFromRubric(value)]}`}
              style={{ width: `${(value / 10) * 100}%` }}
            />
          </div>
          <span className="w-10 text-right font-mono text-xs tabular-nums text-ink-600">
            {value}/10
          </span>
        </div>
      ))}
    </div>
  );
}

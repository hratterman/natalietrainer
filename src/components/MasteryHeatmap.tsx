import Link from "next/link";
import { tierFromMastery, type Tier } from "@/lib/score";

export type HeatmapCell = {
  subtopicId: string;
  subtopicName: string;
  score: number | null;
  attempts: number;
  stale: boolean;
};

export type HeatmapArea = {
  areaId: string;
  areaName: string;
  tier: 1 | 2;
  cells: HeatmapCell[];
};

/** Chip tint ramp — solid tinted chips, never dashed placeholders. */
const CELL_TINT: Record<Tier, string> = {
  good: "border-good/35 bg-good-tint text-good",
  ok: "border-good/25 bg-good-tint/60 text-good/90",
  warn: "border-warn/35 bg-warn-tint text-warn",
  bad: "border-bad/35 bg-bad-tint text-bad",
};
const CELL_UNSEEN = "border-line bg-surface-2 text-ink-600";

function cellClasses(cell: HeatmapCell): string {
  if (cell.score === null) return CELL_UNSEEN;
  return CELL_TINT[tierFromMastery(cell.score)];
}

export function MasteryHeatmap({ areas }: { areas: HeatmapArea[] }) {
  const tiers: { tier: 1 | 2; label: string }[] = [
    { tier: 1, label: "Core" },
    { tier: 2, label: "Breadth" },
  ];
  return (
    <div className="space-y-6">
      {tiers.map(({ tier, label }) => {
        const tierAreas = areas.filter((a) => a.tier === tier);
        if (tierAreas.length === 0) return null;
        return (
          <div key={tier}>
            <h3 className="section-label mb-2">{label}</h3>
            <div className="space-y-3">
              {tierAreas.map((area) => (
                <div key={area.areaId}>
                  <div className="mb-1.5 text-sm font-semibold text-ink-900">{area.areaName}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {area.cells.map((cell) => (
                      <Link
                        key={cell.subtopicId}
                        href={`/train/new?mode=drill&subtopicId=${encodeURIComponent(cell.subtopicId)}`}
                        title={`${cell.subtopicName} — ${
                          cell.score === null
                            ? "not attempted yet"
                            : `${Math.round(cell.score * 100)}% mastery, ${cell.attempts} attempts${cell.stale ? ", getting stale" : ""}`
                        }`}
                        className={`inline-flex items-center gap-1.5 rounded-control border px-2 py-1 text-xs transition-colors hover:border-primary ${cellClasses(cell)}`}
                      >
                        {cell.subtopicName}
                        {cell.score !== null && (
                          <span className="font-mono tabular-nums">{Math.round(cell.score * 100)}</span>
                        )}
                        {cell.stale && (
                          <span
                            className="h-1.5 w-1.5 rounded-full border border-current"
                            aria-label="stale"
                          />
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {/* Legend with real swatches — no prose decoding required. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-600">
        <LegendSwatch className={CELL_UNSEEN}>not tried</LegendSwatch>
        <LegendSwatch className={CELL_TINT.bad}>&lt;40</LegendSwatch>
        <LegendSwatch className={CELL_TINT.warn}>40–59</LegendSwatch>
        <LegendSwatch className={CELL_TINT.ok}>60–79</LegendSwatch>
        <LegendSwatch className={CELL_TINT.good}>80+</LegendSwatch>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full border border-ink-400" /> not practiced in a week
        </span>
        <span>· click any subtopic to drill it</span>
      </div>
    </div>
  );
}

function LegendSwatch({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3.5 w-3.5 rounded border ${className}`} />
      {children}
    </span>
  );
}

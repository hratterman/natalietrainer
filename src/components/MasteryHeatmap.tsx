import Link from "next/link";

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

function cellClasses(cell: HeatmapCell): string {
  if (cell.score === null) return "border-dashed border-slate-700 bg-slate-900 text-slate-600";
  const base =
    cell.score >= 0.8
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
      : cell.score >= 0.6
        ? "border-lime-500/40 bg-lime-500/10 text-lime-300"
        : cell.score >= 0.4
          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
          : "border-rose-500/40 bg-rose-500/10 text-rose-300";
  return cell.stale ? `${base} opacity-60` : base;
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
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </h3>
            <div className="space-y-3">
              {tierAreas.map((area) => (
                <div key={area.areaId}>
                  <div className="mb-1.5 text-sm font-medium text-slate-300">{area.areaName}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {area.cells.map((cell) => (
                      <Link
                        key={cell.subtopicId}
                        href={`/train/new?mode=drill&subtopicId=${encodeURIComponent(cell.subtopicId)}`}
                        title={`${cell.subtopicName} — ${
                          cell.score === null
                            ? "not attempted"
                            : `${Math.round(cell.score * 100)}% mastery, ${cell.attempts} attempts${cell.stale ? ", stale" : ""}`
                        }`}
                        className={`rounded border px-2 py-1 text-xs transition hover:brightness-125 ${cellClasses(cell)}`}
                      >
                        {cell.subtopicName}
                        {cell.score !== null && (
                          <span className="ml-1.5 font-mono">{Math.round(cell.score * 100)}</span>
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
      <p className="text-xs text-slate-600">
        Click any subtopic to drill it. Faded = not practiced in over a week. Dashed = never
        attempted.
      </p>
    </div>
  );
}

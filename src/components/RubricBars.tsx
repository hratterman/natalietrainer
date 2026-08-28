export function RubricBars({
  accuracy,
  completeness,
  structure,
}: {
  accuracy: number;
  completeness: number;
  structure: number;
}) {
  const rows: [string, number][] = [
    ["Accuracy", accuracy],
    ["Completeness", completeness],
    ["Structure", structure],
  ];
  return (
    <div className="space-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 text-slate-400">{label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800">
            <div
              className={`h-full rounded ${value >= 7 ? "bg-emerald-500" : value >= 4 ? "bg-amber-500" : "bg-rose-500"}`}
              style={{ width: `${(value / 10) * 100}%` }}
            />
          </div>
          <span className="w-10 text-right font-mono text-slate-300">{value}/10</span>
        </div>
      ))}
    </div>
  );
}

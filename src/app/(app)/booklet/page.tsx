import Link from "next/link";
import { getOverview, type SectionCoverage } from "@/lib/booklet/engine";
import { BookletSettings } from "@/components/booklet/BookletSettings";

export const dynamic = "force-dynamic";

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

function CoverageBar({ s, thick = false }: { s: Omit<SectionCoverage, "sectionId" | "sectionName">; thick?: boolean }) {
  const pct = (n: number) => `${(n / Math.max(1, s.total)) * 100}%`;
  return (
    <div
      className={`flex w-full overflow-hidden rounded-full bg-surface-2 ${thick ? "h-3" : "h-2"}`}
      role="img"
      aria-label={`${s.cold} of ${s.total} cold`}
    >
      <div className="bg-good" style={{ width: pct(s.cold) }} />
      <div className="bg-primary" style={{ width: pct(s.solidifying) }} />
      <div className="bg-warn" style={{ width: pct(s.learning) }} />
    </div>
  );
}

export default function BookletPage() {
  const overview = getOverview();
  const { settings, sections, totals, plan, projection, repsToday, referenceCounts } = overview;
  const todayTotal = plan.carryoverCount + plan.reviewCount + plan.newCount;

  let paceLine: string;
  if (projection.remaining === 0) {
    paceLine = "Everything is cold. Maintenance reviews will keep surfacing so it stays that way.";
  } else if (projection.onPace === null) {
    paceLine = `At ${settings.dailyMinutes} min/day, all ${projection.remaining} remaining questions go cold around ${fmtDate(projection.coldByMs)} — set your superday date and pacing will work backward from it.`;
  } else if (projection.onPace) {
    paceLine = `On pace: all ${projection.remaining} remaining questions cold by ${fmtDate(projection.coldByMs)}, ahead of the superday.`;
  } else {
    paceLine = `Off pace at ${settings.dailyMinutes} min/day${
      projection.suggestedDailyMinutes
        ? ` — about ${projection.suggestedDailyMinutes} min/day would get everything cold before the superday`
        : ""
    }. The final two days always re-run everything as a sweep.`;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">The Booklet</h1>
          <p className="mt-1 text-sm text-ink-600">
            {totals.total} technical questions from the guide, drilled by recall until each one is
            cold — then kept cold.
          </p>
        </div>
        <Link href="/booklet/session" className="btn btn-primary">
          Start today&apos;s session
        </Link>
      </div>

      {/* Today's plan */}
      <div className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-label">Today&apos;s plan</h2>
            {todayTotal === 0 ? (
              <p className="mt-1 text-sm text-ink-600">
                Nothing due — you&apos;re caught up
                {repsToday > 0 ? ` (${repsToday} answers in already today)` : ""}. Come back
                tomorrow, or raise the daily minutes to pull more new questions forward.
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-600">
                {plan.reviewCount + plan.carryoverCount > 0 && (
                  <>
                    <span className="font-semibold text-ink-900">
                      {plan.reviewCount + plan.carryoverCount} reviews
                    </span>
                    {" due"}
                  </>
                )}
                {plan.reviewCount + plan.carryoverCount > 0 && plan.newCount > 0 && " + "}
                {plan.newCount > 0 && (
                  <>
                    <span className="font-semibold text-ink-900">{plan.newCount} new</span>
                    {" questions"}
                  </>
                )}
                {" — about "}
                <span className="font-semibold text-ink-900">{plan.estMinutes} min</span>
                {repsToday > 0 ? ` (${repsToday} answers in already today)` : ""}
              </p>
            )}
          </div>
        </div>
        <p className="mt-3 border-t border-line pt-3 text-sm text-ink-600">{paceLine}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coverage */}
        <div className="card card-pad lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="section-label">Cold coverage</h2>
            <span className="text-sm font-semibold text-ink-900">
              {totals.cold} / {totals.total} cold
            </span>
          </div>
          <CoverageBar s={totals} thick />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-good" />
              Cold — proven 3× spaced
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />
              Solidifying
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-warn" />
              In progress
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-surface-2 ring-1 ring-line" />
              Untouched
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {sections.map((s) => (
              <div key={s.sectionId} className="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3">
                <span className="truncate text-sm text-ink-900">{s.sectionName}</span>
                <CoverageBar s={s} />
                <span className="w-14 text-right text-xs tabular-nums text-ink-400">
                  {s.cold}/{s.total}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <BookletSettings initial={settings} />

          <div className="card card-pad">
            <h2 className="section-label mb-2">Reference</h2>
            <p className="text-sm text-ink-600">
              Every question and canonical answer, including the {referenceCounts.fit} fit and{" "}
              {referenceCounts.experience} deal-experience ones — those need <em>your</em> stories,
              so they aren&apos;t drilled verbatim.
            </p>
            <Link href="/booklet/reference" className="btn btn-secondary btn-sm mt-3">
              Browse the full canon
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import * as repo from "@/lib/db/repo";
import { AREAS, getSubtopic } from "@/content/taxonomy";
import { isStale, rankWeaknesses } from "@/lib/mastery";
import { MasteryHeatmap, type HeatmapArea } from "@/components/MasteryHeatmap";
import { ScoreBadge } from "@/components/ScoreBadge";
import { fixitView, type FixitView } from "@/lib/api/fixitView";
import type { Debrief } from "@/lib/llm/schemas";

export const dynamic = "force-dynamic";

// Data assembly lives outside the component so the render itself stays pure
// (this page is force-dynamic; the data is read per-request).
function loadDashboardData() {
  const masteryRows = repo.getMasteryOverview();
  const byId = new Map(masteryRows.map((m) => [m.subtopicId, m]));
  const now = Date.now();

  const heatmapAreas: HeatmapArea[] = AREAS.map((area) => ({
    areaId: area.id,
    areaName: area.name,
    tier: area.tier,
    cells: area.subtopics.map((s) => {
      const m = byId.get(s.id);
      return {
        subtopicId: s.id,
        subtopicName: s.name,
        score: m?.score ?? null,
        attempts: m?.attempts ?? 0,
        stale: m ? isStale(m.lastAttemptAt.getTime(), now) : false,
      };
    }),
  }));

  const weaknesses = rankWeaknesses(
    AREAS.flatMap((area) =>
      area.subtopics.map((s) => {
        const m = byId.get(s.id);
        return {
          subtopicId: s.id,
          score: m?.score ?? null,
          lastAttemptAt: m?.lastAttemptAt?.getTime() ?? null,
        };
      }),
    ),
    now,
  ).slice(0, 5);

  // Learn sessions belong to the fix-it queue, not the sessions list; a
  // zero-question active session (failed seed) is unresumable noise.
  const sessions = repo
    .listSessions(20)
    .filter((s) => s.mode !== "learn")
    .filter((s) => s.status !== "active" || repo.getSessionQuestions(s.id).length > 0)
    .slice(0, 8);
  const fixitsActive = repo.listActiveFixits().map(fixitView);
  return {
    heatmapAreas,
    weaknesses,
    sessions,
    hasAnyPractice: masteryRows.length > 0,
    fixitsOpen: fixitsActive.filter((f) => f.status === "open"),
    fixitsDue: fixitsActive.filter((f) => f.dueForCheck),
  };
}

function FixitRowView({ fixit, due = false }: { fixit: FixitView; due?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-control border border-line bg-surface-1 px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm text-ink-900">
          <span className="truncate font-semibold">{fixit.concept}</span>
          {due && (
            <span className="shrink-0 rounded border border-warn/30 bg-warn-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warn">
              spot-check due
            </span>
          )}
          {fixit.attempts > 0 && (
            <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-600">
              {fixit.attempts + 1}× missed
            </span>
          )}
        </div>
        <div className="truncate text-xs text-ink-400">
          {fixit.subtopicName}
          {fixit.corrections[0] ? ` — ${fixit.corrections[0]}` : fixit.gaps[0] ? ` — ${fixit.gaps[0]}` : ""}
        </div>
      </div>
      <Link href={`/learn/${fixit.id}`} className="btn btn-primary btn-sm shrink-0">
        {due ? "Spot-check" : "Learn"}
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const { heatmapAreas, weaknesses, sessions, hasAnyPractice, fixitsOpen, fixitsDue } =
    loadDashboardData();
  const activeSession = sessions.find((s) => s.status === "active");

  return (
    <div className="space-y-8">
      {/* Hero row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">
            {hasAnyPractice ? "Welcome back, Natalie" : "Let's get you superday-ready, Natalie"}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            Challenging technicals, a real interviewer across the table, and honest scoring.
          </p>
        </div>
        <div className="flex gap-3" data-tour="modes">
          <Link href="/train/new" className="btn btn-primary">
            New session
          </Link>
          <Link href="/train/new?mode=superday" className="btn btn-secondary">
            Start superday sim
          </Link>
        </div>
      </div>

      {/* Resume banner */}
      {activeSession && (
        <Link
          href={`/train/${activeSession.id}`}
          className="block rounded-card border border-warn/40 bg-warn-tint px-5 py-3 text-sm font-medium text-warn hover:border-warn"
        >
          You have an unfinished {activeSession.mode} session — resume it →
        </Link>
      )}

      {/* Fix-it queue */}
      {(fixitsOpen.length > 0 || fixitsDue.length > 0) && (
        <div className="card card-pad border-warn/30" data-tour="fixits">
          <h2 className="section-label text-warn">Fix-it queue</h2>
          <p className="mt-1 text-xs text-ink-400">
            Concepts you missed. Learn them with the coach, then prove them on fresh questions.
          </p>
          <div className="mt-3 space-y-2">
            {fixitsDue.map((f) => (
              <FixitRowView key={f.id} fixit={f} due />
            ))}
            {fixitsOpen.map((f) => (
              <FixitRowView key={f.id} fixit={f} />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3" data-section="dashboard-main">
        {/* Heatmap */}
        <div className="card card-pad lg:col-span-2" data-tour="mastery">
          <h2 className="section-label mb-4">Mastery map</h2>
          {hasAnyPractice ? (
            <MasteryHeatmap areas={heatmapAreas} />
          ) : (
            <div className="rounded-card border border-dashed border-line-strong bg-surface-0 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-ink-900">Nothing on the map yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-600">
                Every subtopic you practice gets scored and tinted here, so you always know
                what&apos;s solid and what needs work. Run one topic drill to light it up.
              </p>
              <Link href="/train/new?mode=drill" className="btn btn-primary mt-4">
                Start a topic drill
              </Link>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Weaknesses */}
          <div className="card card-pad" data-tour="attack">
            <h2 className="section-label mb-3">Attack next</h2>
            <div className="space-y-2">
              {weaknesses.map((w) => {
                const ref = getSubtopic(w.subtopicId);
                return (
                  <div key={w.subtopicId} className="flex items-center justify-between gap-2 text-sm">
                    <div className="text-ink-900">
                      {ref?.subtopic.name ?? w.subtopicId}
                      <span className="ml-1.5 text-xs text-ink-400">
                        {w.unexplored ? "new" : w.stale ? "stale" : "weak"}
                      </span>
                    </div>
                    <Link
                      href={`/train/new?mode=drill&subtopicId=${encodeURIComponent(w.subtopicId)}`}
                      className="btn btn-secondary btn-sm shrink-0"
                    >
                      Drill
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent sessions */}
          <div className="card card-pad">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-label">Recent sessions</h2>
              <Link href="/history" className="text-xs font-medium text-primary hover:text-primary-strong">
                All →
              </Link>
            </div>
            {sessions.length === 0 ? (
              <p className="text-sm text-ink-400">
                No sessions yet. Start with a topic drill to calibrate your levels.
              </p>
            ) : (
              <div className="space-y-1">
                {sessions.slice(0, 5).map((s) => {
                  const debrief = s.debriefJson as Debrief | null;
                  return (
                    <Link
                      key={s.id}
                      href={s.status === "active" ? `/train/${s.id}` : `/history/${s.id}`}
                      className="flex items-center justify-between gap-2 rounded-control px-2 py-1.5 text-sm hover:bg-surface-2"
                    >
                      <span className="capitalize text-ink-900">
                        {s.mode}
                        <span className="ml-2 text-xs normal-case text-ink-400">
                          {new Date(s.startedAt).toLocaleDateString()}
                        </span>
                      </span>
                      {debrief ? (
                        <ScoreBadge overall={debrief.overallScore} />
                      ) : (
                        <span className="text-xs uppercase text-ink-400">{s.status}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

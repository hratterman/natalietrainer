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
    <div className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm text-slate-200">
          <span className="truncate font-medium">{fixit.concept}</span>
          {due && (
            <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] uppercase text-amber-300">
              spot-check due
            </span>
          )}
          {fixit.attempts > 0 && (
            <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
              {fixit.attempts + 1}× missed
            </span>
          )}
        </div>
        <div className="truncate text-xs text-slate-500">
          {fixit.subtopicName}
          {fixit.corrections[0] ? ` — ${fixit.corrections[0]}` : fixit.gaps[0] ? ` — ${fixit.gaps[0]}` : ""}
        </div>
      </div>
      <Link
        href={`/learn/${fixit.id}`}
        className={`shrink-0 rounded px-3 py-1.5 text-xs font-semibold ${
          due
            ? "bg-amber-600 text-white hover:bg-amber-500"
            : "bg-indigo-600 text-white hover:bg-indigo-500"
        }`}
      >
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
          <h1 className="text-2xl font-semibold text-slate-100">
            {hasAnyPractice ? "Welcome back, Natalie" : "Let's get you superday-ready, Natalie"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Challenging technicals, a real interviewer across the table, and honest scoring.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/train/new"
            className="rounded border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
          >
            New session
          </Link>
          <Link
            href="/train/new?mode=superday"
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500"
          >
            Start superday sim
          </Link>
        </div>
      </div>

      {/* Resume banner */}
      {activeSession && (
        <Link
          href={`/train/${activeSession.id}`}
          className="block rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-sm text-amber-300 hover:bg-amber-500/15"
        >
          You have an unfinished {activeSession.mode} session — resume it →
        </Link>
      )}

      {/* Fix-it queue */}
      {(fixitsOpen.length > 0 || fixitsDue.length > 0) && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-300">
            Fix-it queue
          </h2>
          <p className="mt-1 text-xs text-slate-500">
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
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Mastery map
          </h2>
          <MasteryHeatmap areas={heatmapAreas} />
        </div>

        <div className="space-y-6">
          {/* Weaknesses */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Attack next
            </h2>
            <div className="space-y-2">
              {weaknesses.map((w) => {
                const ref = getSubtopic(w.subtopicId);
                return (
                  <div key={w.subtopicId} className="flex items-center justify-between gap-2 text-sm">
                    <div className="text-slate-300">
                      {ref?.subtopic.name ?? w.subtopicId}
                      <span className="ml-1.5 text-xs text-slate-600">
                        {w.unexplored ? "new" : w.stale ? "stale" : "weak"}
                      </span>
                    </div>
                    <Link
                      href={`/train/new?mode=drill&subtopicId=${encodeURIComponent(w.subtopicId)}`}
                      className="shrink-0 rounded bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                    >
                      Drill
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent sessions */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Recent sessions
              </h2>
              <Link href="/history" className="text-xs text-indigo-400 hover:text-indigo-300">
                All →
              </Link>
            </div>
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-500">
                No sessions yet. Start with a topic drill to calibrate your levels.
              </p>
            ) : (
              <div className="space-y-2">
                {sessions.slice(0, 5).map((s) => {
                  const debrief = s.debriefJson as Debrief | null;
                  return (
                    <Link
                      key={s.id}
                      href={s.status === "active" ? `/train/${s.id}` : `/history/${s.id}`}
                      className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-800/60"
                    >
                      <span className="capitalize text-slate-300">
                        {s.mode}
                        <span className="ml-2 text-xs text-slate-600">
                          {new Date(s.startedAt).toLocaleDateString()}
                        </span>
                      </span>
                      {debrief ? (
                        <ScoreBadge overall={debrief.overallScore} />
                      ) : (
                        <span className="text-xs uppercase text-slate-600">{s.status}</span>
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

import Link from "next/link";
import * as repo from "@/lib/db/repo";
import { AREAS, getSubtopic } from "@/content/taxonomy";
import { isStale, rankWeaknesses } from "@/lib/mastery";
import { MasteryHeatmap, type HeatmapArea } from "@/components/MasteryHeatmap";
import { ScoreBadge } from "@/components/ScoreBadge";
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

  const sessions = repo.listSessions(8);
  return { heatmapAreas, weaknesses, sessions, hasAnyPractice: masteryRows.length > 0 };
}

export default function DashboardPage() {
  const { heatmapAreas, weaknesses, sessions, hasAnyPractice } = loadDashboardData();
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

      <div className="grid gap-6 lg:grid-cols-3">
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

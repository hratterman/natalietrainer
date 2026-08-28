import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import * as repo from "@/lib/db/repo";
import { AREAS, getSubtopic } from "@/content/taxonomy";
import { GradeCard } from "@/components/GradeCard";
import { ScoreBadge } from "@/components/ScoreBadge";
import { TranscriptView } from "@/components/TranscriptView";
import type { Debrief } from "@/lib/llm/schemas";

export const dynamic = "force-dynamic";

export default async function DebriefPage({ params }: PageProps<"/train/[sessionId]/debrief">) {
  const { sessionId } = await params;
  const state = repo.getSessionWithTranscript(sessionId);
  if (!state) notFound();
  if (state.session.status === "active") redirect(`/train/${sessionId}`);

  const debrief = state.session.debriefJson as Debrief | null;
  const areaName = (id: string) => AREAS.find((a) => a.id === id)?.name ?? id;
  const subtopicName = (id: string) => getSubtopic(id)?.subtopic.name ?? id;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Session debrief</h1>
        <Link href="/train/new" className="text-sm text-indigo-400 hover:text-indigo-300">
          New session →
        </Link>
      </div>

      {debrief ? (
        <>
          {/* Overall */}
          <div className="mt-6 flex items-center gap-5 rounded-lg border border-slate-800 bg-slate-900 p-5">
            <ScoreBadge overall={debrief.overallScore} size="lg" />
            <div>
              <div className="text-sm text-slate-400">Superday readiness on this material</div>
              <div className="text-lg font-semibold text-slate-100">
                {debrief.overallScore >= 80
                  ? "Offer-quality"
                  : debrief.overallScore >= 60
                    ? "Close — sharpen the gaps below"
                    : "Not yet — drill the plan below"}
              </div>
            </div>
          </div>

          {/* By area */}
          {debrief.byArea.length > 0 && (
            <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                By area
              </h2>
              <div className="mt-3 space-y-3">
                {debrief.byArea.map((area) => (
                  <div key={area.areaId} className="flex items-start gap-3">
                    <ScoreBadge overall={area.score} />
                    <div>
                      <div className="text-sm font-semibold text-slate-200">
                        {areaName(area.areaId)}
                      </div>
                      <div className="text-sm text-slate-400">{area.comment}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {/* Strengths */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
                Strengths
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
                {debrief.topStrengths.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
            {/* Weaknesses */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-400">
                Weaknesses
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
                {debrief.topWeaknesses.map((w, i) => (
                  <li key={i}>
                    <span className="font-semibold">{subtopicName(w.subtopicId)}</span> — {w.why}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Drill plan */}
          {debrief.drillPlan.length > 0 && (
            <div className="mt-5 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-300">
                Prescribed drills
              </h2>
              <div className="mt-3 space-y-2">
                {debrief.drillPlan.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-sm">
                    <div className="text-slate-300">
                      <span className="font-semibold text-slate-100">
                        {subtopicName(d.subtopicId)}
                      </span>{" "}
                      at difficulty {d.difficulty} — {d.rationale}
                    </div>
                    <Link
                      href={`/train/new?mode=drill&subtopicId=${encodeURIComponent(d.subtopicId)}&difficulty=${d.difficulty}`}
                      className="shrink-0 rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-500"
                    >
                      Drill this
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="mt-6 text-sm text-slate-400">No debrief was generated for this session.</p>
      )}

      {/* Per-question review */}
      <h2 className="mt-8 text-lg font-semibold text-slate-100">Question review</h2>
      <div className="mt-4 space-y-6">
        {state.questions.map((q) => (
          <div key={q.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
              <span>
                Q{q.askedIndex + 1} · {subtopicName(q.subtopicId)} · difficulty {q.difficulty}
              </span>
              <span className="uppercase">{q.status}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
              {q.promptText}
            </p>
            {q.turns.length > 0 && (
              <div className="mt-4">
                <TranscriptView turns={q.turns} />
              </div>
            )}
            {q.grade && (
              <div className="mt-4">
                <GradeCard
                  grade={{
                    accuracy: q.grade.accuracy,
                    completeness: q.grade.completeness,
                    structure: q.grade.structure,
                    overall: q.grade.overall,
                    modelAnswer: q.grade.modelAnswer,
                    strengths: q.grade.feedbackJson.strengths,
                    gaps: q.grade.feedbackJson.gaps,
                    corrections: q.grade.feedbackJson.corrections,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

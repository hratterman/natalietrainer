import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import * as repo from "@/lib/db/repo";
import { AREAS, getSubtopic } from "@/content/taxonomy";
import { GradeCard } from "@/components/GradeCard";
import { ScoreBadge } from "@/components/ScoreBadge";
import { TranscriptView } from "@/components/TranscriptView";
import type { Debrief } from "@/lib/llm/schemas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Session debrief" };

export default async function DebriefPage({ params }: PageProps<"/train/[sessionId]/debrief">) {
  const { sessionId } = await params;
  const state = repo.getSessionWithTranscript(sessionId);
  if (!state) notFound();
  // Learn sessions have no debrief — their transcript is coach chat.
  if (state.session.mode === "learn") {
    redirect(`/learn/${state.session.configJson.fixitId ?? ""}`);
  }
  if (state.session.status === "active") redirect(`/train/${sessionId}`);

  const debrief = state.session.debriefJson as Debrief | null;
  const areaName = (id: string) => AREAS.find((a) => a.id === id)?.name ?? id;
  const subtopicName = (id: string) => getSubtopic(id)?.subtopic.name ?? id;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">Session debrief</h1>
        <Link href="/train/new" className="text-sm font-medium text-primary hover:text-primary-strong">
          New session →
        </Link>
      </div>

      {debrief ? (
        <>
          {/* Overall */}
          <div className="mt-6 flex items-center gap-6 card p-6">
            <ScoreBadge overall={debrief.overallScore} size="lg" />
            <div>
              <div className="section-label">Superday readiness on this material</div>
              <div className="mt-0.5 text-2xl font-bold tracking-tight text-ink-900">
                {debrief.overallScore >= 80
                  ? "Offer-quality"
                  : debrief.overallScore >= 60
                    ? "Close — sharpen the gaps below"
                    : "Not yet — drill the plan below"}
              </div>
              <p className="mt-1 text-sm text-ink-600">
                {debrief.overallScore >= 80
                  ? "This is the level that gets callbacks. Keep it warm."
                  : debrief.overallScore >= 60
                    ? "The mechanics are there; the misses below are what a superday would catch."
                    : "Work the prescribed drills before re-testing at this difficulty."}
              </p>
            </div>
          </div>

          {/* By area */}
          {debrief.byArea.length > 0 && (
            <div className="mt-5 card card-pad">
              <h2 className="section-label">
                By area
              </h2>
              <div className="mt-3 space-y-3">
                {debrief.byArea.map((area) => (
                  <div key={area.areaId} className="flex items-start gap-3">
                    <ScoreBadge overall={area.score} />
                    <div>
                      <div className="text-sm font-semibold text-ink-900">
                        {areaName(area.areaId)}
                      </div>
                      <div className="text-sm text-ink-600">{area.comment}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {/* Strengths */}
            <div className="card card-pad">
              <h2 className="section-label text-good">
                Strengths
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-900">
                {debrief.topStrengths.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
            {/* Weaknesses */}
            <div className="card card-pad">
              <h2 className="section-label text-bad">
                Weaknesses
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-900">
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
            <div className="mt-5 rounded-lg border border-primary/30 bg-primary-tint p-5">
              <h2 className="section-label text-primary">
                Prescribed drills
              </h2>
              <div className="mt-3 space-y-2">
                {debrief.drillPlan.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-sm">
                    <div className="text-ink-900">
                      <span className="font-semibold text-ink-900">
                        {subtopicName(d.subtopicId)}
                      </span>{" "}
                      at difficulty {d.difficulty} — {d.rationale}
                    </div>
                    <Link
                      href={`/train/new?mode=drill&subtopicId=${encodeURIComponent(d.subtopicId)}&difficulty=${d.difficulty}`}
                      className="shrink-0 btn btn-primary btn-sm"
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
        <p className="mt-6 text-sm text-ink-600">No debrief was generated for this session.</p>
      )}

      {/* Per-question review */}
      <h2 className="mt-8 text-lg font-semibold text-ink-900">Question review</h2>
      <div className="mt-4 space-y-6">
        {state.questions.map((q) => (
          <div key={q.id} className="card card-pad">
            <div className="mb-3 flex items-center justify-between text-xs text-ink-400">
              <span>
                Q{q.askedIndex + 1} · {subtopicName(q.subtopicId)} · difficulty {q.difficulty}
              </span>
              <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 uppercase tracking-wide">
                {q.status}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-900">
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
                    delivery: q.grade.delivery,
                    overall: q.grade.overall,
                    modelAnswer: q.grade.modelAnswer,
                    strengths: q.grade.feedbackJson.strengths,
                    gaps: q.grade.feedbackJson.gaps,
                    corrections: q.grade.feedbackJson.corrections,
                    deliveryFeedback: q.grade.feedbackJson.delivery,
                  }}
                  learnHref={(() => {
                    const fixit = repo.getFixitBySourceQuestion(q.id);
                    return fixit && fixit.status === "open" ? `/learn/${fixit.id}` : null;
                  })()}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

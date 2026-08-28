import { notFound, redirect } from "next/navigation";
import * as repo from "@/lib/db/repo";
import { AREAS, allSubtopics } from "@/content/taxonomy";
import { PERSONAS } from "@/lib/llm/personas";
import { FOLLOW_UP_CAPS } from "@/lib/session/engine";
import { SessionRunner, type RunnerInitialState } from "@/components/SessionRunner";

export const dynamic = "force-dynamic";

export default async function TrainSessionPage({
  params,
}: PageProps<"/train/[sessionId]">) {
  const { sessionId } = await params;
  const state = repo.getSessionWithTranscript(sessionId);
  if (!state) notFound();
  if (state.session.status === "completed") redirect(`/train/${sessionId}/debrief`);

  const active = repo.getActiveQuestion(sessionId);

  const initial: RunnerInitialState = {
    session: {
      id: state.session.id,
      mode: state.session.mode,
      status: state.session.status,
      configJson: {
        personaId: state.session.configJson.personaId,
        secondsPerQuestion: state.session.configJson.secondsPerQuestion,
        questionCount: state.session.configJson.questionCount,
        rounds: state.session.configJson.rounds,
      },
    },
    questions: state.questions.map((q) => ({
      id: q.id,
      askedIndex: q.askedIndex,
      subtopicId: q.subtopicId,
      difficulty: q.difficulty,
      promptText: q.promptText,
      setupFactsJson: q.setupFactsJson,
      answerFormat: q.answerFormat,
      status: q.status,
      roundId: q.roundId,
      turns: q.turns.map((t) => ({
        id: t.id,
        role: t.role,
        content: t.content,
        scratchpad: t.scratchpad,
        elapsedMs: t.elapsedMs,
      })),
    })),
    activeQuestionId: active?.id ?? null,
    followUpCap: FOLLOW_UP_CAPS[state.session.mode],
    areaNames: Object.fromEntries(AREAS.map((a) => [a.id, a.name])),
    personaNames: Object.fromEntries(PERSONAS.map((p) => [p.id, p.name])),
    subtopicNames: Object.fromEntries(
      allSubtopics().map(({ subtopic }) => [subtopic.id, subtopic.name]),
    ),
  };

  return <SessionRunner initial={initial} />;
}

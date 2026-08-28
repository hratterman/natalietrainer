import "server-only";
import type { FixitRow } from "@/lib/db/repo";
import { getSubtopic } from "@/content/taxonomy";

export type FixitView = ReturnType<typeof fixitView>;

export function fixitView(fixit: FixitRow) {
  const ref = getSubtopic(fixit.subtopicId);
  return {
    id: fixit.id,
    concept: fixit.concept,
    subtopicId: fixit.subtopicId,
    subtopicName: ref?.subtopic.name ?? fixit.subtopicId,
    areaName: ref?.area.name ?? "",
    archetypeId: fixit.archetypeId,
    difficulty: fixit.difficulty,
    status: fixit.status,
    attempts: fixit.attempts,
    checkStage: fixit.checkStage,
    gaps: fixit.detailJson.gaps,
    corrections: fixit.detailJson.corrections,
    createdAt: fixit.createdAt.getTime(),
    resolvedAt: fixit.resolvedAt?.getTime() ?? null,
    nextCheckAt: fixit.nextCheckAt?.getTime() ?? null,
    dueForCheck:
      fixit.status === "resolved" &&
      fixit.nextCheckAt !== null &&
      fixit.nextCheckAt.getTime() <= Date.now(),
  };
}

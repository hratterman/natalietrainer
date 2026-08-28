import "server-only";
import { getSubtopic } from "@/content/taxonomy";
import type { GradeRow, QuestionRow } from "@/lib/db/repo";
import { isMock, parseStructured } from "./client";
import { mockDebrief } from "./mock";
import { debriefSystem } from "./prompts";
import { debriefSchema, type Debrief } from "./schemas";

export async function generateDebrief(
  graded: (GradeRow & { question: QuestionRow })[],
): Promise<Debrief> {
  if (isMock()) {
    const byArea = new Map<string, number[]>();
    for (const g of graded) {
      const areaId = getSubtopic(g.question.subtopicId)?.area.id ?? "unknown";
      byArea.set(areaId, [...(byArea.get(areaId) ?? []), g.overall]);
    }
    const areaScores = [...byArea.entries()].map(([areaId, scores]) => ({
      areaId,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));
    const weakest = [...graded]
      .sort((a, b) => a.overall - b.overall)
      .slice(0, 3)
      .map((g) => g.question.subtopicId);
    return mockDebrief({ areaScores, weakestSubtopics: [...new Set(weakest)] });
  }

  const lines = graded.map((g) => {
    const areaId = getSubtopic(g.question.subtopicId)?.area.id ?? "unknown";
    return [
      `Q${g.question.askedIndex + 1} [area=${areaId} subtopic=${g.question.subtopicId} difficulty=${g.question.difficulty}]`,
      `  question: ${g.question.summary}`,
      `  scores: accuracy=${g.accuracy}/10 completeness=${g.completeness}/10 structure=${g.structure}/10 overall=${g.overall}/100`,
      `  gaps: ${g.feedbackJson.gaps.join("; ") || "none"}`,
      `  corrections: ${g.feedbackJson.corrections.join("; ") || "none"}`,
    ].join("\n");
  });

  return parseStructured(debriefSchema, {
    system: debriefSystem(),
    effort: "high",
    messages: [
      {
        role: "user",
        content: `Session results:\n\n${lines.join("\n\n")}\n\nWrite the debrief. Use the exact subtopic ids shown when naming weaknesses and drills.`,
      },
    ],
  });
}

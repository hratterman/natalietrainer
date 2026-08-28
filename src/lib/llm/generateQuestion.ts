import "server-only";
import type { Archetype } from "@/content/types";
import { getArchetype, getSubtopic } from "@/content/taxonomy";
import { clampDifficulty } from "@/lib/mastery";
import { isMock, parseStructured } from "./client";
import { mockGenerateQuestion, mockRapidBatch } from "./mock";
import { generationSystem, rapidBatchSystem } from "./prompts";
import { questionSchema, rapidBatchSchema, type GeneratedQuestion } from "./schemas";

export type QuestionSpec = {
  subtopicId: string;
  archetypeId: string;
  difficulty: number;
  question: GeneratedQuestion;
  answerFormat: Archetype["answerFormat"];
};

/**
 * Pick an archetype within a subtopic: prefer ones not recently used
 * (approximated by matching recent summaries), weighted toward those whose
 * difficulty range contains the target.
 */
export function selectArchetype(
  subtopicId: string,
  targetDifficulty: number,
  recentSummaries: string[],
  rand: () => number = Math.random,
): Archetype {
  const ref = getSubtopic(subtopicId);
  if (!ref) throw new Error(`unknown subtopic ${subtopicId}`);
  const candidates = ref.subtopic.archetypes;
  const inRange = candidates.filter(
    (a) => targetDifficulty >= a.difficultyRange[0] && targetDifficulty <= a.difficultyRange[1],
  );
  const pool = inRange.length > 0 ? inRange : candidates;
  const recencyPenalty = (a: Archetype) =>
    recentSummaries.filter((s) => s.includes(a.id)).length;
  const weights = pool.map((a) => 1 / (1 + recencyPenalty(a)));
  const total = weights.reduce((x, y) => x + y, 0);
  let roll = rand() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

function archetypeBrief(archetype: Archetype, difficulty: number): string {
  return [
    `ARCHETYPE: ${archetype.name} (${archetype.id})`,
    `WHAT TO TEST AND VARY: ${archetype.description}`,
    archetype.sampleQuestion ? `CANONICAL EXAMPLE OF THE BAR: ${archetype.sampleQuestion}` : "",
    `FOLLOW-UP AXES (for context on what will be probed): ${archetype.followUpAxes.join(" | ")}`,
    `ANSWER FORMAT: ${archetype.answerFormat}`,
    `TARGET DIFFICULTY: ${difficulty}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateQuestion(input: {
  subtopicId: string;
  archetypeId?: string;
  difficulty: number;
  recentSummaries: string[];
  rand?: () => number;
}): Promise<QuestionSpec> {
  const archetype = input.archetypeId
    ? getArchetype(input.archetypeId)?.archetype
    : selectArchetype(input.subtopicId, input.difficulty, input.recentSummaries, input.rand);
  if (!archetype) throw new Error(`unknown archetype ${input.archetypeId}`);
  const difficulty = clampDifficulty(input.difficulty, archetype.difficultyRange);

  if (isMock()) {
    return {
      subtopicId: input.subtopicId,
      archetypeId: archetype.id,
      difficulty,
      answerFormat: archetype.answerFormat,
      question: mockGenerateQuestion(archetype, difficulty, input.recentSummaries.length),
    };
  }

  const question = await parseStructured(questionSchema, {
    system: generationSystem(),
    effort: "high",
    messages: [
      {
        role: "user",
        content: [
          archetypeBrief(archetype, difficulty),
          input.recentSummaries.length > 0
            ? `RECENTLY ASKED (do NOT resemble any of these):\n${input.recentSummaries
                .map((s) => `- ${s}`)
                .join("\n")}`
            : "No recent questions for this subtopic.",
          "Write the question now.",
        ].join("\n\n"),
      },
    ],
  });

  return {
    subtopicId: input.subtopicId,
    archetypeId: archetype.id,
    difficulty,
    answerFormat: archetype.answerFormat,
    question,
  };
}

/**
 * Rapid-fire batches are generated in one structured call so per-question
 * latency during the round is zero.
 */
export async function generateRapidBatch(input: {
  subtopicIds: string[];
  count: number;
  difficulty: number;
  recentSummaries: string[];
}): Promise<QuestionSpec[]> {
  const archetypes: Archetype[] = [];
  const bySubtopic = new Map<string, string>();
  for (const subtopicId of input.subtopicIds) {
    const ref = getSubtopic(subtopicId);
    if (!ref) continue;
    for (const a of ref.subtopic.archetypes) {
      // Rapid-fire favors short/numeric archetypes but falls back to any.
      archetypes.push(a);
      bySubtopic.set(a.id, subtopicId);
    }
  }
  const rapidFriendly = archetypes.filter(
    (a) => a.answerFormat === "numeric" || a.answerFormat === "short",
  );
  const pool = rapidFriendly.length >= 2 ? rapidFriendly : archetypes;
  if (pool.length === 0) throw new Error("no archetypes available for rapid batch");

  if (isMock()) {
    const batch = mockRapidBatch(pool, input.count, input.recentSummaries.length);
    return batch.questions.map((question, i) => {
      const archetype = pool[i % pool.length]!;
      return {
        subtopicId: bySubtopic.get(archetype.id)!,
        archetypeId: archetype.id,
        difficulty: clampDifficulty(input.difficulty, archetype.difficultyRange),
        answerFormat: archetype.answerFormat,
        question,
      };
    });
  }

  const briefs = pool
    .map((a) => `${a.id}: ${a.name} — ${a.description.slice(0, 240)}`)
    .join("\n");
  const batch = await parseStructured(rapidBatchSchema, {
    system: rapidBatchSystem(),
    effort: "high",
    maxTokens: 16000,
    messages: [
      {
        role: "user",
        content: [
          `Write ${input.count} rapid-fire questions at difficulty ${input.difficulty}, spread across these archetypes:`,
          briefs,
          input.recentSummaries.length > 0
            ? `RECENTLY ASKED (do NOT resemble):\n${input.recentSummaries.map((s) => `- ${s}`).join("\n")}`
            : "",
          `In each question's summary field, start with the archetype id you used, then the fingerprint.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  });

  return batch.questions.slice(0, input.count).map((question, i) => {
    // Recover the archetype from the summary prefix; fall back round-robin.
    const matched =
      pool.find((a) => question.summary.startsWith(a.id)) ?? pool[i % pool.length]!;
    return {
      subtopicId: bySubtopic.get(matched.id)!,
      archetypeId: matched.id,
      difficulty: clampDifficulty(input.difficulty, matched.difficultyRange),
      answerFormat: matched.answerFormat,
      question,
    };
  });
}

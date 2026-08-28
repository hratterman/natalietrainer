import "server-only";
import type { Archetype } from "@/content/types";
import type { Debrief, GeneratedQuestion, GeneratedRapidBatch, Grade } from "./schemas";

/**
 * Deterministic fixtures used when LLM_MOCK=1 — free offline dev and tests.
 * Shapes match the real orchestration functions exactly, so routes and UI
 * cannot tell the difference.
 */

export function mockGenerateQuestion(
  archetype: Archetype,
  difficulty: number,
  seed: number,
): GeneratedQuestion {
  const n = 10 + (seed % 5) * 10;
  return {
    questionText:
      archetype.sampleQuestion ??
      `[MOCK d${difficulty}] ${archetype.name}: walk me through it with $${n} and a 25% tax rate.`,
    setupFacts: [`Amount: $${n}`, "Tax rate: 25%"],
    expectedKeyPoints: [
      `Correct direction on each statement for ${archetype.name}`,
      `Net cash change computed with $${n} input`,
    ],
    summary: `mock ${archetype.id} d${difficulty} n=${n} seed=${seed}`,
  };
}

export function mockRapidBatch(
  archetypes: Archetype[],
  count: number,
  seed: number,
): GeneratedRapidBatch {
  const questions: GeneratedQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const archetype = archetypes[i % archetypes.length]!;
    questions.push(mockGenerateQuestion(archetype, 3, seed + i));
  }
  return { questions };
}

export function mockGrade(answerLength: number, voice = false): Grade {
  // Deterministic but varies with answer length so the UI shows a range.
  const base = Math.min(9, 4 + Math.floor(answerLength / 80));
  return {
    accuracy: base,
    completeness: Math.max(2, base - 1),
    structure: Math.min(10, base + 1),
    delivery: voice ? Math.max(1, base - 2) : null,
    missedConcept: base < 7 ? "[MOCK] balance check tie-out" : null,
    deliveryFeedback: voice
      ? [
          "[MOCK] Lead with the roadmap before the walk.",
          "[MOCK] Pace held up; trim the hedges in the opening sentence.",
        ]
      : [],
    overall: base * 10,
    modelAnswer:
      "[MOCK model answer] Start on the income statement: pre-tax income falls $10, taxes fall $2.50, net income falls $7.50. On the cash flow statement, net income is down $7.50 but the $10 is added back as non-cash, so cash rises $2.50. On the balance sheet, cash +$2.50, PP&E -$10, retained earnings -$7.50 — balanced.",
    strengths: ["[MOCK] Correct statement order", "[MOCK] Signs consistent"],
    gaps: ["[MOCK] Did not state the final balance check"],
    corrections: ["[MOCK] You said cash falls; cash rises $2.50 because the add-back exceeds the NI hit."],
  };
}

export function mockInterviewerOpen(input: {
  questionText: string;
  isRoundStart: boolean;
  greeting: string | undefined;
}): string {
  const greet = input.isRoundStart && input.greeting ? `${input.greeting} ` : "";
  return `{"action":"ask"}\n${greet}Here's one for you: ${input.questionText}`;
}

export function mockInterviewerReply(turnCount: number, maxFollowUps: number): string {
  if (turnCount >= maxFollowUps) {
    return '{"action":"wrapup"}\nAlright, let\'s move on.';
  }
  const followups = [
    "Okay — but what if it's cash-financed instead? Walk me through what changes.",
    "You gave me the direction. Give me the number.",
    "And why does that happen? Take me one level deeper.",
  ];
  return `{"action":"followup"}\n${followups[turnCount % followups.length]}`;
}

export function mockDebrief(input: {
  areaScores: { areaId: string; score: number }[];
  weakestSubtopics: string[];
}): Debrief {
  const overall =
    input.areaScores.length > 0
      ? Math.round(
          input.areaScores.reduce((a, b) => a + b.score, 0) / input.areaScores.length,
        )
      : 0;
  return {
    overallScore: overall,
    byArea: input.areaScores.map((a) => ({
      areaId: a.areaId,
      score: a.score,
      comment: `[MOCK] Solid mechanics, inconsistent under follow-up pressure in ${a.areaId}.`,
    })),
    topStrengths: ["[MOCK] Statement-order discipline", "[MOCK] Clean arithmetic"],
    topWeaknesses: input.weakestSubtopics.map((subtopicId) => ({
      subtopicId,
      why: "[MOCK] Signs flipped under time pressure.",
    })),
    drillPlan: input.weakestSubtopics.map((subtopicId) => ({
      subtopicId,
      difficulty: 3,
      rationale: "[MOCK] Rebuild mechanics at difficulty 3 before re-testing at 4.",
    })),
  };
}

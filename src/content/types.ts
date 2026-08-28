import { z } from "zod";

/**
 * Difficulty ladder (applies to every archetype):
 *
 *  1 — definition / concept recall
 *  2 — single-step mechanic (one adjustment, one formula application)
 *  3 — multi-step walkthrough with concrete numbers
 *  4 — combined concepts, edge case, or timed arithmetic
 *  5 — superday-hard: multi-part, adversarial twist, expects the "why"
 *      behind every step
 */
export const DIFFICULTY_MIN = 1;
export const DIFFICULTY_MAX = 5;

/**
 * How the candidate is expected to answer, which drives both the in-session
 * UI and the grading anchors:
 *
 *  - walkthrough:    multi-step typed answer talking through mechanics/numbers
 *  - numeric:        a single number or short calculation under a tight timer
 *  - short:          one-to-three sentence answer (rapid-fire staple)
 *  - longform:       structured long answer (e.g. a stock pitch)
 *  - conversational: behavioral-style multi-turn exchange
 */
export const ANSWER_FORMATS = [
  "walkthrough",
  "numeric",
  "short",
  "longform",
  "conversational",
] as const;
export type AnswerFormat = (typeof ANSWER_FORMATS)[number];

export const archetypeSchema = z.object({
  /** Globally unique, prefixed with the area id, e.g. "acct.cascades.dep-change". */
  id: z.string().min(1),
  name: z.string().min(1),
  /**
   * The generation seed: what the question tests, the mechanics involved,
   * and what the generator should vary between instances.
   */
  description: z.string().min(20),
  difficultyRange: z.tuple([
    z.number().int().min(DIFFICULTY_MIN).max(DIFFICULTY_MAX),
    z.number().int().min(DIFFICULTY_MIN).max(DIFFICULTY_MAX),
  ]),
  /** Dimensions a real interviewer pushes on in follow-ups. */
  followUpAxes: z.array(z.string().min(1)).min(2),
  answerFormat: z.enum(ANSWER_FORMATS),
  /** Canonical hard example that grounds the LLM's sense of the bar. */
  sampleQuestion: z.string().optional(),
});
export type Archetype = z.infer<typeof archetypeSchema>;

export const subtopicSchema = z.object({
  /** Globally unique, prefixed with the area id, e.g. "acct.cascades". */
  id: z.string().min(1),
  name: z.string().min(1),
  archetypes: z.array(archetypeSchema).min(2),
});
export type Subtopic = z.infer<typeof subtopicSchema>;

export const areaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** 1 = core superday material; 2 = full-canon breadth. */
  tier: z.union([z.literal(1), z.literal(2)]),
  /**
   * Relative sampling weight when a session mixes areas. Tier-1 areas carry
   * high weights so they dominate mixed sessions.
   */
  weight: z.number().positive(),
  subtopics: z.array(subtopicSchema).min(1),
});
export type Area = z.infer<typeof areaSchema>;

import { z } from "zod";

/** Output of question generation. */
export const questionSchema = z.object({
  questionText: z.string().describe("The question exactly as the interviewer would ask it."),
  setupFacts: z
    .array(z.string())
    .describe("Given numbers/assumptions the candidate can reference, one per entry. Empty if none."),
  expectedKeyPoints: z
    .array(z.string())
    .describe("The specific points, numbers, and directions a top answer must contain."),
  summary: z
    .string()
    .describe(
      "One-line fingerprint of this question's setup and numbers, used to avoid generating near-duplicates later.",
    ),
});
export type GeneratedQuestion = z.infer<typeof questionSchema>;

/** Output of rapid-fire batch generation. */
export const rapidBatchSchema = z.object({
  questions: z.array(questionSchema),
});
export type GeneratedRapidBatch = z.infer<typeof rapidBatchSchema>;

/** Output of grading. */
export const gradeSchema = z.object({
  accuracy: z
    .number()
    .min(0)
    .max(10)
    .describe("0-10. 10 = every number, direction, and mechanic correct; 5 = right framework, wrong arithmetic; 0 = wrong framework."),
  completeness: z
    .number()
    .min(0)
    .max(10)
    .describe("0-10. Did the answer cover every expected key point and follow-up?"),
  structure: z
    .number()
    .min(0)
    .max(10)
    .describe("0-10. Communication: ordered, confident, interview-ready delivery."),
  delivery: z
    .number()
    .min(0)
    .max(10)
    .nullable()
    .describe(
      "Spoken answers only: 0-10 for framing, pace, fillers, and composure per the delivery anchors. MUST be null for typed transcripts.",
    ),
  overall: z
    .number()
    .min(0)
    .max(100)
    .describe("0-100 holistic score calibrated to a superday bar: 80+ = offer-quality answer."),
  modelAnswer: z
    .string()
    .describe("The complete answer a top candidate would give, with all numbers worked."),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()).describe("Specific missing points or errors."),
  corrections: z
    .array(z.string())
    .describe("Concrete corrections: 'you said X; the right answer is Y because Z'."),
  deliveryFeedback: z
    .array(z.string())
    .describe(
      "Spoken answers only: specific delivery feedback (framing, fillers, pace, composure). Empty array for typed transcripts.",
    ),
  missedConcept: z
    .string()
    .nullable()
    .describe(
      "If the answer fell short of the bar: the ONE core concept or mechanic the candidate most needs to relearn, as a 3-8 word label (e.g. 'deferred tax impact on the cash walk'). Null when the answer met the bar.",
    ),
});
export type Grade = z.infer<typeof gradeSchema>;

/** Output of the session debrief. */
export const debriefSchema = z.object({
  overallScore: z.number().min(0).max(100),
  byArea: z.array(
    z.object({
      areaId: z.string(),
      score: z.number().min(0).max(100),
      comment: z.string(),
    }),
  ),
  topStrengths: z.array(z.string()),
  topWeaknesses: z.array(
    z.object({
      subtopicId: z.string(),
      why: z.string(),
    }),
  ),
  drillPlan: z.array(
    z.object({
      subtopicId: z.string(),
      difficulty: z.number().min(1).max(5),
      rationale: z.string(),
    }),
  ),
});
export type Debrief = z.infer<typeof debriefSchema>;

/** Booklet recall verdict — deliberately small; the canon answer is the feedback. */
export const bookletVerdictSchema = z.object({
  verdict: z
    .enum(["right", "partial", "wrong"])
    .describe(
      "right = would fully satisfy an interviewer; partial = right direction but missing a key point or materially imprecise; wrong = the core is missing or incorrect.",
    ),
  missing: z
    .array(z.string())
    .max(3)
    .describe(
      "The specific points missed or gotten wrong, each one short line. Empty when the verdict is right.",
    ),
  note: z
    .string()
    .describe(
      "One tight coaching line: the single most useful correction or sharpening. For a right answer, the one thing that would make it even crisper.",
    ),
});
export type BookletVerdictResult = z.infer<typeof bookletVerdictSchema>;

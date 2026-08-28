import "server-only";
import type { FixitRow, GradeRow, QuestionRow, TurnRow } from "@/lib/db/repo";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta";
import { isMock, streamText } from "./client";
import { ControlLineBuffer, splitControlLine, type InterviewerAction } from "./controlLine";
import { coachSystem } from "./prompts";
import { mockCoachReply } from "./mock";
import { transcriptText } from "./grade";

export type CoachTurnResult = {
  action: InterviewerAction; // "coach" | "check"
  spoken: string;
};

/**
 * Build the coach conversation. The anchor context (the missed question, her
 * transcript, the grade) is the first user message; prior lesson turns replay
 * as alternating assistant/user messages so the cache prefix accrues per
 * conversation, exactly like the interviewer.
 */
export function buildCoachMessages(input: {
  sourceQuestion: QuestionRow;
  sourceTurns: TurnRow[];
  sourceGrade: GradeRow;
  fixit: FixitRow;
  priorLessonTurns: TurnRow[];
  /** Her latest message, or null for the coach's opening. */
  latestMessage: string | null;
}): BetaMessageParam[] {
  const g = input.sourceGrade;
  const anchorContext = [
    `THE QUESTION SHE MISSED (difficulty ${input.sourceQuestion.difficulty}, format ${input.sourceQuestion.answerFormat}):`,
    input.sourceQuestion.promptText,
    input.sourceQuestion.setupFactsJson.length > 0
      ? `SETUP FACTS:\n${input.sourceQuestion.setupFactsJson.map((f) => `- ${f}`).join("\n")}`
      : "",
    `EXPECTED KEY POINTS:\n${input.sourceQuestion.expectedKeyPointsJson.map((p) => `- ${p}`).join("\n")}`,
    `HER FULL TRANSCRIPT (with the interviewer):\n${transcriptText(input.sourceTurns)}`,
    `GRADE: overall ${g.overall} — accuracy ${g.accuracy}/10, completeness ${g.completeness}/10, structure ${g.structure}/10`,
    `THE CONCEPT TO FIX: ${input.fixit.concept}`,
    g.feedbackJson.gaps.length > 0
      ? `GRADER'S GAPS:\n${g.feedbackJson.gaps.map((x) => `- ${x}`).join("\n")}`
      : "",
    g.feedbackJson.corrections.length > 0
      ? `GRADER'S CORRECTIONS:\n${g.feedbackJson.corrections.map((x) => `- ${x}`).join("\n")}`
      : "",
    `MODEL ANSWER (yours to teach from — do not dump it unprompted):\n${g.modelAnswer}`,
    "Begin the lesson: greet her briefly, name what she got right, and start on the concept.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages: BetaMessageParam[] = [{ role: "user", content: anchorContext }];
  for (const turn of input.priorLessonTurns) {
    messages.push({
      role: turn.role === "interviewer" ? "assistant" : "user",
      content: turn.content,
    });
  }
  if (input.latestMessage !== null) {
    messages.push({ role: "user", content: input.latestMessage });
  }
  return messages;
}

/** One coach turn. Yields streamed text; returns the parsed action + full text. */
export async function* coachTurn(input: {
  sourceQuestion: QuestionRow;
  sourceTurns: TurnRow[];
  sourceGrade: GradeRow;
  fixit: FixitRow;
  priorLessonTurns: TurnRow[];
  latestMessage: string | null;
}): AsyncGenerator<string, CoachTurnResult> {
  if (isMock()) {
    const coachTurnsSoFar = input.priorLessonTurns.filter((t) => t.role === "interviewer").length;
    const raw = mockCoachReply(coachTurnsSoFar, input.fixit.concept);
    const { action, spoken } = splitControlLine(raw);
    for (let i = 0; i < spoken.length; i += 12) {
      yield spoken.slice(i, i + 12);
      await new Promise((r) => setTimeout(r, 10));
    }
    return { action, spoken };
  }

  const stream = streamText({
    system: coachSystem(),
    effort: "medium",
    messages: buildCoachMessages(input),
  });
  const buffer = new ControlLineBuffer("coach");
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      const spoken = buffer.push(event.delta.text);
      if (spoken) yield spoken;
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    const spoken = "Let's keep working through it — where did I lose you?";
    yield spoken;
    return { action: "coach", spoken };
  }
  return buffer.result();
}

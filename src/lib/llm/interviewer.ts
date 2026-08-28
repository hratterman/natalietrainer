import "server-only";
import type { QuestionRow, TurnRow } from "@/lib/db/repo";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta";
import { isMock, streamText } from "./client";
import { ControlLineBuffer, splitControlLine, type InterviewerAction } from "./controlLine";
import { interviewerSystem } from "./prompts";
import { mockInterviewerReply } from "./mock";

export type InterviewerTurnResult = {
  action: InterviewerAction;
  spoken: string;
};

/**
 * Build the messages array for an interviewer turn. The question context is
 * the first user message; prior turns replay as alternating assistant/user
 * messages (interviewer spoken text only — the control line is a per-reply
 * output requirement, not history). The latest candidate answer arrives as
 * the final user message, so the cache prefix grows monotonically.
 */
export function buildInterviewerMessages(
  question: QuestionRow,
  priorTurns: TurnRow[],
  latestAnswer: { answer: string; scratchpad?: string | null },
): BetaMessageParam[] {
  const messages: BetaMessageParam[] = [
    {
      role: "user",
      content: [
        `CURRENT QUESTION (difficulty ${question.difficulty}, format ${question.answerFormat}):`,
        question.promptText,
        question.setupFactsJson.length > 0
          ? `SETUP FACTS:\n${question.setupFactsJson.map((f) => `- ${f}`).join("\n")}`
          : "",
        `EXPECTED KEY POINTS (yours only — never reveal):\n${question.expectedKeyPointsJson
          .map((p) => `- ${p}`)
          .join("\n")}`,
        "The candidate will now answer. Respond per the output protocol.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  for (const turn of priorTurns) {
    if (turn.role === "candidate") {
      messages.push({ role: "user", content: turn.content });
    } else {
      messages.push({ role: "assistant", content: turn.content });
    }
  }

  const scratch = latestAnswer.scratchpad
    ? `\n\n[my scratchpad, not spoken aloud]\n${latestAnswer.scratchpad}`
    : "";
  messages.push({ role: "user", content: `${latestAnswer.answer}${scratch}` });
  return messages;
}

/**
 * Run one interviewer turn. Yields spoken-text deltas as they stream; the
 * generator's return value carries the parsed action and full spoken text.
 * When `forceWrapup` is set (follow-up cap reached), no model call is made.
 */
export async function* interviewerTurn(input: {
  mode: string;
  personaId: string | null;
  question: QuestionRow;
  priorTurns: TurnRow[];
  answer: string;
  scratchpad?: string | null;
  forceWrapup: boolean;
}): AsyncGenerator<string, InterviewerTurnResult> {
  if (input.forceWrapup) {
    const spoken = "Alright, let's move on.";
    yield spoken;
    return { action: "wrapup", spoken };
  }

  if (isMock()) {
    const followUpsUsed = input.priorTurns.filter((t) => t.role === "interviewer").length;
    const cap = input.mode === "drill" ? 1 : input.mode === "rapid" ? 0 : 3;
    const raw = mockInterviewerReply(followUpsUsed, cap);
    const { action, spoken } = splitControlLine(raw);
    // Fake-stream in small chunks so the UI's streaming path is exercised.
    for (let i = 0; i < spoken.length; i += 12) {
      yield spoken.slice(i, i + 12);
      await new Promise((r) => setTimeout(r, 15));
    }
    return { action, spoken };
  }

  const stream = streamText({
    system: interviewerSystem(input.mode, input.personaId),
    effort: "medium",
    messages: buildInterviewerMessages(input.question, input.priorTurns, {
      answer: input.answer,
      scratchpad: input.scratchpad,
    }),
  });

  const buffer = new ControlLineBuffer();
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      const spoken = buffer.push(event.delta.text);
      if (spoken) yield spoken;
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    const spoken = "Let's move to the next question.";
    yield spoken;
    return { action: "wrapup", spoken };
  }
  return buffer.result();
}

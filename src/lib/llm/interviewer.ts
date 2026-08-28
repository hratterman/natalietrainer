import "server-only";
import type { QuestionRow, TurnRow } from "@/lib/db/repo";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta";
import { isMock, streamText } from "./client";
import { ControlLineBuffer, splitControlLine, type InterviewerAction } from "./controlLine";
import { interviewerSystem, openSystem } from "./prompts";
import { getPersona } from "./personas";
import { mockInterviewerOpen, mockInterviewerReply } from "./mock";

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
      // Interruption flags are set before a turn is ever replayed, so this
      // annotation is byte-stable across the question's later turns.
      const note =
        turn.interruption === "cut_off"
          ? "\n\n[you cut the candidate off mid-answer here]"
          : turn.interruption === "barge_in"
            ? "\n\n[the candidate talked over you to say this]"
            : "";
      messages.push({ role: "user", content: `${turn.content}${note}` });
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
  voice?: boolean;
}): AsyncGenerator<string, InterviewerTurnResult> {
  if (input.forceWrapup) {
    const spoken = "Alright, let's move on.";
    yield spoken;
    return { action: "wrapup", spoken };
  }

  if (isMock()) {
    // Openings (turnIndex 0) and canned interjections don't consume follow-ups.
    const followUpsUsed = input.priorTurns.filter(
      (t) => t.role === "interviewer" && t.turnIndex > 0 && t.interruption !== "interjection",
    ).length;
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
    system: interviewerSystem(input.mode, input.personaId, input.voice ?? false),
    effort: "medium",
    messages: buildInterviewerMessages(input.question, input.priorTurns, {
      answer: input.answer,
      scratchpad: input.scratchpad,
    }),
  });
  return yield* drainInterviewerStream(stream);
}

/**
 * The spoken opening of a question: persona greeting/small talk when a
 * session or round starts, then the question asked naturally. Voice mode
 * only. Yields spoken deltas; returns the parsed result.
 */
export async function* interviewerOpen(input: {
  personaId: string | null;
  question: QuestionRow;
  isSessionStart: boolean;
  isRoundStart: boolean;
}): AsyncGenerator<string, InterviewerTurnResult> {
  const persona = getPersona(input.personaId);

  if (isMock()) {
    const raw = mockInterviewerOpen({
      questionText: input.question.promptText,
      isRoundStart: input.isSessionStart || input.isRoundStart,
      greeting: persona.greetings[0],
    });
    const { action, spoken } = splitControlLine(raw);
    for (let i = 0; i < spoken.length; i += 12) {
      yield spoken.slice(i, i + 12);
      await new Promise((r) => setTimeout(r, 15));
    }
    return { action, spoken };
  }

  const position = input.isSessionStart
    ? "This is the very start of the interview — greet the candidate first."
    : input.isRoundStart
      ? "A new round just started and you are a fresh interviewer meeting the candidate — greet them briefly first."
      : "You are mid-round — no greeting, just a short transition into the question.";

  const stream = streamText({
    system: openSystem(input.personaId),
    effort: "low",
    messages: [
      {
        role: "user",
        content: [
          position,
          `SAMPLE GREETING LINES FOR YOUR PERSONA (inspiration, not scripture):\n${persona.greetings
            .map((g) => `- ${g}`)
            .join("\n")}`,
          `WRITTEN QUESTION (difficulty ${input.question.difficulty}):\n${input.question.promptText}`,
          input.question.setupFactsJson.length > 0
            ? `SETUP FACTS TO WEAVE INTO SPEECH:\n${input.question.setupFactsJson
                .map((f) => `- ${f}`)
                .join("\n")}`
            : "",
          "Open the question now, per the output protocol.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  });
  return yield* drainInterviewerStream(stream);
}

async function* drainInterviewerStream(
  stream: ReturnType<typeof streamText>,
): AsyncGenerator<string, InterviewerTurnResult> {
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

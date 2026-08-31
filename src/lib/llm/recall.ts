import "server-only";
import type { BookletItem } from "@/lib/booklet/types";
import { isMock, parseStructured } from "./client";
import { mockBookletVerdict } from "./mock";
import { bookletGraderSystem } from "./prompts";
import { bookletVerdictSchema, type BookletVerdictResult } from "./schemas";

/** Grade one booklet recall attempt against the canonical answer. */
export async function gradeRecall(
  item: BookletItem,
  answer: string,
): Promise<BookletVerdictResult> {
  if (isMock()) return mockBookletVerdict(answer.length);

  return parseStructured(bookletVerdictSchema, {
    system: bookletGraderSystem(),
    effort: "medium",
    maxTokens: 2000,
    messages: [
      {
        role: "user",
        content: [
          `QUESTION (${item.sectionName}):`,
          item.question,
          `CANONICAL ANSWER:\n${item.answer}`,
          `HER RECALL (typed from memory):\n${answer}`,
          "Give the verdict now.",
        ].join("\n\n"),
      },
    ],
  });
}

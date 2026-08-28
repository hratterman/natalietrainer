import "server-only";
import type { QuestionRow, TurnRow } from "@/lib/db/repo";
import { isMock, parseStructured } from "./client";
import { mockGrade } from "./mock";
import { graderSystem } from "./prompts";
import { gradeSchema, type Grade } from "./schemas";

export function transcriptText(turns: TurnRow[]): string {
  return turns
    .map((t) => {
      const speaker = t.role === "interviewer" ? "INTERVIEWER" : "CANDIDATE";
      const scratch = t.scratchpad ? `\n[candidate scratchpad]\n${t.scratchpad}` : "";
      const elapsed = t.elapsedMs != null ? ` (answered in ${Math.round(t.elapsedMs / 1000)}s)` : "";
      return `${speaker}${elapsed}: ${t.content}${scratch}`;
    })
    .join("\n\n");
}

export async function gradeQuestion(question: QuestionRow, turns: TurnRow[]): Promise<Grade> {
  if (isMock()) {
    const candidateChars = turns
      .filter((t) => t.role === "candidate")
      .reduce((n, t) => n + t.content.length, 0);
    return mockGrade(candidateChars);
  }

  return parseStructured(gradeSchema, {
    system: graderSystem(),
    effort: "high",
    messages: [
      {
        role: "user",
        content: [
          `QUESTION (difficulty ${question.difficulty}, format ${question.answerFormat}):`,
          question.promptText,
          question.setupFactsJson.length > 0
            ? `SETUP FACTS:\n${question.setupFactsJson.map((f) => `- ${f}`).join("\n")}`
            : "",
          `EXPECTED KEY POINTS:\n${question.expectedKeyPointsJson.map((p) => `- ${p}`).join("\n")}`,
          `TRANSCRIPT:\n${transcriptText(turns)}`,
          "Grade the candidate now.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  });
}

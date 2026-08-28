/**
 * One real API round trip: generate a question, grade a canned answer, and
 * verify the prompt-cache architecture hits on a second interviewer-style
 * call. Run after any SDK or prompt change:
 *
 *   npm run smoke:llm
 *
 * Requires ANTHROPIC_API_KEY (reads .env.local). Refuses to run under LLM_MOCK.
 */
import fs from "node:fs";
import path from "node:path";

// Minimal .env.local loader (no dotenv dependency).
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && m[1] && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
}

if (process.env.LLM_MOCK === "1") {
  console.error("LLM_MOCK=1 is set — unset it to smoke-test the real API.");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set (checked env and .env.local).");
  process.exit(1);
}

async function main() {
  const { generateQuestion } = await import("../src/lib/llm/generateQuestion");
  const { streamText, MODEL } = await import("../src/lib/llm/client");
  const { interviewerSystem } = await import("../src/lib/llm/prompts");
  const { gradeSchema } = await import("../src/lib/llm/schemas");
  const { parseStructured } = await import("../src/lib/llm/client");
  const { graderSystem } = await import("../src/lib/llm/prompts");

  console.log(`model: ${MODEL}`);

  // 1. Generate a question (structured output + fallbacks param acceptance).
  console.log("\n[1/3] generating a question (acct.cascades, difficulty 4)...");
  const spec = await generateQuestion({
    subtopicId: "acct.cascades",
    difficulty: 4,
    recentSummaries: [],
  });
  console.log(`  archetype: ${spec.archetypeId}`);
  console.log(`  question: ${spec.question.questionText.slice(0, 160)}...`);
  console.log(`  keyPoints: ${spec.question.expectedKeyPoints.length}`);
  if (!spec.question.questionText || spec.question.expectedKeyPoints.length === 0) {
    throw new Error("generation smoke failed: empty question or key points");
  }

  // 2. Grade a canned answer (structured output round trip).
  console.log("\n[2/3] grading a canned answer...");
  const grade = await parseStructured(gradeSchema, {
    system: graderSystem(),
    effort: "high",
    messages: [
      {
        role: "user",
        content: `QUESTION (difficulty 4, format walkthrough):\n${spec.question.questionText}\n\nEXPECTED KEY POINTS:\n${spec.question.expectedKeyPoints.map((p) => `- ${p}`).join("\n")}\n\nTRANSCRIPT:\nCANDIDATE: Net income falls by the after-tax amount, cash rises by the tax shield, and the balance sheet ties out.\n\nGrade the candidate now.`,
      },
    ],
  });
  console.log(`  overall: ${grade.overall}/100 accuracy=${grade.accuracy}/10`);
  if (typeof grade.overall !== "number") throw new Error("grade smoke failed");

  // 3. Two interviewer-style streaming calls with an identical system prefix —
  //    the second must report cache_read_input_tokens > 0.
  console.log("\n[3/3] verifying prompt-cache hits on the interviewer prefix...");
  const system = interviewerSystem("mock", "quant");
  const ask = (answer: string) =>
    streamText({
      system,
      effort: "medium",
      messages: [
        {
          role: "user",
          content: `CURRENT QUESTION: ${spec.question.questionText}\n\nCANDIDATE ANSWER: ${answer}\n\nRespond per the output protocol.`,
        },
      ],
    });

  const first = await ask("Net income falls $7.50 and cash rises $2.50.").finalMessage();
  const second = await ask("Actually, I want to redo it: start on the income statement...").finalMessage();
  const cacheRead = second.usage.cache_read_input_tokens ?? 0;
  console.log(`  first call:  cache_creation=${first.usage.cache_creation_input_tokens ?? 0}`);
  console.log(`  second call: cache_read=${cacheRead}`);
  if (cacheRead <= 0) {
    throw new Error(
      "cache smoke failed: second call read 0 cached tokens — a silent invalidator is in the prompt architecture",
    );
  }

  console.log("\nsmoke: all checks passed.");
}

main().catch((err) => {
  console.error("\nsmoke failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});

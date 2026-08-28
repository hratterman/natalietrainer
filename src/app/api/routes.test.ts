import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "natalie-routes-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "test.db");
  process.env.LLM_MOCK = "1";
});

afterEach(async () => {
  const { resetDbForTests } = await import("@/lib/db/index");
  resetDbForTests();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATABASE_PATH;
});

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function readSse(response: Response): Promise<{ deltas: string[]; done: unknown }> {
  const text = await response.text();
  const deltas: string[] = [];
  let done: unknown = null;
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = JSON.parse(line.slice(6)) as { type: string; text?: string };
    if (payload.type === "delta") deltas.push(payload.text ?? "");
    if (payload.type === "done") done = payload;
    if (payload.type === "error") throw new Error(JSON.stringify(payload));
  }
  return { deltas, done };
}

describe("drill lifecycle via routes (LLM_MOCK)", () => {
  it("create → answer (SSE) → grade → next → complete", async () => {
    const { POST: createSession } = await import("./sessions/route");
    const { GET: getSession } = await import("./sessions/[id]/route");
    const { POST: answer } = await import("./sessions/[id]/answer/route");
    const { POST: grade } = await import("./sessions/[id]/grade/route");
    const { POST: next } = await import("./sessions/[id]/next/route");
    const { POST: complete } = await import("./sessions/[id]/complete/route");
    const repo = await import("@/lib/db/repo");

    // create
    const createRes = await createSession(
      jsonRequest("http://test/api/sessions", {
        mode: "drill",
        config: {
          subtopicIds: ["acct.cascades"],
          areaIds: ["acct"],
          difficulty: 4,
          questionCount: 2,
          personaId: null,
          secondsPerQuestion: null,
          rounds: null,
        },
      }),
    );
    expect(createRes.status).toBe(200);
    const { sessionId } = (await createRes.json()) as { sessionId: string };

    // state has the first question
    const stateRes = await getSession(new Request("http://test"), ctx(sessionId));
    const state = (await stateRes.json()) as {
      activeQuestionId: string;
      questions: { id: string; promptText: string }[];
      followUpCap: number;
    };
    expect(state.questions).toHaveLength(1);
    expect(state.followUpCap).toBe(1);
    const questionId = state.activeQuestionId;
    expect(questionId).toBeTruthy();

    // answer #1 → interviewer follow-up streams back (drill cap = 1)
    const answerRes = await answer(
      jsonRequest(`http://test/api/sessions/${sessionId}/answer`, {
        questionId,
        answer: "Net income falls $7.50, cash rises $2.50, balance sheet ties.",
        scratchpad: "10 * .75",
        elapsedMs: 42_000,
      }),
      ctx(sessionId),
    );
    expect(answerRes.headers.get("Content-Type")).toContain("text/event-stream");
    const sse1 = await readSse(answerRes);
    expect(sse1.deltas.join("").length).toBeGreaterThan(0);
    expect((sse1.done as { action: string }).action).toBe("followup");

    // answer #2 → cap reached → forced wrapup
    const answerRes2 = await answer(
      jsonRequest(`http://test/api/sessions/${sessionId}/answer`, {
        questionId,
        answer: "With cash financing, foregone interest income replaces interest expense.",
      }),
      ctx(sessionId),
    );
    const sse2 = await readSse(answerRes2);
    expect((sse2.done as { action: string }).action).toBe("wrapup");
    expect((sse2.done as { questionStatus: string }).questionStatus).toBe("answered");

    // grade
    const gradeRes = await grade(
      jsonRequest(`http://test/api/sessions/${sessionId}/grade`, { questionId }),
      ctx(sessionId),
    );
    expect(gradeRes.status).toBe(200);
    const gradeBody = (await gradeRes.json()) as { grade: { overall: number } };
    expect(gradeBody.grade.overall).toBeGreaterThan(0);
    expect(repo.getMasteryForSubtopic("acct.cascades")?.attempts).toBe(1);

    // next → question 2
    const nextRes = await next(new Request("http://test", { method: "POST" }), ctx(sessionId));
    const nextBody = (await nextRes.json()) as { done: boolean; question?: { id: string } };
    expect(nextBody.done).toBe(false);

    // answer question 2 then complete (grades stragglers + debrief)
    const q2 = nextBody.question!.id;
    const a3 = await answer(
      jsonRequest(`http://test/api/sessions/${sessionId}/answer`, {
        questionId: q2,
        answer: "Walking through all three statements: ...",
      }),
      ctx(sessionId),
    );
    await readSse(a3);

    const completeRes = await complete(new Request("http://test", { method: "POST" }), ctx(sessionId));
    expect(completeRes.status).toBe(200);
    const completeBody = (await completeRes.json()) as {
      debrief: { overallScore: number; drillPlan: unknown[] };
    };
    expect(completeBody.debrief.overallScore).toBeGreaterThan(0);
    expect(repo.getSession(sessionId)?.status).toBe("completed");

    // completing again returns the stored debrief
    const completeAgain = await complete(new Request("http://test", { method: "POST" }), ctx(sessionId));
    expect(((await completeAgain.json()) as { debrief: unknown }).debrief).toBeTruthy();
  });

  it("rapid mode: batch created upfront, answers return JSON, complete batch-grades", async () => {
    const { POST: createSession } = await import("./sessions/route");
    const { GET: getSession } = await import("./sessions/[id]/route");
    const { POST: answer } = await import("./sessions/[id]/answer/route");
    const { POST: complete } = await import("./sessions/[id]/complete/route");
    const repo = await import("@/lib/db/repo");

    const createRes = await createSession(
      jsonRequest("http://test/api/sessions", {
        mode: "rapid",
        config: {
          subtopicIds: ["lbo.paper"],
          areaIds: [],
          difficulty: 3,
          questionCount: 4,
          personaId: null,
          secondsPerQuestion: 45,
          rounds: null,
        },
      }),
    );
    const { sessionId } = (await createRes.json()) as { sessionId: string };

    const stateRes = await getSession(new Request("http://test"), ctx(sessionId));
    const state = (await stateRes.json()) as {
      questions: { id: string }[];
      activeQuestionId: string;
    };
    expect(state.questions).toHaveLength(4);

    // answer the first two
    for (let i = 0; i < 2; i++) {
      const active = repo.getActiveQuestion(sessionId)!;
      const res = await answer(
        jsonRequest(`http://test/api/sessions/${sessionId}/answer`, {
          questionId: active.id,
          answer: `~${20 + i}%`,
          elapsedMs: 30_000,
        }),
        ctx(sessionId),
      );
      expect(res.headers.get("Content-Type")).toContain("application/json");
      const body = (await res.json()) as { action: string };
      expect(body.action).toBe("wrapup");
    }

    const completeRes = await complete(new Request("http://test", { method: "POST" }), ctx(sessionId));
    const body = (await completeRes.json()) as { debrief: { overallScore: number } };
    expect(body.debrief).toBeTruthy();
    // two answered → graded; two untouched → skipped
    const qs = repo.getSessionQuestions(sessionId);
    expect(qs.filter((q) => q.status === "graded")).toHaveLength(2);
    expect(qs.filter((q) => q.status === "skipped")).toHaveLength(2);
  });

  it("superday mode: rounds advance and round focus areas drive subtopics", async () => {
    const { POST: createSession } = await import("./sessions/route");
    const { POST: answer } = await import("./sessions/[id]/answer/route");
    const { POST: next } = await import("./sessions/[id]/next/route");
    const repo = await import("@/lib/db/repo");

    const createRes = await createSession(
      jsonRequest("http://test/api/sessions", {
        mode: "superday",
        config: {
          subtopicIds: [],
          areaIds: [],
          difficulty: "adaptive",
          questionCount: 2,
          personaId: null,
          secondsPerQuestion: null,
          rounds: [
            { personaId: "friendly-vp", focusAreaId: "acct", questionCount: 1 },
            { personaId: "skeptic", focusAreaId: "mna", questionCount: 1 },
          ],
        },
      }),
    );
    const { sessionId } = (await createRes.json()) as { sessionId: string };

    const q1 = repo.getActiveQuestion(sessionId)!;
    expect(q1.subtopicId.startsWith("acct.")).toBe(true);
    expect(q1.roundId).toBeTruthy();

    // wrap up q1 quickly: answer repeatedly until wrapup (cap 3)
    for (let i = 0; i < 4; i++) {
      const active = repo.getActiveQuestion(sessionId);
      if (!active || active.id !== q1.id) break;
      const res = await answer(
        jsonRequest(`http://test/api/sessions/${sessionId}/answer`, {
          questionId: q1.id,
          answer: `attempt ${i}`,
        }),
        ctx(sessionId),
      );
      await res.text();
    }
    expect(repo.getQuestion(q1.id)?.status).toBe("answered");

    const nextRes = await next(new Request("http://test", { method: "POST" }), ctx(sessionId));
    const nextBody = (await nextRes.json()) as {
      done: boolean;
      question?: { subtopicId: string };
      roundIndex?: number;
    };
    expect(nextBody.done).toBe(false);
    expect(nextBody.question!.subtopicId.startsWith("mna.")).toBe(true);
    expect(nextBody.roundIndex).toBe(1);
  });
});

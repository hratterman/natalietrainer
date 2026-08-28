import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "natalie-learn-"));
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
const sessionCtx = (sessionId: string) => ({ params: Promise.resolve({ sessionId }) });

async function readSse(response: Response): Promise<{ text: string; action: string }> {
  const raw = await response.text();
  let text = "";
  let action = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = JSON.parse(line.slice(6)) as { type: string; text?: string; action?: string };
    if (payload.type === "delta") text += payload.text ?? "";
    if (payload.type === "done") action = payload.action ?? "";
    if (payload.type === "error") throw new Error(JSON.stringify(payload));
  }
  return { text, action };
}

// Mock grading: short answers (<~240 chars) fail (<70), long answers pass.
const FAIL_ANSWER = "It goes down I think.";
const PASS_ANSWER =
  "Start on the income statement: pre-tax income falls ten, taxes fall two fifty at twenty five percent, net income falls seven fifty. Cash flow adds the ten back so operating cash rises two fifty. Balance sheet: cash up two fifty, asset down ten, retained earnings down seven fifty — ties.";

/** Drive one drill question to a graded state; returns {sessionId, questionId, fixitId}. */
async function missADrillQuestion() {
  const { POST: createSession } = await import("./sessions/route");
  const { POST: answer } = await import("./sessions/[id]/answer/route");
  const { POST: grade } = await import("./sessions/[id]/grade/route");
  const repo = await import("@/lib/db/repo");

  const createRes = await createSession(
    jsonRequest("http://test/api/sessions", {
      mode: "drill",
      config: {
        subtopicIds: ["acct.cascades"],
        areaIds: [],
        difficulty: 4,
        questionCount: 2,
        personaId: null,
        secondsPerQuestion: null,
        rounds: null,
      },
    }),
  );
  const { sessionId } = (await createRes.json()) as { sessionId: string };
  const question = repo.getActiveQuestion(sessionId)!;
  let guard = 0;
  while (repo.getQuestion(question.id)?.status === "active" && guard++ < 4) {
    const res = await answer(
      jsonRequest(`http://test`, { questionId: question.id, answer: FAIL_ANSWER }),
      ctx(sessionId),
    );
    await res.text();
  }
  const gradeRes = await grade(jsonRequest("http://test", { questionId: question.id }), ctx(sessionId));
  const body = (await gradeRes.json()) as { fixitId: string | null; grade: { overall: number } };
  return { sessionId, questionId: question.id, fixitId: body.fixitId, overall: body.grade.overall };
}

/** Answer a learn-session proof question until graded (cap = 1 follow-up). */
async function answerProof(sessionId: string, questionId: string, text: string) {
  const { POST: answer } = await import("./sessions/[id]/answer/route");
  const { POST: grade } = await import("./sessions/[id]/grade/route");
  const repo = await import("@/lib/db/repo");
  let guard = 0;
  while (repo.getQuestion(questionId)?.status === "active" && guard++ < 4) {
    const res = await answer(jsonRequest("http://test", { questionId, answer: text }), ctx(sessionId));
    await res.text();
  }
  const gradeRes = await grade(jsonRequest("http://test", { questionId }), ctx(sessionId));
  return (await gradeRes.json()) as { grade: { overall: number }; fixitId: string | null };
}

describe("learn loop (LLM_MOCK)", () => {
  it("miss creates a fixit with the grader's concept; learn mode is not publicly creatable", async () => {
    const repo = await import("@/lib/db/repo");
    const { fixitId, overall } = await missADrillQuestion();
    expect(overall).toBeLessThan(70);
    expect(fixitId).toBeTruthy();
    const fixit = repo.getFixit(fixitId!)!;
    expect(fixit.status).toBe("open");
    expect(fixit.concept).toBe("[MOCK] balance check tie-out");
    expect(fixit.detailJson.corrections.length).toBeGreaterThan(0);

    const { POST: createSession } = await import("./sessions/route");
    const res = await createSession(
      jsonRequest("http://test/api/sessions", {
        mode: "learn",
        config: {
          subtopicIds: [],
          areaIds: [],
          difficulty: 3,
          questionCount: 1,
          personaId: null,
          secondsPerQuestion: null,
          rounds: null,
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("lesson: idempotent start, coach opening + progression to check, turns persisted", async () => {
    const repo = await import("@/lib/db/repo");
    const { fixitId } = await missADrillQuestion();
    const { POST: lesson } = await import("./fixits/[id]/lesson/route");
    const { POST: chat } = await import("./learn/[sessionId]/chat/route");

    const start1 = await lesson(new Request("http://test", { method: "POST" }), ctx(fixitId!));
    const body1 = (await start1.json()) as { sessionId: string; anchorQuestionId: string };
    const start2 = await lesson(new Request("http://test", { method: "POST" }), ctx(fixitId!));
    const body2 = (await start2.json()) as { sessionId: string };
    expect(body2.sessionId).toBe(body1.sessionId); // idempotent

    // Opening (message: null)
    const opening = await readSse(
      await chat(jsonRequest("http://test", { message: null }), sessionCtx(body1.sessionId)),
    );
    expect(opening.action).toBe("coach");
    expect(opening.text.length).toBeGreaterThan(0);
    // Re-opening is rejected
    const reopen = await chat(jsonRequest("http://test", { message: null }), sessionCtx(body1.sessionId));
    expect(reopen.status).toBe(409);

    // Three exchanges; the mock coach signals check on the third.
    let lastAction = "";
    for (let i = 0; i < 3; i++) {
      const turn = await readSse(
        await chat(jsonRequest("http://test", { message: `step ${i}` }), sessionCtx(body1.sessionId)),
      );
      lastAction = turn.action;
    }
    expect(lastAction).toBe("check");

    const anchorTurns = repo.getTurns(body1.anchorQuestionId);
    // opening + 3 exchanges = 4 coach turns + 3 candidate turns
    expect(anchorTurns.filter((t) => t.role === "interviewer")).toHaveLength(4);
    expect(anchorTurns.filter((t) => t.role === "candidate")).toHaveLength(3);
  });

  it("prove it: anchor skipped, fresh archetype question, fail bumps + [check result], 2 passes resolve", async () => {
    const repo = await import("@/lib/db/repo");
    const { fixitId } = await missADrillQuestion();
    const { POST: lesson } = await import("./fixits/[id]/lesson/route");
    const { POST: next } = await import("./sessions/[id]/next/route");

    const start = await lesson(new Request("http://test", { method: "POST" }), ctx(fixitId!));
    const { sessionId, anchorQuestionId } = (await start.json()) as {
      sessionId: string;
      anchorQuestionId: string;
    };

    // First /next skips the anchor and generates proof #1.
    const next1 = await next(new Request("http://test", { method: "POST" }), ctx(sessionId));
    const proof1 = ((await next1.json()) as { question: { id: string; archetypeId: string; summary?: string } })
      .question;
    expect(repo.getQuestion(anchorQuestionId)?.status).toBe("skipped");
    const fixit = repo.getFixit(fixitId!)!;
    expect(proof1.archetypeId).toBe(fixit.archetypeId);
    const sourceQuestion = repo.getQuestion(fixit.sourceQuestionId)!;
    expect(repo.getQuestion(proof1.id)!.summary).not.toBe(sourceQuestion.summary);

    // Fail proof #1 → attempts bumped, [check result] appended, fixit still open.
    await answerProof(sessionId, proof1.id, FAIL_ANSWER);
    expect(repo.getFixit(fixitId!)!.status).toBe("open");
    expect(repo.getFixit(fixitId!)!.attempts).toBe(1);
    const anchorTurns = repo.getTurns(anchorQuestionId);
    expect(anchorTurns.some((t) => t.content.startsWith("[check result]"))).toBe(true);

    // Two consecutive passes resolve it and complete the session.
    for (let i = 0; i < 2; i++) {
      const nx = await next(new Request("http://test", { method: "POST" }), ctx(sessionId));
      const body = (await nx.json()) as { done: boolean; question?: { id: string } };
      expect(body.done).toBe(false);
      await answerProof(sessionId, body.question!.id, PASS_ANSWER);
    }
    const resolved = repo.getFixit(fixitId!)!;
    expect(resolved.status).toBe("resolved");
    expect(resolved.nextCheckAt).not.toBeNull();
    expect(resolved.nextCheckAt!.getTime()).toBeGreaterThan(Date.now() + 1.5 * 24 * 3600 * 1000);
    expect(repo.getSession(sessionId)?.status).toBe("completed");
    // learn grades never create new fixits
    expect(repo.listActiveFixits()).toHaveLength(1);
    // mastery moved
    expect(repo.getMasteryForSubtopic("acct.cascades")!.attempts).toBeGreaterThanOrEqual(3);
  });

  it("spot-checks: pass advances the schedule then clears; fail reopens and re-anchors", async () => {
    const repo = await import("@/lib/db/repo");
    const { POST: lesson } = await import("./fixits/[id]/lesson/route");
    const { POST: next } = await import("./sessions/[id]/next/route");
    const { POST: spotcheck } = await import("./fixits/[id]/spotcheck/route");

    // Resolve a fixit quickly.
    const { fixitId } = await missADrillQuestion();
    const start = await lesson(new Request("http://test", { method: "POST" }), ctx(fixitId!));
    const { sessionId } = (await start.json()) as { sessionId: string };
    for (let i = 0; i < 2; i++) {
      const nx = await next(new Request("http://test", { method: "POST" }), ctx(sessionId));
      const body = (await nx.json()) as { question?: { id: string } };
      await answerProof(sessionId, body.question!.id, PASS_ANSWER);
    }
    expect(repo.getFixit(fixitId!)!.status).toBe("resolved");
    expect(repo.getFixit(fixitId!)!.checkStage).toBe(0);

    // Spot-check #1 (due — backdate the schedule): pass → stage 1, later date.
    repo.advanceFixitCheck(fixitId!, 0, Date.now() - 60_000);
    const sc1 = await spotcheck(new Request("http://test", { method: "POST" }), ctx(fixitId!));
    const sc1Body = (await sc1.json()) as { sessionId: string; question: { id: string } };
    await answerProof(sc1Body.sessionId, sc1Body.question.id, PASS_ANSWER);
    let f = repo.getFixit(fixitId!)!;
    expect(f.status).toBe("resolved");
    expect(f.checkStage).toBe(1);
    expect(f.nextCheckAt!.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
    expect(repo.getSession(sc1Body.sessionId)?.status).toBe("completed");

    // Spot-check #2 (due): pass → cleared.
    repo.advanceFixitCheck(fixitId!, 1, Date.now() - 60_000);
    const sc2 = await spotcheck(new Request("http://test", { method: "POST" }), ctx(fixitId!));
    const sc2Body = (await sc2.json()) as { sessionId: string; question: { id: string } };
    await answerProof(sc2Body.sessionId, sc2Body.question.id, PASS_ANSWER);
    f = repo.getFixit(fixitId!)!;
    expect(f.status).toBe("resolved");
    expect(f.nextCheckAt).toBeNull(); // cleared
    // cleared fixits reject further spot-checks
    const sc3 = await spotcheck(new Request("http://test", { method: "POST" }), ctx(fixitId!));
    expect(sc3.status).toBe(409);
  });

  it("spot-check fail reopens and re-anchors to the failed question", async () => {
    const repo = await import("@/lib/db/repo");
    const { POST: lesson } = await import("./fixits/[id]/lesson/route");
    const { POST: next } = await import("./sessions/[id]/next/route");
    const { POST: spotcheck } = await import("./fixits/[id]/spotcheck/route");

    const { fixitId } = await missADrillQuestion();
    const start = await lesson(new Request("http://test", { method: "POST" }), ctx(fixitId!));
    const { sessionId } = (await start.json()) as { sessionId: string };
    for (let i = 0; i < 2; i++) {
      const nx = await next(new Request("http://test", { method: "POST" }), ctx(sessionId));
      const body = (await nx.json()) as { question?: { id: string } };
      await answerProof(sessionId, body.question!.id, PASS_ANSWER);
    }

    const sc = await spotcheck(new Request("http://test", { method: "POST" }), ctx(fixitId!));
    const scBody = (await sc.json()) as { sessionId: string; question: { id: string } };
    await answerProof(scBody.sessionId, scBody.question.id, FAIL_ANSWER);
    const f = repo.getFixit(fixitId!)!;
    expect(f.status).toBe("open");
    expect(f.nextCheckAt).toBeNull();
    expect(f.sourceQuestionId).toBe(scBody.question.id); // re-anchored
    expect(f.attempts).toBeGreaterThanOrEqual(1);
  });
});

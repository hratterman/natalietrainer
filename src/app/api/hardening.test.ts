import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "natalie-hardening-"));
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

const drillConfig = (overrides: Record<string, unknown> = {}) => ({
  subtopicIds: ["acct.cascades"],
  areaIds: [],
  difficulty: 4,
  questionCount: 2,
  personaId: null,
  secondsPerQuestion: null,
  rounds: null,
  ...overrides,
});

async function createDrill(overrides: Record<string, unknown> = {}): Promise<string> {
  const { POST: createSession } = await import("./sessions/route");
  const res = await createSession(
    jsonRequest("http://test/api/sessions", { mode: "drill", config: drillConfig(overrides) }),
  );
  expect(res.status).toBe(200);
  return ((await res.json()) as { sessionId: string }).sessionId;
}

/** Answer a question until it wraps up (drains the follow-up budget). */
async function answerToWrapup(sessionId: string, questionId: string, text: string) {
  const { POST: answer } = await import("./sessions/[id]/answer/route");
  const repo = await import("@/lib/db/repo");
  let guard = 0;
  while (repo.getQuestion(questionId)?.status === "active" && guard++ < 6) {
    const res = await answer(
      jsonRequest("http://test", { questionId, answer: text }),
      ctx(sessionId),
    );
    await res.text();
  }
}

const PASS_ANSWER =
  "Start on the income statement: pre-tax income falls ten, taxes fall two fifty at twenty five percent, net income falls seven fifty. Cash flow adds the ten back so operating cash rises two fifty. Balance sheet: cash up two fifty, asset down ten, retained earnings down seven fifty — ties.";
const FAIL_ANSWER = "It goes down I think.";

/** Miss a drill question so a fixit exists; returns ids. */
async function missADrillQuestion() {
  const { POST: grade } = await import("./sessions/[id]/grade/route");
  const repo = await import("@/lib/db/repo");
  const sessionId = await createDrill();
  const question = repo.getActiveQuestion(sessionId)!;
  await answerToWrapup(sessionId, question.id, FAIL_ANSWER);
  const gradeRes = await grade(
    jsonRequest("http://test", { questionId: question.id }),
    ctx(sessionId),
  );
  const body = (await gradeRes.json()) as { fixitId: string | null };
  return { sessionId, questionId: question.id, fixitId: body.fixitId! };
}

/** Lesson → two proof passes → resolved fixit. */
async function resolveFixit(fixitId: string): Promise<void> {
  const { POST: lesson } = await import("./fixits/[id]/lesson/route");
  const { POST: next } = await import("./sessions/[id]/next/route");
  const { POST: grade } = await import("./sessions/[id]/grade/route");
  const start = await lesson(new Request("http://test", { method: "POST" }), ctx(fixitId));
  const { sessionId } = (await start.json()) as { sessionId: string };
  for (let i = 0; i < 2; i++) {
    const nx = await next(new Request("http://test", { method: "POST" }), ctx(sessionId));
    const body = (await nx.json()) as { question?: { id: string } };
    await answerToWrapup(sessionId, body.question!.id, PASS_ANSWER);
    await (
      await grade(jsonRequest("http://test", { questionId: body.question!.id }), ctx(sessionId))
    ).json();
  }
}

describe("hardening regressions (LLM_MOCK)", () => {
  it("create-session rejects unknown subtopic/area/persona ids with 400", async () => {
    const { POST: createSession } = await import("./sessions/route");
    for (const config of [
      drillConfig({ subtopicIds: ["not.a.subtopic"] }),
      drillConfig({ subtopicIds: [], areaIds: ["nope"] }),
      drillConfig({ personaId: "casper-the-ghost" }),
    ]) {
      const res = await createSession(jsonRequest("http://test/api/sessions", { mode: "drill", config }));
      expect(res.status).toBe(400);
    }
    const badRound = await createSession(
      jsonRequest("http://test/api/sessions", {
        mode: "superday",
        config: drillConfig({
          subtopicIds: [],
          rounds: [{ personaId: "quant", focusAreaId: "not-an-area", questionCount: 2 }],
        }),
      }),
    );
    expect(badRound.status).toBe(400);
  });

  it("seed failure marks the session abandoned instead of stranding it active", async () => {
    const { startSession } = await import("@/lib/session/engine");
    const repo = await import("@/lib/db/repo");
    await expect(
      startSession("drill", {
        subtopicIds: ["bogus.subtopic"],
        areaIds: [],
        difficulty: 3,
        questionCount: 2,
        personaId: null,
        secondsPerQuestion: null,
        rounds: null,
      }),
    ).rejects.toThrow();
    const sessions = repo.listSessions(5);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.status).toBe("abandoned");
  });

  it("concurrent /next calls coalesce to a single new question", async () => {
    const { POST: next } = await import("./sessions/[id]/next/route");
    const { POST: grade } = await import("./sessions/[id]/grade/route");
    const repo = await import("@/lib/db/repo");
    const sessionId = await createDrill();
    const q1 = repo.getActiveQuestion(sessionId)!;
    await answerToWrapup(sessionId, q1.id, PASS_ANSWER);
    await (await grade(jsonRequest("http://test", { questionId: q1.id }), ctx(sessionId))).json();

    const [a, b] = await Promise.all([
      next(new Request("http://test", { method: "POST" }), ctx(sessionId)),
      next(new Request("http://test", { method: "POST" }), ctx(sessionId)),
    ]);
    const bodyA = (await a.json()) as { question?: { id: string } };
    const bodyB = (await b.json()) as { question?: { id: string } };
    expect(bodyA.question!.id).toBe(bodyB.question!.id);
    expect(repo.getSessionQuestions(sessionId)).toHaveLength(2);
  });

  it("concurrent grades of one question are idempotent, not a 500", async () => {
    const { POST: grade } = await import("./sessions/[id]/grade/route");
    const repo = await import("@/lib/db/repo");
    const sessionId = await createDrill();
    const q = repo.getActiveQuestion(sessionId)!;
    await answerToWrapup(sessionId, q.id, PASS_ANSWER);

    const [a, b] = await Promise.all([
      grade(jsonRequest("http://test", { questionId: q.id }), ctx(sessionId)),
      grade(jsonRequest("http://test", { questionId: q.id }), ctx(sessionId)),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const overallA = ((await a.json()) as { grade: { overall: number } }).grade.overall;
    const overallB = ((await b.json()) as { grade: { overall: number } }).grade.overall;
    expect(overallA).toBe(overallB);
    // one grade row, one mastery attempt
    expect(repo.getMasteryForSubtopic("acct.cascades")?.attempts).toBe(1);
  });

  it("answer route caps input sizes with 400s", async () => {
    const { POST: answer } = await import("./sessions/[id]/answer/route");
    const repo = await import("@/lib/db/repo");
    const sessionId = await createDrill();
    const q = repo.getActiveQuestion(sessionId)!;

    const tooLong = await answer(
      jsonRequest("http://test", { questionId: q.id, answer: "x".repeat(20_001) }),
      ctx(sessionId),
    );
    expect(tooLong.status).toBe(400);

    const absurdTiming = await answer(
      jsonRequest("http://test", {
        questionId: q.id,
        answer: "fine",
        elapsedMs: 999_999_999_999,
      }),
      ctx(sessionId),
    );
    expect(absurdTiming.status).toBe(400);
    // nothing persisted from rejected submissions
    expect(repo.getTurns(q.id)).toHaveLength(0);
  });

  it("interject 409s outside voice interview sessions", async () => {
    const { POST: interject } = await import("./sessions/[id]/interject/route");
    const repo = await import("@/lib/db/repo");
    const sessionId = await createDrill(); // typed session
    const q = repo.getActiveQuestion(sessionId)!;
    const res = await interject(
      jsonRequest("http://test", {
        questionId: q.id,
        answer: "partial",
        trigger: "ramble",
        interjectionText: "Stop. Number first.",
      }),
      ctx(sessionId),
    );
    expect(res.status).toBe(409);
    expect(repo.getTurns(q.id)).toHaveLength(0);
  });

  it("GET session withholds the answer key until a question is graded", async () => {
    const { GET: getSession } = await import("./sessions/[id]/route");
    const { POST: grade } = await import("./sessions/[id]/grade/route");
    const repo = await import("@/lib/db/repo");
    const sessionId = await createDrill();
    const q = repo.getActiveQuestion(sessionId)!;

    const before = await getSession(new Request("http://test"), ctx(sessionId));
    const beforeBody = (await before.json()) as {
      questions: { summary: string; expectedKeyPointsJson: string[] }[];
    };
    expect(beforeBody.questions[0]!.summary).toBe("");
    expect(beforeBody.questions[0]!.expectedKeyPointsJson).toEqual([]);

    await answerToWrapup(sessionId, q.id, PASS_ANSWER);
    await (await grade(jsonRequest("http://test", { questionId: q.id }), ctx(sessionId))).json();

    const after = await getSession(new Request("http://test"), ctx(sessionId));
    const afterBody = (await after.json()) as {
      questions: { summary: string; expectedKeyPointsJson: string[] }[];
    };
    expect(afterBody.questions[0]!.summary.length).toBeGreaterThan(0);
    expect(afterBody.questions[0]!.expectedKeyPointsJson.length).toBeGreaterThan(0);
  });

  it("completing an unanswered session returns a static zero debrief", async () => {
    const { POST: complete } = await import("./sessions/[id]/complete/route");
    const repo = await import("@/lib/db/repo");
    const sessionId = await createDrill();
    const res = await complete(new Request("http://test", { method: "POST" }), ctx(sessionId));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { debrief: { overallScore: number; byArea: unknown[] } };
    expect(body.debrief.overallScore).toBe(0);
    expect(body.debrief.byArea).toEqual([]);
    expect(repo.getSession(sessionId)?.status).toBe("completed");
    expect(repo.getMasteryForSubtopic("acct.cascades")).toBeUndefined();
  });

  it("learn sessions refuse /complete and anchor grading (409s)", async () => {
    const { POST: lesson } = await import("./fixits/[id]/lesson/route");
    const { POST: complete } = await import("./sessions/[id]/complete/route");
    const { POST: grade } = await import("./sessions/[id]/grade/route");
    const { POST: chat } = await import("./learn/[sessionId]/chat/route");
    const repo = await import("@/lib/db/repo");

    const { fixitId } = await missADrillQuestion();
    const start = await lesson(new Request("http://test", { method: "POST" }), ctx(fixitId));
    const { sessionId, anchorQuestionId } = (await start.json()) as {
      sessionId: string;
      anchorQuestionId: string;
    };
    // put a candidate turn on the anchor (coach chat), like a real lesson
    await (
      await chat(jsonRequest("http://test", { message: null }), sessionCtx(sessionId))
    ).text();
    await (
      await chat(jsonRequest("http://test", { message: "my reasoning" }), sessionCtx(sessionId))
    ).text();

    const gradeRes = await grade(
      jsonRequest("http://test", { questionId: anchorQuestionId }),
      ctx(sessionId),
    );
    expect(gradeRes.status).toBe(409);
    expect(repo.getGrade(anchorQuestionId)).toBeUndefined();

    const completeRes = await complete(new Request("http://test", { method: "POST" }), ctx(sessionId));
    expect(completeRes.status).toBe(409);
    expect(repo.getSession(sessionId)?.status).toBe("active");
  });

  it("chat 409s once the lesson session is closed", async () => {
    const { POST: chat } = await import("./learn/[sessionId]/chat/route");
    const repo = await import("@/lib/db/repo");
    const { fixitId } = await missADrillQuestion();
    await resolveFixit(fixitId);
    const sessionId = repo.getFixit(fixitId)!.lessonSessionId!;
    expect(repo.getSession(sessionId)?.status).toBe("completed");
    const res = await chat(jsonRequest("http://test", { message: "hello?" }), sessionCtx(sessionId));
    expect(res.status).toBe(409);
  });

  it("bare lesson resume does not reset a voice lesson to typed", async () => {
    const { POST: lesson } = await import("./fixits/[id]/lesson/route");
    const repo = await import("@/lib/db/repo");
    const { fixitId } = await missADrillQuestion();
    const start = await lesson(
      jsonRequest("http://test", { voice: true }),
      ctx(fixitId),
    );
    const { sessionId } = (await start.json()) as { sessionId: string };
    expect(repo.getSession(sessionId)?.configJson.voiceMode).toBe(true);

    // bootstrap-style bare POST (no body)
    await (await lesson(new Request("http://test", { method: "POST" }), ctx(fixitId))).json();
    expect(repo.getSession(sessionId)?.configJson.voiceMode).toBe(true);

    // explicit off still flips it
    await (await lesson(jsonRequest("http://test", { voice: false }), ctx(fixitId))).json();
    expect(repo.getSession(sessionId)?.configJson.voiceMode).toBe(false);
  });

  it("spot-check resumed after an answered-but-ungraded refresh finishes instead of forking", async () => {
    const { POST: spotcheck } = await import("./fixits/[id]/spotcheck/route");
    const repo = await import("@/lib/db/repo");
    const { fixitId } = await missADrillQuestion();
    await resolveFixit(fixitId);
    repo.advanceFixitCheck(fixitId, 0, Date.now() - 60_000); // due now

    const sc = await spotcheck(new Request("http://test", { method: "POST" }), ctx(fixitId));
    const scBody = (await sc.json()) as { sessionId: string; question: { id: string } };
    // answer to wrapup but do NOT grade (simulates refresh during grading)
    await answerToWrapup(scBody.sessionId, scBody.question.id, PASS_ANSWER);
    expect(repo.getQuestion(scBody.question.id)?.status).toBe("answered");

    const resumed = await spotcheck(new Request("http://test", { method: "POST" }), ctx(fixitId));
    const resumedBody = (await resumed.json()) as {
      sessionId: string;
      alreadyCompleted?: boolean;
    };
    expect(resumedBody.sessionId).toBe(scBody.sessionId);
    expect(resumedBody.alreadyCompleted).toBe(true);
    // the pass advanced the schedule; no duplicate session was created
    const f = repo.getFixit(fixitId)!;
    expect(f.checkStage).toBe(1);
    expect(repo.getSession(scBody.sessionId)?.status).toBe("completed");
    expect(f.lessonSessionId).toBe(scBody.sessionId);
  });

  it("early spot-check pass keeps the spaced schedule; a due pass advances it", async () => {
    const { POST: spotcheck } = await import("./fixits/[id]/spotcheck/route");
    const { POST: grade } = await import("./sessions/[id]/grade/route");
    const repo = await import("@/lib/db/repo");
    const { fixitId } = await missADrillQuestion();
    await resolveFixit(fixitId);
    const scheduled = repo.getFixit(fixitId)!.nextCheckAt!.getTime();
    expect(scheduled).toBeGreaterThan(Date.now()); // not yet due → early

    const early = await spotcheck(new Request("http://test", { method: "POST" }), ctx(fixitId));
    const earlyBody = (await early.json()) as { sessionId: string; question: { id: string } };
    await answerToWrapup(earlyBody.sessionId, earlyBody.question.id, PASS_ANSWER);
    await (
      await grade(
        jsonRequest("http://test", { questionId: earlyBody.question.id }),
        ctx(earlyBody.sessionId),
      )
    ).json();

    let f = repo.getFixit(fixitId)!;
    expect(f.status).toBe("resolved");
    expect(f.checkStage).toBe(0); // unchanged
    expect(f.nextCheckAt!.getTime()).toBe(scheduled); // schedule untouched

    // now make it due — the pass advances stage and pushes the date out
    repo.advanceFixitCheck(fixitId, 0, Date.now() - 60_000);
    const due = await spotcheck(new Request("http://test", { method: "POST" }), ctx(fixitId));
    const dueBody = (await due.json()) as { sessionId: string; question: { id: string } };
    await answerToWrapup(dueBody.sessionId, dueBody.question.id, PASS_ANSWER);
    await (
      await grade(
        jsonRequest("http://test", { questionId: dueBody.question.id }),
        ctx(dueBody.sessionId),
      )
    ).json();
    f = repo.getFixit(fixitId)!;
    expect(f.checkStage).toBe(1);
    expect(f.nextCheckAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("repointing a fixit's session abandons the superseded active one", async () => {
    const { POST: lesson } = await import("./fixits/[id]/lesson/route");
    const { POST: spotcheck } = await import("./fixits/[id]/spotcheck/route");
    const { POST: next } = await import("./sessions/[id]/next/route");
    const { POST: grade } = await import("./sessions/[id]/grade/route");
    const repo = await import("@/lib/db/repo");

    // Cycle 1: resolve, then fail the due spot-check → reopens
    const { fixitId } = await missADrillQuestion();
    await resolveFixit(fixitId);
    const firstLessonSession = repo.getFixit(fixitId)!.lessonSessionId!;
    repo.advanceFixitCheck(fixitId, 0, Date.now() - 60_000);
    const sc = await spotcheck(new Request("http://test", { method: "POST" }), ctx(fixitId));
    const scBody = (await sc.json()) as { sessionId: string; question: { id: string } };
    await answerToWrapup(scBody.sessionId, scBody.question.id, FAIL_ANSWER);
    await (
      await grade(
        jsonRequest("http://test", { questionId: scBody.question.id }),
        ctx(scBody.sessionId),
      )
    ).json();
    expect(repo.getFixit(fixitId)!.status).toBe("open");

    // Cycle 2: a fresh lesson repoints the fixit; nothing active is stranded
    const relearn = await lesson(new Request("http://test", { method: "POST" }), ctx(fixitId));
    const relearnBody = (await relearn.json()) as { sessionId: string };
    expect(relearnBody.sessionId).not.toBe(firstLessonSession);
    const statuses = repo
      .listSessions(20)
      .filter((s) => s.mode === "learn" && s.status === "active")
      .map((s) => s.id);
    expect(statuses).toEqual([relearnBody.sessionId]);
    // proof questions still flow in the new lesson
    const nx = await next(new Request("http://test", { method: "POST" }), ctx(relearnBody.sessionId));
    const nxBody = (await nx.json()) as { done: boolean; question?: { id: string } };
    expect(nxBody.done).toBe(false);
  });
});

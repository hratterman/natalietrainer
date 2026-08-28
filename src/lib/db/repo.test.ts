import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "natalie-test-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "test.db");
});

afterEach(async () => {
  const { resetDbForTests } = await import("./index");
  resetDbForTests();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATABASE_PATH;
});

describe("repo round trip", () => {
  it("runs a full drill lifecycle: session → question → turns → grade → mastery", async () => {
    const repo = await import("./repo");

    const session = repo.createSession({
      mode: "drill",
      config: {
        subtopicIds: ["acct.cascades"],
        areaIds: ["acct"],
        difficulty: 3,
        questionCount: 5,
        personaId: null,
        secondsPerQuestion: null,
        rounds: null,
      },
    });
    expect(session.status).toBe("active");

    const question = repo.createQuestion({
      sessionId: session.id,
      askedIndex: 0,
      subtopicId: "acct.cascades",
      archetypeId: "acct.cascades.dep-change",
      difficulty: 3,
      promptText: "Depreciation goes up $10...",
      setupFacts: ["Tax rate 25%"],
      summary: "dep +10, tax 25%, all three statements",
      expectedKeyPoints: ["NI down 7.5", "cash up 2.5"],
      answerFormat: "walkthrough",
    });
    expect(repo.getActiveQuestion(session.id)?.id).toBe(question.id);

    repo.appendTurn({
      questionId: question.id,
      role: "candidate",
      content: "Net income falls $7.50...",
      scratchpad: "10 * 0.75 = 7.5",
      elapsedMs: 45_000,
    });
    repo.appendTurn({
      questionId: question.id,
      role: "interviewer",
      content: "And what if it's not tax-deductible?",
    });
    const turns = repo.getTurns(question.id);
    expect(turns.map((t) => t.turnIndex)).toEqual([0, 1]);

    repo.recordGrade({
      questionId: question.id,
      accuracy: 8,
      completeness: 7,
      structure: 9,
      overall: 78,
      modelAnswer: "Start on the income statement...",
      feedback: { strengths: ["signs correct"], gaps: ["missed DTL"], corrections: [] },
    });

    expect(repo.getQuestion(question.id)?.status).toBe("graded");
    const m = repo.getMasteryForSubtopic("acct.cascades");
    expect(m).toBeDefined();
    expect(m!.attempts).toBe(1);
    expect(m!.score).toBeGreaterThan(0);

    // anti-repetition seed
    expect(repo.getRecentQuestionSummaries("acct.cascades")).toContain(
      "dep +10, tax 25%, all three statements",
    );

    const transcript = repo.getSessionWithTranscript(session.id);
    expect(transcript?.questions).toHaveLength(1);
    expect(transcript?.questions[0]?.turns).toHaveLength(2);
    expect(transcript?.questions[0]?.grade?.overall).toBe(78);

    repo.saveSessionDebrief(session.id, { overallScore: 78 });
    expect(repo.getSession(session.id)?.status).toBe("completed");
  });

  it("rebuildMastery reproduces incremental updates", async () => {
    const repo = await import("./repo");
    const session = repo.createSession({
      mode: "drill",
      config: {
        subtopicIds: ["lbo.paper"],
        areaIds: ["lbo"],
        difficulty: 4,
        questionCount: 2,
        personaId: null,
        secondsPerQuestion: null,
        rounds: null,
      },
    });
    for (let i = 0; i < 3; i++) {
      const q = repo.createQuestion({
        sessionId: session.id,
        askedIndex: i,
        subtopicId: "lbo.paper",
        archetypeId: "lbo.paper.full",
        difficulty: 4,
        promptText: `Paper LBO #${i}`,
        setupFacts: [],
        summary: `paper lbo variant ${i}`,
        expectedKeyPoints: [],
        answerFormat: "walkthrough",
      });
      repo.recordGrade({
        questionId: q.id,
        accuracy: 8,
        completeness: 8,
        structure: 8,
        overall: 80,
        modelAnswer: "…",
        feedback: { strengths: [], gaps: [], corrections: [] },
      });
    }
    const incremental = repo.getMasteryForSubtopic("lbo.paper");
    repo.rebuildMastery();
    const rebuilt = repo.getMasteryForSubtopic("lbo.paper");
    expect(rebuilt?.attempts).toBe(incremental?.attempts);
    expect(rebuilt?.score).toBeCloseTo(incremental!.score, 6);
    expect(rebuilt?.currentDifficulty).toBe(incremental?.currentDifficulty);
  });

  it("fixit lifecycle: upsert-dedupe, reopen-resolved, new row after cleared", async () => {
    const repo = await import("./repo");
    const session = repo.createSession({
      mode: "drill",
      config: {
        subtopicIds: ["dcf.wacc"],
        areaIds: [],
        difficulty: 3,
        questionCount: 3,
        personaId: null,
        secondsPerQuestion: null,
        rounds: null,
      },
    });
    const makeQuestion = (i: number) =>
      repo.createQuestion({
        sessionId: session.id,
        askedIndex: i,
        subtopicId: "dcf.wacc",
        archetypeId: "dcf.wacc.beta",
        difficulty: 3,
        promptText: `Q${i}`,
        setupFacts: [],
        summary: `wacc q${i}`,
        expectedKeyPoints: [],
        answerFormat: "walkthrough",
      });

    const q1 = makeQuestion(0);
    const first = repo.upsertFixitForMiss({
      sourceQuestionId: q1.id,
      subtopicId: "dcf.wacc",
      archetypeId: "dcf.wacc.beta",
      difficulty: 3,
      concept: "unlevering beta",
      detail: { gaps: ["forgot the tax term"], corrections: [] },
    });
    expect(first.status).toBe("open");

    // Second miss on the same archetype refreshes in place — still one fixit.
    const q2 = makeQuestion(1);
    const second = repo.upsertFixitForMiss({
      sourceQuestionId: q2.id,
      subtopicId: "dcf.wacc",
      archetypeId: "dcf.wacc.beta",
      difficulty: 4,
      concept: "unlevering beta with taxes",
      detail: { gaps: ["still the tax term"], corrections: [] },
    });
    expect(second.id).toBe(first.id);
    expect(second.sourceQuestionId).toBe(q2.id);
    expect(second.difficulty).toBe(4);
    expect(repo.listActiveFixits()).toHaveLength(1);

    // Resolve → pending check; a new miss reopens the SAME fixit.
    repo.resolveFixit(first.id, Date.now() + 1000);
    const q3 = makeQuestion(2);
    const reopened = repo.upsertFixitForMiss({
      sourceQuestionId: q3.id,
      subtopicId: "dcf.wacc",
      archetypeId: "dcf.wacc.beta",
      difficulty: 3,
      concept: "unlevering beta",
      detail: { gaps: [], corrections: [] },
    });
    expect(reopened.id).toBe(first.id);
    expect(reopened.status).toBe("open");
    expect(reopened.nextCheckAt).toBeNull();

    // Clear it fully → the next miss creates a brand-new fixit.
    repo.resolveFixit(first.id, Date.now() + 1000);
    repo.advanceFixitCheck(first.id, 2, null);
    const q4 = repo.createQuestion({
      sessionId: session.id,
      askedIndex: 3,
      subtopicId: "dcf.wacc",
      archetypeId: "dcf.wacc.beta",
      difficulty: 3,
      promptText: "Q4",
      setupFacts: [],
      summary: "wacc q4",
      expectedKeyPoints: [],
      answerFormat: "walkthrough",
    });
    const fresh = repo.upsertFixitForMiss({
      sourceQuestionId: q4.id,
      subtopicId: "dcf.wacc",
      archetypeId: "dcf.wacc.beta",
      difficulty: 3,
      concept: "unlevering beta",
      detail: { gaps: [], corrections: [] },
    });
    expect(fresh.id).not.toBe(first.id);

    // due filter
    repo.resolveFixit(fresh.id, Date.now() - 1000);
    expect(repo.listFixits({ dueBefore: Date.now() }).map((f) => f.id)).toContain(fresh.id);

    // reopen with re-anchor
    repo.reopenFixit(fresh.id, {
      sourceQuestionId: q1.id,
      concept: "re-anchored",
      detail: { gaps: ["new gap"], corrections: [] },
    });
    const after = repo.getFixit(fresh.id)!;
    expect(after.status).toBe("open");
    expect(after.attempts).toBe(1);
    expect(after.sourceQuestionId).toBe(q1.id);
    expect(repo.getFixitBySourceQuestion(q1.id)?.id).toBe(fresh.id);
  });

  it("creates superday rounds from config", async () => {
    const repo = await import("./repo");
    const session = repo.createSession({
      mode: "superday",
      config: {
        subtopicIds: [],
        areaIds: [],
        difficulty: "adaptive",
        questionCount: 12,
        personaId: null,
        secondsPerQuestion: null,
        rounds: [
          { personaId: "friendly-vp", focusAreaId: "acct", questionCount: 3 },
          { personaId: "quant", focusAreaId: "dcf", questionCount: 3 },
        ],
      },
    });
    const rounds = repo.getRounds(session.id);
    expect(rounds).toHaveLength(2);
    expect(rounds[0]?.personaId).toBe("friendly-vp");
    expect(rounds[1]?.focusAreaId).toBe("dcf");
  });
});

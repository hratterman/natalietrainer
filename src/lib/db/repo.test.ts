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

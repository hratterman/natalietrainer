import { describe, expect, it } from "vitest";
import {
  applyGrade,
  clampDifficulty,
  effectiveScore,
  ewmaUpdate,
  initialMasteryState,
  isStale,
  nextDifficulty,
  pickSubtopic,
  rankWeaknesses,
  seededRandom,
} from "./mastery";

const DAY = 24 * 60 * 60 * 1000;

describe("effectiveScore", () => {
  it("weights difficulty: a hard win moves more than an easy win", () => {
    expect(effectiveScore(80, 5)).toBeGreaterThan(effectiveScore(80, 1));
  });

  it("caps at 1", () => {
    expect(effectiveScore(100, 5)).toBe(1);
  });

  it("a perfect easy answer is not full mastery", () => {
    expect(effectiveScore(100, 1)).toBeCloseTo(0.8);
  });
});

describe("ewmaUpdate", () => {
  it("first grade sets the score directly", () => {
    expect(ewmaUpdate(0, 0.9, 0)).toBe(0.9);
  });

  it("later grades blend 30/70", () => {
    expect(ewmaUpdate(0.5, 1, 3)).toBeCloseTo(0.65);
  });
});

describe("nextDifficulty", () => {
  it("steps up after two consecutive >= 75", () => {
    expect(nextDifficulty(2, [80, 90])).toBe(3);
  });

  it("does not step up after a single high grade", () => {
    expect(nextDifficulty(2, [40, 90])).toBe(2);
  });

  it("steps down on a grade < 40", () => {
    expect(nextDifficulty(3, [80, 35])).toBe(2);
  });

  it("clamps to [1,5]", () => {
    expect(nextDifficulty(1, [80, 10])).toBe(1);
    expect(nextDifficulty(5, [90, 95])).toBe(5);
  });
});

describe("clampDifficulty", () => {
  it("respects archetype ranges", () => {
    expect(clampDifficulty(2, [4, 5])).toBe(4);
    expect(clampDifficulty(5, [1, 3])).toBe(3);
    expect(clampDifficulty(3, [1, 5])).toBe(3);
  });
});

describe("applyGrade", () => {
  it("full lifecycle: score rises with good grades, difficulty steps up then holds", () => {
    let state = initialMasteryState(0);
    state = applyGrade(state, 85, 2, 1);
    expect(state.attempts).toBe(1);
    expect(state.currentDifficulty).toBe(2);
    state = applyGrade(state, 90, 2, 2);
    expect(state.currentDifficulty).toBe(3); // two consecutive >= 75
    expect(state.recentOverall).toEqual([]); // streak consumed
    state = applyGrade(state, 30, 3, 3);
    expect(state.currentDifficulty).toBe(2); // step down on < 40
    expect(state.score).toBeGreaterThan(0);
    expect(state.score).toBeLessThan(1);
  });
});

describe("isStale", () => {
  it("flags after 7 days", () => {
    expect(isStale(0, 8 * DAY)).toBe(true);
    expect(isStale(0, 6 * DAY)).toBe(false);
  });
});

describe("rankWeaknesses", () => {
  it("pins unexplored above explored and orders by priority", () => {
    const ranked = rankWeaknesses(
      [
        { subtopicId: "strong", score: 0.9, lastAttemptAt: 0 },
        { subtopicId: "weak", score: 0.2, lastAttemptAt: 0 },
        { subtopicId: "new", score: null, lastAttemptAt: null },
      ],
      DAY,
    );
    expect(ranked.map((r) => r.subtopicId)).toEqual(["new", "weak", "strong"]);
    expect(ranked[0]?.unexplored).toBe(true);
  });

  it("staleness bumps priority", () => {
    const ranked = rankWeaknesses(
      [
        { subtopicId: "fresh", score: 0.5, lastAttemptAt: 9 * DAY },
        { subtopicId: "stale", score: 0.5, lastAttemptAt: 0 },
      ],
      10 * DAY,
    );
    expect(ranked[0]?.subtopicId).toBe("stale");
    expect(ranked[0]?.stale).toBe(true);
  });
});

describe("pickSubtopic", () => {
  it("is deterministic under a seeded RNG", () => {
    const candidates = [
      { subtopicId: "a", priority: 0.9, areaWeight: 10, score: 0.1 },
      { subtopicId: "b", priority: 0.2, areaWeight: 10, score: 0.8 },
      { subtopicId: "c", priority: 0.5, areaWeight: 1, score: 0.5 },
    ];
    const first = pickSubtopic(candidates, seededRandom(42));
    const second = pickSubtopic(candidates, seededRandom(42));
    expect(first).toBe(second);
  });

  it("weakness-weighted sampling favors weak, heavily-weighted subtopics", () => {
    const candidates = [
      { subtopicId: "weak-core", priority: 0.9, areaWeight: 10, score: 0.1 },
      { subtopicId: "strong-fringe", priority: 0.1, areaWeight: 1, score: 0.9 },
    ];
    const rand = seededRandom(7);
    const picks = new Map<string, number>();
    for (let i = 0; i < 500; i++) {
      const pick = pickSubtopic(candidates, rand)!;
      picks.set(pick, (picks.get(pick) ?? 0) + 1);
    }
    expect(picks.get("weak-core")! > picks.get("strong-fringe")!).toBe(true);
  });

  it("handles empty candidate lists", () => {
    expect(pickSubtopic([], seededRandom(1))).toBeUndefined();
  });
});

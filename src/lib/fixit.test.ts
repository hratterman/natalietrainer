import { describe, expect, it } from "vitest";
import {
  afterSpotCheck,
  conceptFrom,
  firstCheckAt,
  proofPassed,
  qualifiesAsMiss,
} from "./fixit";

const DAY = 24 * 60 * 60 * 1000;

describe("qualifiesAsMiss", () => {
  it("qualifies below 70 overall", () => {
    expect(qualifiesAsMiss({ overall: 69, accuracy: 8 })).toBe(true);
    expect(qualifiesAsMiss({ overall: 70, accuracy: 8 })).toBe(false);
  });

  it("qualifies at accuracy <= 5 even with a decent overall (polished but wrong)", () => {
    expect(qualifiesAsMiss({ overall: 75, accuracy: 5 })).toBe(true);
    expect(qualifiesAsMiss({ overall: 75, accuracy: 6 })).toBe(false);
  });
});

describe("proofPassed", () => {
  it("passes at 70", () => {
    expect(proofPassed(70)).toBe(true);
    expect(proofPassed(69)).toBe(false);
  });
});

describe("conceptFrom", () => {
  it("prefers the grader's label", () => {
    expect(
      conceptFrom(
        { overall: 50, accuracy: 4, missedConcept: "deferred tax on the cash walk", gaps: ["x"] },
        "Deferred Taxes & NOLs",
      ),
    ).toBe("deferred tax on the cash walk");
  });

  it("falls back to the first gap, truncated", () => {
    const longGap = "a".repeat(100);
    const label = conceptFrom(
      { overall: 50, accuracy: 4, missedConcept: null, gaps: [longGap] },
      "Working Capital",
    );
    expect(label.length).toBeLessThanOrEqual(60);
    expect(label.endsWith("…")).toBe(true);
  });

  it("falls back to the subtopic name last", () => {
    expect(
      conceptFrom({ overall: 50, accuracy: 4, missedConcept: null, gaps: [] }, "Paper LBO"),
    ).toBe("Review: Paper LBO");
  });
});

describe("spaced schedule", () => {
  it("first check lands 2 days after resolve", () => {
    expect(firstCheckAt(0)).toBe(2 * DAY);
  });

  it("stage-0 pass advances to stage 1 at +7d", () => {
    const t = afterSpotCheck(0, true, 0);
    expect(t).toEqual({ kind: "advance", checkStage: 1, nextCheckAt: 7 * DAY });
  });

  it("stage-1 pass clears for good", () => {
    expect(afterSpotCheck(1, true, 0)).toEqual({ kind: "cleared" });
  });

  it("any fail reopens", () => {
    expect(afterSpotCheck(0, false, 0)).toEqual({ kind: "reopen" });
    expect(afterSpotCheck(1, false, 0)).toEqual({ kind: "reopen" });
  });
});

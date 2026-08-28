import { describe, expect, it } from "vitest";
import {
  containsNumber,
  decideInterruption,
  fillerStreakIn,
  type InterruptState,
  type PersonaInterruptProfile,
} from "./interruption";

const NEVER: PersonaInterruptProfile = {
  patienceMs: null,
  rambleCharThreshold: null,
  stallPauseMs: null,
  fillerStreakLimit: null,
  maxInterjectionsPerQuestion: 2,
};

const AGGRESSIVE: PersonaInterruptProfile = {
  patienceMs: 20_000,
  rambleCharThreshold: 400,
  stallPauseMs: 2500,
  fillerStreakLimit: 3,
  maxInterjectionsPerQuestion: 2,
};

function state(overrides: Partial<InterruptState>): InterruptState {
  return {
    profile: AGGRESSIVE,
    elapsedMs: 0,
    transcriptChars: 100,
    hasNumber: false,
    fillerStreak: 0,
    midAnswerPauseMs: null,
    interjectionsUsed: 0,
    ...overrides,
  };
}

describe("decideInterruption", () => {
  it("null-threshold personas never fire", () => {
    expect(
      decideInterruption(
        state({
          profile: NEVER,
          elapsedMs: 999_999,
          transcriptChars: 10_000,
          fillerStreak: 99,
          midAnswerPauseMs: 60_000,
        }),
      ),
    ).toBeNull();
  });

  it("time trigger fires at the patience cap", () => {
    expect(decideInterruption(state({ elapsedMs: 19_999 }))).toBeNull();
    expect(decideInterruption(state({ elapsedMs: 20_000 }))).toBe("time");
  });

  it("ramble fires only without a number", () => {
    expect(decideInterruption(state({ transcriptChars: 500, hasNumber: true }))).toBeNull();
    expect(decideInterruption(state({ transcriptChars: 500, hasNumber: false }))).toBe("ramble");
  });

  it("filler streak fires at the limit", () => {
    expect(decideInterruption(state({ fillerStreak: 2 }))).toBeNull();
    expect(decideInterruption(state({ fillerStreak: 3 }))).toBe("filler");
  });

  it("stall fires on a long mid-answer pause but never before she has spoken", () => {
    expect(decideInterruption(state({ midAnswerPauseMs: 2600 }))).toBe("stall");
    expect(decideInterruption(state({ midAnswerPauseMs: 2600, transcriptChars: 0 }))).toBeNull();
    expect(decideInterruption(state({ midAnswerPauseMs: 1000 }))).toBeNull();
  });

  it("precedence: stall > filler > ramble > time", () => {
    const all = state({
      elapsedMs: 60_000,
      transcriptChars: 999,
      hasNumber: false,
      fillerStreak: 5,
      midAnswerPauseMs: 5000,
    });
    expect(decideInterruption(all)).toBe("stall");
    expect(decideInterruption({ ...all, midAnswerPauseMs: null })).toBe("filler");
    expect(decideInterruption({ ...all, midAnswerPauseMs: null, fillerStreak: 0 })).toBe("ramble");
    expect(
      decideInterruption({ ...all, midAnswerPauseMs: null, fillerStreak: 0, hasNumber: true }),
    ).toBe("time");
  });

  it("respects the per-question interjection cap", () => {
    expect(decideInterruption(state({ elapsedMs: 60_000, interjectionsUsed: 2 }))).toBeNull();
  });
});

describe("containsNumber", () => {
  it("detects digits and number words", () => {
    expect(containsNumber("EBITDA of 100")).toBe(true);
    expect(containsNumber("about ten percent")).toBe(true);
    expect(containsNumber("half of the cash flow")).toBe(true);
    expect(containsNumber("the statements all connect")).toBe(false);
  });
});

describe("fillerStreakIn", () => {
  it("counts fillers only in the trailing window", () => {
    const early = `um um um ${Array(30).fill("word").join(" ")}`;
    expect(fillerStreakIn(early)).toBe(0);
    const late = `${Array(30).fill("word").join(" ")} um you know like uh`;
    expect(fillerStreakIn(late)).toBe(4);
  });
});

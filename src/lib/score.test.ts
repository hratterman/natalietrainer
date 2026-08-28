import { describe, expect, it } from "vitest";
import { tierFromMastery, tierFromOverall, tierFromRubric } from "./score";

describe("score tiers", () => {
  it("overall (0-100): 80/60 boundaries", () => {
    expect(tierFromOverall(100)).toBe("good");
    expect(tierFromOverall(80)).toBe("good");
    expect(tierFromOverall(79.9)).toBe("warn");
    expect(tierFromOverall(60)).toBe("warn");
    expect(tierFromOverall(59.9)).toBe("bad");
    expect(tierFromOverall(0)).toBe("bad");
  });

  it("rubric (0-10): 7/4 boundaries", () => {
    expect(tierFromRubric(10)).toBe("good");
    expect(tierFromRubric(7)).toBe("good");
    expect(tierFromRubric(6.9)).toBe("warn");
    expect(tierFromRubric(4)).toBe("warn");
    expect(tierFromRubric(3.9)).toBe("bad");
  });

  it("mastery (0-1): four bands at .8/.6/.4", () => {
    expect(tierFromMastery(0.9)).toBe("good");
    expect(tierFromMastery(0.8)).toBe("good");
    expect(tierFromMastery(0.79)).toBe("ok");
    expect(tierFromMastery(0.6)).toBe("ok");
    expect(tierFromMastery(0.59)).toBe("warn");
    expect(tierFromMastery(0.4)).toBe("warn");
    expect(tierFromMastery(0.39)).toBe("bad");
  });
});

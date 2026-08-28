import { describe, expect, it } from "vitest";
import { computeDeliveryMetrics, describeDelivery } from "./deliveryMetrics";

describe("computeDeliveryMetrics", () => {
  it("computes wpm from speaking time", () => {
    const transcript = Array(150).fill("word").join(" ");
    const m = computeDeliveryMetrics(transcript, { audioDurationMs: 60_000, pausesMs: [] });
    expect(m.wordCount).toBe(150);
    expect(m.wpm).toBe(150);
  });

  it("returns null wpm for too-short samples or broken timing", () => {
    expect(computeDeliveryMetrics("just four words here", { audioDurationMs: 1000, pausesMs: [] }).wpm).toBeNull();
    expect(computeDeliveryMetrics("a b", { audioDurationMs: 60_000, pausesMs: [] }).wpm).toBeNull();
    // absurd rate → null
    const fast = Array(1000).fill("w").join(" ");
    expect(computeDeliveryMetrics(fast, { audioDurationMs: 5000, pausesMs: [] }).wpm).toBeNull();
    expect(computeDeliveryMetrics(fast, null).wpm).toBeNull();
  });

  it("counts fillers and hedges conservatively", () => {
    const m = computeDeliveryMetrics(
      "Um, so I think net income falls, uh, you know, by seven fifty. I mean, it's sort of like, the tax shield, maybe.",
      null,
    );
    // um, uh, you know, i mean, sort of, "like," → 6 fillers
    expect(m.fillerCount).toBe(6);
    // i think, maybe → 2 hedges
    expect(m.hedgeCount).toBe(2);
  });

  it("does not count bare 'like' as a filler", () => {
    const m = computeDeliveryMetrics("Companies like Amazon run negative working capital.", null);
    expect(m.fillerCount).toBe(0);
  });

  it("summarizes pauses", () => {
    const m = computeDeliveryMetrics("some answer text here that is long enough", {
      audioDurationMs: 10_000,
      pausesMs: [800, 2400, 1200],
    });
    expect(m.pauseCount).toBe(3);
    expect(m.longestPauseMs).toBe(2400);
  });
});

describe("describeDelivery", () => {
  it("renders a compact annotation", () => {
    const s = describeDelivery(
      { wordCount: 120, wpm: 162, fillerCount: 4, hedgeCount: 2, pauseCount: 1, longestPauseMs: 1800 },
      "cut_off",
    );
    expect(s).toContain("162 wpm");
    expect(s).toContain("4 fillers");
    expect(s).toContain("cut off by interviewer");
  });

  it("returns null without metrics", () => {
    expect(describeDelivery(null, null)).toBeNull();
  });
});

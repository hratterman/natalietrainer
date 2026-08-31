import { describe, expect, it } from "vitest";
import {
  applyVerdict,
  effectiveScale,
  intakeDays,
  buildQueue,
  calibrateReviewSec,
  COLD_AT_STEP,
  COLD_INTERVAL_DAYS,
  daysUntil,
  dayStart,
  DAY_MS,
  DEFAULT_REVIEW_SEC,
  FINAL_SWEEP_DAYS,
  ladderScale,
  MIN_LADDER_SCALE,
  parseLocalDate,
  projectPace,
  remainingTailDays,
  SOLIDIFY_LADDER_DAYS,
  type ItemState,
} from "./scheduler";
import type { BookletItem } from "./types";

const NOW = new Date(2026, 2, 1, 12, 30).getTime(); // local Mar 1, 12:30
const TODAY = dayStart(NOW);

function state(partial: Partial<ItemState>): ItemState {
  return {
    phase: "solidifying",
    step: 0,
    lapses: 0,
    dueAt: TODAY,
    lastSuccessAt: NOW - 3 * DAY_MS,
    introducedAt: NOW - 5 * DAY_MS,
    ...partial,
  };
}

/** No-deadline context: the ladder runs at full length. */
const FREE = { superdayMs: null, scale: 1 };
const ctx = (superdayMs: number | null, scale = 1) => ({ superdayMs, scale });

function item(id: string, sectionId = "accounting-basic"): BookletItem {
  return {
    id,
    sectionId,
    sectionName: sectionId,
    question: `q ${id}`,
    answer: `a ${id}`,
    deck: "technical",
  };
}

describe("applyVerdict", () => {
  it("first-ever right recall meets criterion: solidifying, first ladder interval", () => {
    const t = applyVerdict(null, "right", NOW, FREE);
    expect(t.requeue).toBe(false);
    expect(t.next.phase).toBe("solidifying");
    expect(t.next.step).toBe(0);
    expect(t.next.dueAt).toBe(TODAY + SOLIDIFY_LADDER_DAYS[0] * DAY_MS);
    expect(t.next.introducedAt).toBe(NOW);
  });

  it("first-ever miss starts learning and requeues in-session", () => {
    const t = applyVerdict(null, "wrong", NOW, FREE);
    expect(t.requeue).toBe(true);
    expect(t.next.phase).toBe("learning");
    expect(t.next.lapses).toBe(0); // a first miss is not a lapse
    expect(t.next.dueAt).toBe(NOW);
  });

  it("learning + partial keeps requeueing until fully right", () => {
    const t = applyVerdict(state({ phase: "learning" }), "partial", NOW, FREE);
    expect(t.requeue).toBe(true);
    expect(t.next.phase).toBe("learning");
  });

  it("solidifying rights climb the ladder and turn cold at the top", () => {
    const s1 = applyVerdict(state({ step: 0 }), "right", NOW, FREE);
    expect(s1.next.step).toBe(1);
    expect(s1.next.dueAt).toBe(TODAY + SOLIDIFY_LADDER_DAYS[1] * DAY_MS);

    const s3 = applyVerdict(state({ step: COLD_AT_STEP - 1 }), "right", NOW, FREE);
    expect(s3.next.phase).toBe("cold");
    expect(s3.next.dueAt).toBe(TODAY + COLD_INTERVAL_DAYS * DAY_MS);
  });

  it("solidifying partial retries tomorrow without advancing or lapsing", () => {
    const t = applyVerdict(state({ step: 1 }), "partial", NOW, FREE);
    expect(t.requeue).toBe(false);
    expect(t.next.step).toBe(1);
    expect(t.next.lapses).toBe(0);
    expect(t.next.dueAt).toBe(TODAY + DAY_MS);
  });

  it("wrong in solidifying or cold is a lapse back to learning", () => {
    for (const phase of ["solidifying", "cold"] as const) {
      const t = applyVerdict(state({ phase, step: 2, lapses: 1 }), "wrong", NOW, FREE);
      expect(t.requeue).toBe(true);
      expect(t.next).toMatchObject({ phase: "learning", step: 0, lapses: 2 });
    }
  });

  it("cold + right stays cold on the maintenance interval", () => {
    const t = applyVerdict(state({ phase: "cold", step: COLD_AT_STEP }), "right", NOW, FREE);
    expect(t.next.phase).toBe("cold");
    expect(t.next.dueAt).toBe(TODAY + COLD_INTERVAL_DAYS * DAY_MS);
  });
});

describe("deadline compression", () => {
  const superday = TODAY + 10 * DAY_MS;

  it("shrinks intervals when the runway is short and never past the sweep", () => {
    expect(ladderScale(superday, NOW)).toBeLessThan(1);
    expect(ladderScale(null, NOW)).toBe(1);
    // Past deadlines behave like none.
    expect(ladderScale(TODAY - DAY_MS, NOW)).toBe(1);

    const t = applyVerdict(state({ phase: "cold", step: COLD_AT_STEP }), "right", NOW, ctx(superday, 0.5));
    const sweepStart = superday - FINAL_SWEEP_DAYS * DAY_MS;
    expect(t.next.dueAt).toBeLessThanOrEqual(sweepStart);
  });

  it("reserved intake days compress the ladder further, down to the floor", () => {
    const far = TODAY + 40 * DAY_MS;
    expect(ladderScale(far, NOW, 0)).toBe(1);
    expect(ladderScale(far, NOW, 20)).toBeLessThan(1);
    expect(ladderScale(far, NOW, 999)).toBe(MIN_LADDER_SCALE);

    // effectiveScale derives those reserved days from the intake backlog.
    expect(intakeDays(0, 120)).toBe(0);
    expect(intakeDays(277, 120)).toBeGreaterThan(10);
    const backlogged = effectiveScale({
      superdayMs: far,
      newRemaining: 277,
      dailyMinutes: 120,
      now: NOW,
    });
    expect(backlogged).toBeLessThan(effectiveScale({
      superdayMs: far,
      newRemaining: 0,
      dailyMinutes: 120,
      now: NOW,
    }));
  });

  it("inside the sweep window everything lands tomorrow at the latest", () => {
    const imminent = TODAY + 1 * DAY_MS;
    const t = applyVerdict(state({ step: 0 }), "right", NOW, ctx(imminent, 0.5));
    expect(t.next.dueAt).toBe(TODAY + DAY_MS);
  });
});

describe("buildQueue", () => {
  it("orders carryover, then interleaved reviews, then new intake", () => {
    const items = [
      item("acct-1", "acct"),
      item("acct-2", "acct"),
      item("val-1", "val"),
      item("val-2", "val"),
      item("lbo-1", "lbo"),
    ];
    const states = new Map<string, ItemState>([
      ["acct-1", state({ phase: "learning", dueAt: NOW - 1000 })],
      ["acct-2", state({ dueAt: TODAY })],
      ["val-1", state({ dueAt: TODAY - DAY_MS })],
    ]);
    const plan = buildQueue({ items, states, superdayMs: null, dailyMinutes: 90, now: NOW });
    expect(plan.entries.map((e) => e.kind)).toEqual(["carryover", "review", "review", "new", "new"]);
    expect(plan.entries[0]?.itemId).toBe("acct-1");
    // Reviews interleave sections: overdue val-1 first, then acct-2.
    expect(plan.entries.slice(1, 3).map((e) => e.itemId)).toEqual(["val-1", "acct-2"]);
    expect(plan.newCount).toBe(2);
    expect(plan.estMinutes).toBeGreaterThan(0);
  });

  it("future-due items and non-due days produce an empty queue", () => {
    const items = [item("a")];
    const states = new Map([["a", state({ phase: "cold", dueAt: TODAY + 5 * DAY_MS })]]);
    const plan = buildQueue({ items, states, superdayMs: null, dailyMinutes: 90, now: NOW });
    expect(plan.entries).toEqual([]);
  });

  it("new intake is bounded by the daily time budget", () => {
    const items = Array.from({ length: 100 }, (_, i) => item(`i${i}`));
    const plan = buildQueue({
      items,
      states: new Map(),
      superdayMs: null,
      dailyMinutes: 10, // 600s → 4 new at 150s each
      now: NOW,
    });
    expect(plan.newCount).toBe(4);
  });

  it("a short runway raises the intake target above the steady default", () => {
    const items = Array.from({ length: 250 }, (_, i) => item(`i${i}`));
    const relaxed = buildQueue({ items, states: new Map(), superdayMs: null, dailyMinutes: 600, now: NOW });
    const urgent = buildQueue({
      items,
      states: new Map(),
      superdayMs: TODAY + 12 * DAY_MS,
      dailyMinutes: 600,
      now: NOW,
    });
    expect(relaxed.newCount).toBe(20);
    expect(urgent.newCount).toBeGreaterThan(20);
  });
});

describe("projectPace", () => {
  it("no deadline: projects a cold-by date and no pace verdict", () => {
    const p = projectPace({
      newRemaining: 100,
      learningCount: 0,
      solidifyingTailDays: [],
      superdayMs: null,
      dailyMinutes: 90,
      now: NOW,
    });
    expect(p.onPace).toBeNull();
    expect(p.remaining).toBe(100);
    expect(p.coldByMs).toBeGreaterThan(TODAY + SOLIDIFY_LADDER_DAYS[0] * DAY_MS);
    expect(p.totalMinutesLeft).toBeGreaterThan(60);
  });

  it("recoverable deadline: suggests a budget that genuinely lands in time", () => {
    const args = {
      newRemaining: 277,
      learningCount: 0,
      solidifyingTailDays: [] as number[],
      superdayMs: TODAY + 24 * DAY_MS,
      now: NOW,
    };
    const thin = projectPace({ ...args, dailyMinutes: 60 });
    expect(thin.onPace).toBe(false);
    expect(thin.suggestedDailyMinutes).toBeGreaterThan(60);

    // The advice has to actually work when taken — a suggestion that still
    // misses the sweep is worse than none.
    const taken = projectPace({ ...args, dailyMinutes: thin.suggestedDailyMinutes! });
    expect(taken.onPace).toBe(true);
  });

  it("the whole deck at 2h/day with 3+ weeks is on pace (compression covers the tail)", () => {
    // Regression: the ladder used to compress against the full runway while
    // ignoring the ~15 intake days ahead of it, so this read "off pace" and
    // demanded 6h/day even though only ~35h of work remained.
    const p = projectPace({
      newRemaining: 277,
      learningCount: 0,
      solidifyingTailDays: [],
      superdayMs: TODAY + 24 * DAY_MS,
      dailyMinutes: 120,
      now: NOW,
    });
    expect(p.onPace).toBe(true);
    expect(p.totalMinutesLeft).toBeLessThan(40 * 60);
  });

  it("an impossible deadline says so instead of inventing a number", () => {
    const p = projectPace({
      newRemaining: 277,
      learningCount: 0,
      solidifyingTailDays: [],
      superdayMs: TODAY + 8 * DAY_MS,
      dailyMinutes: 30,
      now: NOW,
    });
    expect(p.onPace).toBe(false);
    expect(p.suggestedDailyMinutes).toBeNull();
  });

  it("comfortable deadline: on pace", () => {
    const p = projectPace({
      newRemaining: 20,
      learningCount: 0,
      solidifyingTailDays: [5],
      superdayMs: TODAY + 45 * DAY_MS,
      dailyMinutes: 120,
      now: NOW,
    });
    expect(p.onPace).toBe(true);
    expect(p.suggestedDailyMinutes).toBeNull();
  });

  it("everything cold projects zero remaining", () => {
    const p = projectPace({
      newRemaining: 0,
      learningCount: 0,
      solidifyingTailDays: [],
      superdayMs: TODAY + 30 * DAY_MS,
      dailyMinutes: 90,
      now: NOW,
    });
    expect(p.remaining).toBe(0);
    expect(p.totalMinutesLeft).toBe(0);
  });
});

describe("helpers", () => {
  it("parseLocalDate round-trips through daysUntil", () => {
    const ms = parseLocalDate("2026-03-11")!;
    expect(daysUntil(ms, NOW)).toBe(10);
    expect(parseLocalDate("2026-3-11")).toBeNull();
    expect(parseLocalDate("garbage")).toBeNull();
  });

  it("calibrateReviewSec needs data and clamps the median", () => {
    expect(calibrateReviewSec([])).toBe(DEFAULT_REVIEW_SEC);
    expect(calibrateReviewSec(Array(12).fill(60_000))).toBe(60);
    expect(calibrateReviewSec(Array(12).fill(999_000))).toBe(240);
    expect(calibrateReviewSec(Array(12).fill(1_000))).toBe(40);
  });

  it("remainingTailDays sums the ladder from the current step", () => {
    expect(remainingTailDays(state({ step: 1 }), 1)).toBe(
      SOLIDIFY_LADDER_DAYS[1] + SOLIDIFY_LADDER_DAYS[2],
    );
    expect(remainingTailDays(state({ phase: "cold", step: COLD_AT_STEP }), 1)).toBe(0);
  });
});

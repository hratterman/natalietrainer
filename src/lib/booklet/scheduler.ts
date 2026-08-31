import type { BookletItem, BookletPhase, BookletVerdict } from "./types";

/**
 * Pure booklet scheduling: successive relearning with a deadline.
 *
 * Evidence base, mapped to code:
 * - Retrieval practice: every touch is a recall attempt (the queue only ever
 *   asks; reading happens in the feedback step).
 * - Successive relearning (Rawson & Dunlosky): learn to criterion (one fully
 *   correct recall), then re-prove it on {@link SOLIDIFY_LADDER_DAYS} spaced
 *   occasions; only then is an item "cold".
 * - Spacing compressed toward the deadline: with a superday date set, the
 *   ladder scales down so the final re-proof still lands before the
 *   {@link FINAL_SWEEP_DAYS} pre-superday sweep.
 * - Interleaving: the queue round-robins across sections instead of
 *   blocking one topic at a time.
 *
 * All time values are epoch ms; day boundaries use the server's local
 * timezone (single-user app running on the household machine).
 */

export const DAY_MS = 86_400_000;

/** Spaced re-proof intervals (days) after the first correct recall. */
export const SOLIDIFY_LADDER_DAYS = [3, 7, 16] as const;
/** Successful spaced recalls required to call an item cold. */
export const COLD_AT_STEP = SOLIDIFY_LADDER_DAYS.length;
/** Maintenance interval once cold. */
export const COLD_INTERVAL_DAYS = 21;
/** Everything resurfaces in the last N days before the superday. */
export const FINAL_SWEEP_DAYS = 2;
/** Floor on ladder compression — below this, "spaced" stops meaning anything. */
export const MIN_LADDER_SCALE = 0.25;

/** Default seconds per rep, until real timings recalibrate them. */
export const DEFAULT_REVIEW_SEC = 75;
export const NEW_ITEM_FACTOR = 2; // first-touch ≈ 2× a review

/** No deadline set: steady default intake. */
const DEFAULT_NEW_PER_DAY = 20;
const MAX_QUEUE = 150;
/** Ceiling on what the pacing advice will ask of her in one day. */
const MAX_SUGGESTED_MINUTES = 240;

export type ItemState = {
  phase: BookletPhase;
  step: number;
  lapses: number;
  dueAt: number;
  lastSuccessAt: number | null;
  introducedAt: number;
};

// ---- local-day helpers -----------------------------------------------------

export function dayStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local YYYY-MM-DD → epoch ms at local midnight; null for bad input. */
export function parseLocalDate(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const ms = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Whole local days from `now` until `deadline` (its local midnight). */
export function daysUntil(deadlineMs: number, now: number): number {
  return Math.round((dayStart(deadlineMs) - dayStart(now)) / DAY_MS);
}

// ---- deadline compression --------------------------------------------------

const FULL_LADDER_DAYS = SOLIDIFY_LADDER_DAYS.reduce<number>((a, b) => a + b, 0);

/**
 * Days needed to introduce `newRemaining` items at a given daily budget,
 * costing each item its first touch plus the reviews it will pull along.
 */
export function intakeDays(
  newRemaining: number,
  dailyMinutes: number,
  reviewSec = DEFAULT_REVIEW_SEC,
): number {
  if (newRemaining <= 0) return 0;
  const perItemSec = reviewSec * NEW_ITEM_FACTOR + COLD_AT_STEP * reviewSec;
  const perDay = Math.max(1, Math.floor((dailyMinutes * 60) / perItemSec));
  return Math.ceil(newRemaining / perDay);
}

/**
 * Ladder scale for the runway that is actually left for spacing. 1 with no
 * deadline or a comfortable one; compresses as the superday approaches.
 *
 * `reservedDays` is time the ladder cannot use — above all the intake days
 * still ahead, since the LAST question introduced still needs its full
 * ladder before the sweep. Ignoring that is what makes a deadline look
 * unreachable when the real problem is just uncompressed spacing.
 */
export function ladderScale(
  superdayMs: number | null,
  now: number,
  reservedDays = 0,
): number {
  if (superdayMs == null) return 1;
  const days = daysUntil(superdayMs, now);
  if (days <= 0) return 1;
  const usable = days - FINAL_SWEEP_DAYS - reservedDays;
  return Math.min(1, Math.max(MIN_LADDER_SCALE, usable / FULL_LADDER_DAYS));
}

/** The scale in force given everything still to introduce. */
export function effectiveScale(input: {
  superdayMs: number | null;
  newRemaining: number;
  dailyMinutes: number;
  now: number;
  reviewSec?: number;
}): number {
  const reviewSec = input.reviewSec ?? DEFAULT_REVIEW_SEC;
  return ladderScale(
    input.superdayMs,
    input.now,
    intakeDays(input.newRemaining, input.dailyMinutes, reviewSec),
  );
}

function scaledInterval(step: number, scale: number): number {
  const base = SOLIDIFY_LADDER_DAYS[step] ?? COLD_INTERVAL_DAYS;
  return Math.max(1, Math.round(base * scale));
}

/** Cap a due date so nothing hides past the pre-superday sweep. */
function capDue(dueMs: number, superdayMs: number | null, now: number): number {
  if (superdayMs == null) return dueMs;
  const sweepStart = dayStart(superdayMs) - FINAL_SWEEP_DAYS * DAY_MS;
  if (sweepStart <= dayStart(now)) return Math.min(dueMs, dayStart(now) + DAY_MS);
  return Math.min(dueMs, sweepStart);
}

// ---- verdict → next state --------------------------------------------------

/** Deadline + the ladder compression in force for it. */
export type ScheduleContext = { superdayMs: number | null; scale: number };

export type Transition = {
  next: ItemState;
  /** Re-ask later in the same session until she gets it fully right. */
  requeue: boolean;
};

/**
 * Apply a graded recall to an item's state. `state` is null for a first-ever
 * attempt. "partial" advances nothing but is not a lapse: retry tomorrow.
 * "wrong" in solidifying/cold is a lapse — back to learning, ladder resets.
 */
export function applyVerdict(
  state: ItemState | null,
  verdict: BookletVerdict,
  now: number,
  ctx: ScheduleContext,
): Transition {
  const { superdayMs, scale } = ctx;
  const introducedAt = state?.introducedAt ?? now;
  const lapses = state?.lapses ?? 0;
  const phase = state?.phase ?? "learning";

  if (verdict === "right") {
    const step = phase === "learning" ? 0 : Math.min(state!.step + 1, COLD_AT_STEP);
    const nowCold = phase !== "learning" && step >= COLD_AT_STEP;
    const nextPhase: BookletPhase = phase === "cold" || nowCold ? "cold" : "solidifying";
    const interval = scaledInterval(nextPhase === "cold" ? COLD_AT_STEP : step, scale);
    return {
      next: {
        phase: nextPhase,
        step: nextPhase === "cold" ? COLD_AT_STEP : step,
        lapses,
        dueAt: capDue(dayStart(now) + interval * DAY_MS, superdayMs, now),
        lastSuccessAt: now,
        introducedAt,
      },
      requeue: false,
    };
  }

  if (verdict === "partial") {
    if (phase === "learning" || state == null) {
      // Still short of criterion — go again this session.
      return {
        next: { phase: "learning", step: 0, lapses, dueAt: now, lastSuccessAt: state?.lastSuccessAt ?? null, introducedAt },
        requeue: true,
      };
    }
    return {
      next: {
        ...state,
        dueAt: capDue(dayStart(now) + DAY_MS, superdayMs, now),
      },
      requeue: false,
    };
  }

  // wrong
  const isLapse = phase !== "learning" && state != null;
  return {
    next: {
      phase: "learning",
      step: 0,
      lapses: isLapse ? lapses + 1 : lapses,
      dueAt: now,
      lastSuccessAt: state?.lastSuccessAt ?? null,
      introducedAt,
    },
    requeue: true,
  };
}

// ---- today's queue ---------------------------------------------------------

export type QueueEntry = {
  itemId: string;
  kind: "carryover" | "review" | "new";
};

export type QueuePlan = {
  entries: QueueEntry[];
  carryoverCount: number;
  reviewCount: number;
  newCount: number;
  estMinutes: number;
};

/** Round-robin across sections so topics interleave instead of blocking. */
function interleaveBySection(items: BookletItem[]): BookletItem[] {
  const bySection = new Map<string, BookletItem[]>();
  for (const item of items) {
    const list = bySection.get(item.sectionId) ?? [];
    list.push(item);
    bySection.set(item.sectionId, list);
  }
  const buckets = [...bySection.values()];
  const out: BookletItem[] = [];
  for (let i = 0; out.length < items.length; i++) {
    for (const bucket of buckets) {
      const next = bucket[i];
      if (next !== undefined) out.push(next);
    }
  }
  return out;
}

export function buildQueue(input: {
  /** Technical-deck items in booklet order. */
  items: BookletItem[];
  states: Map<string, ItemState>;
  superdayMs: number | null;
  dailyMinutes: number;
  now: number;
  reviewSec?: number;
}): QueuePlan {
  const { items, states, superdayMs, dailyMinutes, now } = input;
  const reviewSec = input.reviewSec ?? DEFAULT_REVIEW_SEC;
  const newSec = reviewSec * NEW_ITEM_FACTOR;
  const dayEnd = dayStart(now) + DAY_MS;

  const carryover: BookletItem[] = [];
  const due: BookletItem[] = [];
  const fresh: BookletItem[] = [];
  for (const item of items) {
    const state = states.get(item.id);
    if (!state) fresh.push(item);
    else if (state.phase === "learning" && state.dueAt < dayEnd) carryover.push(item);
    else if (state.dueAt < dayEnd) due.push(item);
  }
  due.sort((a, b) => states.get(a.id)!.dueAt - states.get(b.id)!.dueAt);
  const reviews = interleaveBySection(due);

  // Intake pace: the deadline sets a FLOOR (the rate that spreads remaining
  // new items over the runway, reserving the ladder tail + sweep) — earlier
  // intake buys more spacing, so the steady default applies even when the
  // floor is lower. Always bounded by what fits in today's minutes after
  // reviews.
  let target = DEFAULT_NEW_PER_DAY;
  if (superdayMs != null) {
    const days = daysUntil(superdayMs, now);
    if (days > 0) {
      const scale = effectiveScale({
        superdayMs,
        newRemaining: fresh.length,
        dailyMinutes,
        now,
        reviewSec,
      });
      const ladderTail = SOLIDIFY_LADDER_DAYS.reduce<number>(
        (sum, d) => sum + Math.max(1, Math.round(d * scale)),
        0,
      );
      const introDays = Math.max(1, days - FINAL_SWEEP_DAYS - ladderTail);
      target = Math.max(DEFAULT_NEW_PER_DAY, Math.ceil(fresh.length / introDays));
    }
  }
  const spentSec = (carryover.length + reviews.length) * reviewSec;
  const budgetSec = Math.max(0, dailyMinutes * 60 - spentSec);
  const fits = Math.floor(budgetSec / newSec);
  const newCount = Math.max(0, Math.min(target, fits, fresh.length));
  const newcomers = interleaveBySection(fresh).slice(0, newCount);

  const entries: QueueEntry[] = [
    ...carryover.map((i) => ({ itemId: i.id, kind: "carryover" as const })),
    ...reviews.map((i) => ({ itemId: i.id, kind: "review" as const })),
    ...newcomers.map((i) => ({ itemId: i.id, kind: "new" as const })),
  ].slice(0, MAX_QUEUE);

  return {
    entries,
    carryoverCount: carryover.length,
    reviewCount: reviews.length,
    newCount: newcomers.length,
    estMinutes: Math.round(((carryover.length + reviews.length) * reviewSec + newcomers.length * newSec) / 60),
  };
}

// ---- pacing projection -----------------------------------------------------

export type Projection = {
  /** Items not yet cold. */
  remaining: number;
  /** Estimated total study time left to take everything cold, minutes. */
  totalMinutesLeft: number;
  /** Projected local-midnight ms when the last item turns cold. */
  coldByMs: number;
  /** With a deadline: does coldBy land before the final sweep? */
  onPace: boolean | null;
  /** Minutes/day that would put her on pace (null when already on pace or no deadline). */
  suggestedDailyMinutes: number | null;
};

/**
 * Deterministic closed-form pacing. Assumes the criterion is met the day an
 * item is introduced and re-proofs succeed (lapses are covered by the ~20%
 * rep allowance in the time estimate) — an honest "if the work happens"
 * projection, not a promise.
 */
export function projectPace(input: {
  newRemaining: number;
  learningCount: number;
  /** Remaining ladder days summed for every solidifying item. */
  solidifyingTailDays: number[];
  superdayMs: number | null;
  dailyMinutes: number;
  now: number;
  reviewSec?: number;
}): Projection {
  const { newRemaining, learningCount, solidifyingTailDays, superdayMs, dailyMinutes, now } = input;
  const reviewSec = input.reviewSec ?? DEFAULT_REVIEW_SEC;
  const newSec = reviewSec * NEW_ITEM_FACTOR;
  const perItemSec = newSec + COLD_AT_STEP * reviewSec;

  const toIntroduce = newRemaining + learningCount;
  const remaining = toIntroduce + solidifyingTailDays.length;
  const pipelineTail = solidifyingTailDays.reduce((max, t) => Math.max(max, t), 0);

  /**
   * Days until the last item goes cold at a given budget. Both the ladder
   * (via the reserved-intake scale) and the intake rate move with the
   * budget, so the pace suggestion below has to search this same function
   * rather than invert a formula.
   */
  function daysToCold(minutes: number): number {
    const scale = effectiveScale({
      superdayMs,
      newRemaining: toIntroduce,
      dailyMinutes: minutes,
      now,
      reviewSec,
    });
    const ladderSum = SOLIDIFY_LADDER_DAYS.reduce<number>(
      (sum, d) => sum + Math.max(1, Math.round(d * scale)),
      0,
    );
    const perDay = Math.max(1, Math.floor((minutes * 60) / perItemSec));
    const introDays = toIntroduce > 0 ? Math.ceil(toIntroduce / perDay) : 0;
    return Math.max(introDays > 0 ? introDays + ladderSum : 0, pipelineTail);
  }

  // Time: intro rep + 3 re-proofs per not-yet-cold item, +20% for lapses.
  const scale = effectiveScale({
    superdayMs,
    newRemaining: toIntroduce,
    dailyMinutes,
    now,
    reviewSec,
  });
  const lastRung = Math.max(1, Math.round(SOLIDIFY_LADDER_DAYS[COLD_AT_STEP - 1]! * scale));
  const reviewReps =
    toIntroduce * COLD_AT_STEP +
    solidifyingTailDays.reduce((n, tail) => n + Math.max(1, Math.ceil(tail / lastRung)), 0);
  const totalSec = (toIntroduce * newSec + reviewReps * reviewSec) * 1.2;
  const totalMinutesLeft = Math.round(totalSec / 60);

  const coldByMs = dayStart(now) + daysToCold(dailyMinutes) * DAY_MS;

  let onPace: boolean | null = null;
  let suggestedDailyMinutes: number | null = null;
  if (superdayMs != null && remaining > 0) {
    const sweepStart = dayStart(superdayMs) - FINAL_SWEEP_DAYS * DAY_MS;
    onPace = coldByMs <= sweepStart;
    if (!onPace) {
      // Smallest quarter-hour budget that actually lands before the sweep.
      for (let m = dailyMinutes + 15; m <= MAX_SUGGESTED_MINUTES; m += 15) {
        if (dayStart(now) + daysToCold(m) * DAY_MS <= sweepStart) {
          suggestedDailyMinutes = m;
          break;
        }
      }
    }
  }

  return { remaining, totalMinutesLeft, coldByMs, onPace, suggestedDailyMinutes };
}

/** Median observed rep time, clamped to sane bounds; default until enough data. */
export function calibrateReviewSec(durationsMs: number[]): number {
  if (durationsMs.length < 10) return DEFAULT_REVIEW_SEC;
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const median = (sorted[Math.floor(sorted.length / 2)] ?? DEFAULT_REVIEW_SEC * 1000) / 1000;
  return Math.min(240, Math.max(40, Math.round(median)));
}

/** Remaining ladder days for a solidifying item (for projections). */
export function remainingTailDays(state: ItemState, scale: number): number {
  if (state.phase !== "solidifying") return 0;
  let days = 0;
  for (let s = state.step; s < COLD_AT_STEP; s++) {
    days += Math.max(1, Math.round((SOLIDIFY_LADDER_DAYS[s] ?? 0) * scale));
  }
  return days;
}

import { DIFFICULTY_MAX, DIFFICULTY_MIN } from "@/content/types";

/** Recency-dominant smoothing — right for a pre-superday cram. */
export const EWMA_ALPHA = 0.3;

/** Days without practice before a subtopic renders as stale. */
export const STALE_AFTER_DAYS = 7;

export type MasteryState = {
  score: number; // 0–1 EWMA
  attempts: number;
  currentDifficulty: number;
  lastAttemptAt: number; // epoch ms
  /** Overall grades (0–100) of recent attempts, newest last; drives difficulty steps. */
  recentOverall: number[];
};

export function initialMasteryState(now: number): MasteryState {
  return {
    score: 0,
    attempts: 0,
    currentDifficulty: 2,
    lastAttemptAt: now,
    recentOverall: [],
  };
}

/**
 * A grade's contribution, weighted by question difficulty: a difficulty-5 win
 * moves mastery more than a difficulty-1 win.
 */
export function effectiveScore(overall: number, difficulty: number): number {
  const s = overall / 100;
  return Math.min(1, s * (0.7 + 0.1 * difficulty));
}

export function ewmaUpdate(previous: number, effective: number, attempts: number): number {
  if (attempts === 0) return effective;
  return EWMA_ALPHA * effective + (1 - EWMA_ALPHA) * previous;
}

/**
 * Adaptive difficulty stepping: two consecutive overalls >= 75 at the current
 * level step up; any overall < 40 steps down. Clamped to [1,5] and to the
 * archetype's difficulty range at question-selection time.
 */
export function nextDifficulty(current: number, recentOverall: number[]): number {
  const last = recentOverall[recentOverall.length - 1];
  const prev = recentOverall[recentOverall.length - 2];
  let next = current;
  if (last !== undefined && last < 40) {
    next = current - 1;
  } else if (last !== undefined && prev !== undefined && last >= 75 && prev >= 75) {
    next = current + 1;
  }
  return clampDifficulty(next);
}

export function clampDifficulty(d: number, range?: [number, number]): number {
  const lo = Math.max(DIFFICULTY_MIN, range?.[0] ?? DIFFICULTY_MIN);
  const hi = Math.min(DIFFICULTY_MAX, range?.[1] ?? DIFFICULTY_MAX);
  return Math.min(hi, Math.max(lo, d));
}

/** Apply one grade to a mastery state, returning the new state. */
export function applyGrade(
  state: MasteryState,
  overall: number,
  difficulty: number,
  now: number,
): MasteryState {
  const effective = effectiveScore(overall, difficulty);
  const score = ewmaUpdate(state.score, effective, state.attempts);
  const recentOverall = [...state.recentOverall.slice(-4), overall];
  // Difficulty steps reset the "two consecutive" streak once consumed.
  const steppedUp =
    nextDifficulty(state.currentDifficulty, recentOverall) > state.currentDifficulty;
  const currentDifficulty = nextDifficulty(state.currentDifficulty, recentOverall);
  return {
    score,
    attempts: state.attempts + 1,
    currentDifficulty,
    lastAttemptAt: now,
    recentOverall: steppedUp ? [] : recentOverall,
  };
}

export function isStale(lastAttemptAt: number, now: number): boolean {
  return now - lastAttemptAt > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

export type WeaknessInput = {
  subtopicId: string;
  score: number | null; // null = unexplored
  lastAttemptAt: number | null;
};

export type RankedWeakness = {
  subtopicId: string;
  priority: number;
  unexplored: boolean;
  stale: boolean;
};

/**
 * Weakness priority: low mastery dominates, staleness adds a bump, and
 * unexplored subtopics pin above everything explored.
 */
export function rankWeaknesses(inputs: WeaknessInput[], now: number): RankedWeakness[] {
  const ranked = inputs.map((input) => {
    const unexplored = input.score === null;
    const stale =
      !unexplored && input.lastAttemptAt !== null && isStale(input.lastAttemptAt, now);
    const priority = unexplored
      ? 2 // above any explored subtopic (max explored priority is 1.2)
      : 1 - (input.score ?? 0) + (stale ? 0.2 : 0);
    return { subtopicId: input.subtopicId, priority, unexplored, stale };
  });
  return ranked.sort((a, b) => b.priority - a.priority);
}

/** Deterministic mulberry32 PRNG so adaptive selection is testable. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SelectionCandidate = {
  subtopicId: string;
  /** Weakness priority from rankWeaknesses. */
  priority: number;
  /** The containing area's sampling weight. */
  areaWeight: number;
  /** Mastery score (0–1) or null when unexplored. */
  score: number | null;
};

/**
 * Adaptive subtopic selection: 70% of picks follow weakness priority, 30%
 * reinforce strong subtopics (spaced practice), both scaled by area weight so
 * tier-1 areas dominate mixed sessions.
 */
export function pickSubtopic(
  candidates: SelectionCandidate[],
  rand: () => number,
): string | undefined {
  if (candidates.length === 0) return undefined;
  const reinforce = rand() < 0.3;
  const weights = candidates.map((c) => {
    const base = reinforce ? Math.max(0.05, c.score ?? 0) : Math.max(0.05, c.priority);
    return base * c.areaWeight;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) return candidates[i]?.subtopicId;
  }
  return candidates[candidates.length - 1]?.subtopicId;
}

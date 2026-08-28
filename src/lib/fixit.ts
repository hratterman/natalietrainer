/**
 * Fix-it queue policy: what counts as a miss, how the concept label is
 * derived, and the spaced-resurfacing schedule. Pure module — unit-testable,
 * no server deps.
 */

/** A grade qualifies as a miss when overall < 70 OR accuracy <= 5. */
export const MISS_OVERALL_BELOW = 70;
export const MISS_ACCURACY_AT_OR_BELOW = 5;

/** A proof/spot-check question passes at overall >= 70. */
export const PROOF_PASS_OVERALL = 70;
/** Consecutive proof passes required to resolve a fixit in a lesson. */
export const PROOF_PASSES_REQUIRED = 2;

/** Spot-check delays after resolve: stage 0 → +2d, stage 1 → +7d, then cleared. */
export const CHECK_DELAYS_DAYS = [2, 7] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export type MissGrade = {
  overall: number;
  accuracy: number;
  missedConcept?: string | null;
  gaps: string[];
};

export function qualifiesAsMiss(grade: { overall: number; accuracy: number }): boolean {
  return grade.overall < MISS_OVERALL_BELOW || grade.accuracy <= MISS_ACCURACY_AT_OR_BELOW;
}

export function proofPassed(overall: number): boolean {
  return overall >= PROOF_PASS_OVERALL;
}

/** Concept label: grader's missedConcept, else first gap (truncated), else the subtopic. */
export function conceptFrom(grade: MissGrade, subtopicName: string): string {
  const label = grade.missedConcept?.trim();
  if (label) return label.length > 80 ? `${label.slice(0, 77)}…` : label;
  const gap = grade.gaps[0]?.trim();
  if (gap) return gap.length > 60 ? `${gap.slice(0, 57)}…` : gap;
  return `Review: ${subtopicName}`;
}

export type CheckTransition =
  | { kind: "advance"; checkStage: number; nextCheckAt: number }
  | { kind: "cleared" }
  | { kind: "reopen" };

/**
 * State transition after a spot-check at `checkStage` (0-based).
 * Pass at the last stage clears the fixit for good.
 */
export function afterSpotCheck(checkStage: number, passed: boolean, now: number): CheckTransition {
  if (!passed) return { kind: "reopen" };
  const nextStage = checkStage + 1;
  if (nextStage >= CHECK_DELAYS_DAYS.length) return { kind: "cleared" };
  return {
    kind: "advance",
    checkStage: nextStage,
    nextCheckAt: now + CHECK_DELAYS_DAYS[nextStage]! * DAY_MS,
  };
}

/** When a fixit is resolved by proofs: first spot-check schedule. */
export function firstCheckAt(now: number): number {
  return now + CHECK_DELAYS_DAYS[0]! * DAY_MS;
}

/**
 * The single score-tier system. Every place that colors a number — the score
 * badge (0-100), rubric bars (0-10), mastery heatmap (0-1) — derives its tier
 * here so the thresholds and colors can never drift apart again.
 */

export type Tier = "good" | "ok" | "warn" | "bad";

/** Overall grades and debrief scores, 0-100. 80+ is offer-quality. */
export function tierFromOverall(overall: number): Tier {
  if (overall >= 80) return "good";
  if (overall >= 60) return "warn";
  return "bad";
}

/** Rubric dimensions, 0-10. */
export function tierFromRubric(score: number): Tier {
  if (score >= 7) return "good";
  if (score >= 4) return "warn";
  return "bad";
}

/** Mastery EWMA, 0-1. Four bands — the heatmap needs a mid step. */
export function tierFromMastery(score: number): Tier {
  if (score >= 0.8) return "good";
  if (score >= 0.6) return "ok";
  if (score >= 0.4) return "warn";
  return "bad";
}

/** Text color per tier (on light surfaces). */
export const TIER_TEXT: Record<Tier, string> = {
  good: "text-good",
  ok: "text-good/80",
  warn: "text-warn",
  bad: "text-bad",
};

/** Solid fill per tier (bars). */
export const TIER_FILL: Record<Tier, string> = {
  good: "bg-good",
  ok: "bg-good/70",
  warn: "bg-warn",
  bad: "bg-bad",
};

/** Tinted chip per tier (background + text + border). */
export const TIER_CHIP: Record<Tier, string> = {
  good: "bg-good-tint text-good border-good/30",
  ok: "bg-good-tint/70 text-good/90 border-good/20",
  warn: "bg-warn-tint text-warn border-warn/30",
  bad: "bg-bad-tint text-bad border-bad/30",
};

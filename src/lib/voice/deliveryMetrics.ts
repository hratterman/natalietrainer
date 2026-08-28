/**
 * Delivery metrics computed server-side from a spoken-answer transcript plus
 * client-reported timing. These are objective signals for the LLM grader —
 * floors, not verdicts (streaming STT under-reports fillers even in verbatim
 * mode).
 *
 * Pure module — unit-testable, no server deps.
 */

export type DeliveryTimings = {
  /** Total speaking time (summed VAD speech segments), ms. */
  audioDurationMs: number;
  /** Mid-answer pauses (speech_stopped→speech_started gaps below the turn-end window), ms each. */
  pausesMs: number[];
};

export type DeliveryMetrics = {
  wordCount: number;
  /** Words per minute over speaking time; null when timing is unusable. */
  wpm: number | null;
  fillerCount: number;
  hedgeCount: number;
  pauseCount: number;
  longestPauseMs: number;
};

// Conservative lists: unambiguous disfluencies/hedges only.
const FILLERS = [
  /\bum+\b/gi,
  /\buh+\b/gi,
  /\ber+m?\b/gi,
  /\byou know\b/gi,
  /\bsort of\b/gi,
  /\bkind of\b/gi,
  /\bi mean\b/gi,
  /\blike,\s/gi, // "like," as a discourse marker; plain "like" is too ambiguous
];

const HEDGES = [
  /\bi think\b/gi,
  /\bi guess\b/gi,
  /\bmaybe\b/gi,
  /\bprobably\b/gi,
  /\bi'm not sure\b/gi,
  /\bi believe\b/gi,
];

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const p of patterns) {
    // Re-create so lastIndex state never leaks between calls.
    const re = new RegExp(p.source, p.flags);
    n += text.match(re)?.length ?? 0;
  }
  return n;
}

export function computeDeliveryMetrics(
  transcript: string,
  timings: DeliveryTimings | null,
): DeliveryMetrics {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  let wpm: number | null = null;
  if (timings && timings.audioDurationMs >= 3000 && wordCount >= 5) {
    wpm = Math.round(wordCount / (timings.audioDurationMs / 60000));
    // Discard nonsense from broken client clocks.
    if (wpm < 30 || wpm > 400) wpm = null;
  }

  const pauses = timings?.pausesMs ?? [];
  return {
    wordCount,
    wpm,
    fillerCount: countMatches(transcript, FILLERS),
    hedgeCount: countMatches(transcript, HEDGES),
    pauseCount: pauses.length,
    longestPauseMs: pauses.length > 0 ? Math.max(...pauses) : 0,
  };
}

/** One-line grader annotation for a candidate turn, e.g. "(spoken: 162 wpm, 4 fillers, 2 hedges, cut off)". */
export function describeDelivery(
  metrics: DeliveryMetrics | null,
  interruption: string | null,
): string | null {
  if (!metrics) return null;
  const parts: string[] = [];
  if (metrics.wpm !== null) parts.push(`${metrics.wpm} wpm`);
  parts.push(`${metrics.fillerCount} fillers`, `${metrics.hedgeCount} hedges`);
  if (metrics.pauseCount > 0) {
    parts.push(`${metrics.pauseCount} pauses (longest ${(metrics.longestPauseMs / 1000).toFixed(1)}s)`);
  }
  if (interruption === "cut_off") parts.push("cut off by interviewer");
  if (interruption === "barge_in") parts.push("talked over the interviewer to say this");
  return `(spoken: ${parts.join(", ")})`;
}

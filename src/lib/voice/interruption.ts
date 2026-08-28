/**
 * Interviewer barge-in trigger engine. Evaluated client-side on every
 * transcript delta / VAD event while the candidate is speaking. All
 * thresholds are persona data; a null threshold disables that trigger.
 *
 * Pure module — unit-testable, no server deps.
 */

export const INTERRUPT_TRIGGERS = ["ramble", "stall", "filler", "time"] as const;
export type InterruptTrigger = (typeof INTERRUPT_TRIGGERS)[number];

export type PersonaInterruptProfile = {
  /** Total answer time before patience runs out; null = never. */
  patienceMs: number | null;
  /** Transcript length without any numeric token before a "get to the number" cut. */
  rambleCharThreshold: number | null;
  /** A mid-answer pause this long reads as a stall; null = never. */
  stallPauseMs: number | null;
  /** Fillers within the recent-word window before a cut; null = never. */
  fillerStreakLimit: number | null;
  maxInterjectionsPerQuestion: number;
};

export type InterruptState = {
  profile: PersonaInterruptProfile;
  /** ms since the candidate started this answer. */
  elapsedMs: number;
  transcriptChars: number;
  /** Whether any numeric token has appeared in the transcript so far. */
  hasNumber: boolean;
  /** Fillers detected in the trailing ~15-word window. */
  fillerStreak: number;
  /** Current mid-answer pause length (speech stopped, turn not yet committed), or null while speaking. */
  midAnswerPauseMs: number | null;
  interjectionsUsed: number;
};

/**
 * Decide whether to interrupt right now. Precedence: stall (most immediate
 * signal) → filler → ramble → time.
 */
export function decideInterruption(state: InterruptState): InterruptTrigger | null {
  const p = state.profile;
  if (state.interjectionsUsed >= p.maxInterjectionsPerQuestion) return null;

  if (
    p.stallPauseMs !== null &&
    state.midAnswerPauseMs !== null &&
    state.midAnswerPauseMs >= p.stallPauseMs &&
    state.transcriptChars > 0 // never stall-interrupt before she's said anything
  ) {
    return "stall";
  }
  if (p.fillerStreakLimit !== null && state.fillerStreak >= p.fillerStreakLimit) {
    return "filler";
  }
  if (
    p.rambleCharThreshold !== null &&
    state.transcriptChars >= p.rambleCharThreshold &&
    !state.hasNumber
  ) {
    return "ramble";
  }
  if (p.patienceMs !== null && state.elapsedMs >= p.patienceMs) {
    return "time";
  }
  return null;
}

const NUMBER_TOKEN = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand|million|billion|half|third|quarter|percent)\b/i;

export function containsNumber(text: string): boolean {
  return NUMBER_TOKEN.test(text);
}

const STREAK_FILLERS = /\b(um+|uh+|er+m?|like|you know|sort of|kind of|i mean)\b/gi;

/** Fillers in the trailing `windowWords` words of the transcript. */
export function fillerStreakIn(transcript: string, windowWords = 15): number {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const tail = words.slice(-windowWords).join(" ");
  const re = new RegExp(STREAK_FILLERS.source, STREAK_FILLERS.flags);
  return tail.match(re)?.length ?? 0;
}

/**
 * The booklet: a fixed canon of interview questions with canonical answers,
 * ingested from Natalie's "400 Questions" guide via `npm run booklet:ingest`.
 *
 * The canon text is copyrighted, so it is NEVER checked into the (public)
 * repo — it lives in a local gitignored JSON file (see canon.ts). These
 * types and the test fixture are original and safe to commit.
 */

/** Which study lane an item belongs to. */
export const BOOKLET_DECKS = ["technical", "fit", "experience"] as const;
export type BookletDeck = (typeof BOOKLET_DECKS)[number];

export type BookletItem = {
  /** Stable id derived from section + position, e.g. "accounting-basic-07". */
  id: string;
  /** Section slug, e.g. "accounting-basic". */
  sectionId: string;
  /** Display name, e.g. "Accounting — Basic". */
  sectionName: string;
  question: string;
  /** Canonical answer, plain text with paragraph breaks and "- " bullets. */
  answer: string;
  /**
   * technical → scheduled for memorization to "cold";
   * fit / experience → reference only (her answers must be personal).
   */
  deck: BookletDeck;
};

export type BookletCanon = {
  /** Bumped when the ingest format changes. */
  version: 1;
  /** Source description, e.g. the guide title — no file paths. */
  source: string;
  items: BookletItem[];
};

/** Memorization lifecycle. An item with no state row is "new". */
export const BOOKLET_PHASES = ["learning", "solidifying", "cold"] as const;
export type BookletPhase = (typeof BOOKLET_PHASES)[number];

export const BOOKLET_VERDICTS = ["right", "partial", "wrong"] as const;
export type BookletVerdict = (typeof BOOKLET_VERDICTS)[number];

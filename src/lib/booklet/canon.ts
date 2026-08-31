import "server-only";
import fs from "node:fs";
import canonJson from "@/content/booklet.json";
import { FIXTURE_CANON } from "./fixture";
import type { BookletCanon, BookletDeck, BookletItem } from "./types";

/**
 * The booklet canon ships with the app: `src/content/booklet.json` is
 * committed and bundled, so a fresh clone has the full guide with no setup
 * step. Regenerate it with `npm run booklet:ingest -- <guide.docx>` when the
 * source guide changes.
 *
 * Overrides, in precedence order:
 * - BOOKLET_FIXTURE=1 → the small original fixture (tests + e2e).
 * - BOOKLET_PATH=<file> → load a canon JSON from disk instead.
 */

const globalForCanon = globalThis as unknown as {
  __bookletCanon?: { canon: BookletCanon; byId: Map<string, BookletItem> };
};

function fromEnv(): BookletCanon | null {
  if (process.env.BOOKLET_FIXTURE === "1") return FIXTURE_CANON;
  const path = process.env.BOOKLET_PATH;
  if (!path) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(path, "utf8")) as BookletCanon;
    if (parsed.version === 1 && Array.isArray(parsed.items) && parsed.items.length > 0) {
      return parsed;
    }
  } catch {
    // Fall through to the bundled canon rather than leaving the tab empty.
  }
  return null;
}

function load(): { canon: BookletCanon; byId: Map<string, BookletItem> } {
  if (!globalForCanon.__bookletCanon) {
    const canon = fromEnv() ?? (canonJson as BookletCanon);
    globalForCanon.__bookletCanon = {
      canon,
      byId: new Map(canon.items.map((item) => [item.id, item])),
    };
  }
  return globalForCanon.__bookletCanon;
}

/** The canon always resolves — it ships bundled with the app. */
export function getCanon(): BookletCanon {
  return load().canon;
}

export function getItem(id: string): BookletItem | null {
  return load().byId.get(id) ?? null;
}

/** Items in a deck, in booklet order. Scheduling covers "technical" only. */
export function deckItems(deck: BookletDeck): BookletItem[] {
  return load().canon.items.filter((item) => item.deck === deck);
}

/** Test hook: re-read after switching BOOKLET_PATH / BOOKLET_FIXTURE. */
export function resetCanonForTests(): void {
  globalForCanon.__bookletCanon = undefined;
}

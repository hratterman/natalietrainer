import "server-only";
import fs from "node:fs";
import path from "node:path";
import { FIXTURE_CANON } from "./fixture";
import type { BookletCanon, BookletDeck, BookletItem } from "./types";

/**
 * Loads the booklet canon from local disk. The canon is produced by
 * `npm run booklet:ingest` and is deliberately NOT in the repo (public repo,
 * copyrighted source text) — a missing file is a supported state and the UI
 * shows setup instructions for it.
 */

const globalForCanon = globalThis as unknown as {
  __bookletCanon?: { canon: BookletCanon | null; byId: Map<string, BookletItem> };
};

export function canonPath(): string {
  return process.env.BOOKLET_PATH ?? path.join(process.cwd(), "data", "booklet.json");
}

function load(): { canon: BookletCanon | null; byId: Map<string, BookletItem> } {
  if (!globalForCanon.__bookletCanon) {
    let canon: BookletCanon | null = null;
    if (process.env.BOOKLET_FIXTURE === "1") {
      canon = FIXTURE_CANON;
    } else {
      try {
        const parsed = JSON.parse(fs.readFileSync(canonPath(), "utf8")) as BookletCanon;
        if (parsed.version === 1 && Array.isArray(parsed.items) && parsed.items.length > 0) {
          canon = parsed;
        }
      } catch {
        canon = null;
      }
    }
    if (canon == null) {
      // Don't cache a miss — an ingest run should be picked up on the next
      // request without restarting the server.
      return { canon: null, byId: new Map() };
    }
    globalForCanon.__bookletCanon = {
      canon,
      byId: new Map(canon.items.map((item) => [item.id, item])),
    };
  }
  return globalForCanon.__bookletCanon;
}

export function getCanon(): BookletCanon | null {
  return load().canon;
}

export function getItem(id: string): BookletItem | null {
  return load().byId.get(id) ?? null;
}

/** Items in a deck, in booklet order. Scheduling covers "technical" only. */
export function deckItems(deck: BookletDeck): BookletItem[] {
  return (load().canon?.items ?? []).filter((item) => item.deck === deck);
}

/** Test hook: re-read after switching BOOKLET_PATH / BOOKLET_FIXTURE. */
export function resetCanonForTests(): void {
  globalForCanon.__bookletCanon = undefined;
}

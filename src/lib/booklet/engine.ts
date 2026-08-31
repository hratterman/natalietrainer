import "server-only";
import * as repo from "@/lib/db/repo";
import { gradeRecall } from "@/lib/llm/recall";
import type { BookletVerdictResult } from "@/lib/llm/schemas";
import { deckItems, getCanon, getItem } from "./canon";
import {
  applyVerdict,
  buildQueue,
  calibrateReviewSec,
  dayStart,
  ladderScale,
  parseLocalDate,
  projectPace,
  remainingTailDays,
  type ItemState,
  type QueuePlan,
} from "./scheduler";
import type { BookletItem, BookletPhase } from "./types";

/** Server-side glue between canon, scheduler, repo, and the grader. */

function toItemState(row: repo.BookletStateRow): ItemState {
  return {
    phase: row.phase,
    step: row.step,
    lapses: row.lapses,
    dueAt: row.dueAt.getTime(),
    lastSuccessAt: row.lastSuccessAt?.getTime() ?? null,
    introducedAt: row.introducedAt.getTime(),
  };
}

function loadStates(): Map<string, ItemState> {
  return new Map(repo.listBookletStates().map((row) => [row.itemId, toItemState(row)]));
}

function superdayMsFrom(settings: { superdayDate: string | null }): number | null {
  return settings.superdayDate ? parseLocalDate(settings.superdayDate) : null;
}

export type SectionCoverage = {
  sectionId: string;
  sectionName: string;
  total: number;
  fresh: number;
  learning: number;
  solidifying: number;
  cold: number;
};

export type BookletOverview =
  | { available: false }
  | {
      available: true;
      settings: { superdayDate: string | null; dailyMinutes: number };
      sections: SectionCoverage[];
      totals: { total: number; fresh: number; learning: number; solidifying: number; cold: number };
      plan: Pick<QueuePlan, "carryoverCount" | "reviewCount" | "newCount" | "estMinutes">;
      repsToday: number;
      projection: ReturnType<typeof projectPace>;
      referenceCounts: { fit: number; experience: number };
    };

export function getOverview(now = Date.now()): BookletOverview {
  if (!getCanon()) return { available: false };
  const items = deckItems("technical");
  const states = loadStates();
  const settings = repo.getBookletSettings();
  const superdayMs = superdayMsFrom(settings);
  const reviewSec = calibrateReviewSec(repo.recentBookletRepDurations());

  const sections: SectionCoverage[] = [];
  const totals = { total: 0, fresh: 0, learning: 0, solidifying: 0, cold: 0 };
  for (const item of items) {
    let section = sections[sections.length - 1];
    if (!section || section.sectionId !== item.sectionId) {
      section = {
        sectionId: item.sectionId,
        sectionName: item.sectionName,
        total: 0,
        fresh: 0,
        learning: 0,
        solidifying: 0,
        cold: 0,
      };
      sections.push(section);
    }
    const phase: BookletPhase | "fresh" = states.get(item.id)?.phase ?? "fresh";
    section.total += 1;
    totals.total += 1;
    const key = phase === "fresh" ? "fresh" : phase;
    section[key] += 1;
    totals[key] += 1;
  }

  const queuePlan = buildQueue({
    items,
    states,
    superdayMs,
    dailyMinutes: settings.dailyMinutes,
    now,
    reviewSec,
  });
  const plan = {
    carryoverCount: queuePlan.carryoverCount,
    reviewCount: queuePlan.reviewCount,
    newCount: queuePlan.newCount,
    estMinutes: queuePlan.estMinutes,
  };

  const scale = ladderScale(superdayMs, now);
  const tails: number[] = [];
  for (const state of states.values()) {
    if (state.phase === "solidifying") tails.push(remainingTailDays(state, scale));
  }
  const projection = projectPace({
    newRemaining: totals.fresh,
    learningCount: totals.learning,
    solidifyingTailDays: tails,
    superdayMs,
    dailyMinutes: settings.dailyMinutes,
    now,
    reviewSec,
  });

  return {
    available: true,
    settings,
    sections,
    totals,
    plan,
    repsToday: repo.countBookletRepsSince(dayStart(now)),
    projection,
    referenceCounts: {
      fit: deckItems("fit").length,
      experience: deckItems("experience").length,
    },
  };
}

export type QueueItemView = {
  itemId: string;
  kind: "carryover" | "review" | "new";
  question: string;
  sectionName: string;
};

export function getTodayQueue(now = Date.now()): { entries: QueueItemView[]; estMinutes: number } {
  if (!getCanon()) return { entries: [], estMinutes: 0 };
  const settings = repo.getBookletSettings();
  const plan = buildQueue({
    items: deckItems("technical"),
    states: loadStates(),
    superdayMs: superdayMsFrom(settings),
    dailyMinutes: settings.dailyMinutes,
    now,
    reviewSec: calibrateReviewSec(repo.recentBookletRepDurations()),
  });
  return {
    entries: plan.entries.map((entry) => {
      const item = getItem(entry.itemId)!;
      return {
        itemId: item.id,
        kind: entry.kind,
        question: item.question,
        sectionName: item.sectionName,
      };
    }),
    estMinutes: plan.estMinutes,
  };
}

export type RecallOutcome = {
  verdict: BookletVerdictResult["verdict"];
  missing: string[];
  note: string;
  canonicalAnswer: string;
  phase: BookletPhase;
  /** Ask again later in this session until she lands it. */
  requeue: boolean;
};

export async function submitRecall(input: {
  itemId: string;
  answer: string;
  msSpent: number | null;
  giveUp: boolean;
  now?: number;
}): Promise<RecallOutcome | null> {
  const now = input.now ?? Date.now();
  const item = getItem(input.itemId);
  if (!item || item.deck !== "technical") return null;

  const result: BookletVerdictResult = input.giveUp
    ? {
        verdict: "wrong",
        missing: [],
        note: "Revealed without an attempt — it will come back this session.",
      }
    : await gradeRecall(item, input.answer);

  const settings = repo.getBookletSettings();
  const row = repo.getBookletState(item.id);
  const { next, requeue } = applyVerdict(
    row ? toItemState(row) : null,
    result.verdict,
    now,
    superdayMsFrom(settings),
  );
  repo.saveBookletState({ itemId: item.id, ...next });
  repo.logBookletRep({
    itemId: item.id,
    verdict: result.verdict,
    gaveUp: input.giveUp,
    msSpent: input.msSpent,
  });

  return {
    verdict: result.verdict,
    missing: result.missing,
    note: result.note,
    canonicalAnswer: item.answer,
    phase: next.phase,
    requeue,
  };
}

/** Reference listing (all decks) for the browse page. */
export function referenceSections(): {
  deck: BookletItem["deck"];
  sectionId: string;
  sectionName: string;
  items: { id: string; question: string; answer: string }[];
}[] {
  const canon = getCanon();
  if (!canon) return [];
  const out: ReturnType<typeof referenceSections> = [];
  for (const item of canon.items) {
    let section = out[out.length - 1];
    if (!section || section.sectionId !== item.sectionId) {
      section = { deck: item.deck, sectionId: item.sectionId, sectionName: item.sectionName, items: [] };
      out.push(section);
    }
    section.items.push({ id: item.id, question: item.question, answer: item.answer });
  }
  return out;
}

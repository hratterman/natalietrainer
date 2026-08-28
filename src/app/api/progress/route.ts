import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { allSubtopics } from "@/content/taxonomy";
import { isStale, rankWeaknesses } from "@/lib/mastery";
import { errorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const masteryRows = repo.getMasteryOverview();
    const byId = new Map(masteryRows.map((m) => [m.subtopicId, m]));
    const now = Date.now();

    const subtopics = allSubtopics().map(({ area, subtopic }) => {
      const m = byId.get(subtopic.id);
      return {
        areaId: area.id,
        areaName: area.name,
        tier: area.tier,
        subtopicId: subtopic.id,
        subtopicName: subtopic.name,
        score: m?.score ?? null,
        attempts: m?.attempts ?? 0,
        currentDifficulty: m?.currentDifficulty ?? null,
        lastAttemptAt: m?.lastAttemptAt?.getTime() ?? null,
        stale: m ? isStale(m.lastAttemptAt.getTime(), now) : false,
      };
    });

    const weaknesses = rankWeaknesses(
      subtopics.map((s) => ({
        subtopicId: s.subtopicId,
        score: s.score,
        lastAttemptAt: s.lastAttemptAt,
      })),
      now,
    ).slice(0, 5);

    return NextResponse.json({ subtopics, weaknesses });
  } catch (err) {
    return errorResponse(err);
  }
}

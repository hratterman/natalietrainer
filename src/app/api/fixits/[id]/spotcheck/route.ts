import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { startSpotCheck } from "@/lib/session/learn";
import { gradeAndRecord } from "@/lib/session/engine";
import { errorResponse } from "@/lib/api/validate";

/** Start a 1-question spot-check for a resolved fixit (due or early). */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const fixit = repo.getFixit(id);
    if (!fixit) return NextResponse.json({ error: "Fixit not found." }, { status: 404 });
    if (fixit.status !== "resolved" || fixit.nextCheckAt === null) {
      return NextResponse.json(
        { error: "Spot-checks apply to resolved fixits awaiting a check." },
        { status: 409 },
      );
    }
    // Resume an unfinished spot-check instead of stacking new ones.
    if (fixit.lessonSessionId) {
      const existing = repo.getSession(fixit.lessonSessionId);
      if (
        existing &&
        existing.status === "active" &&
        existing.configJson.spotCheck === true
      ) {
        const question = repo.getActiveQuestion(existing.id);
        if (question) {
          return NextResponse.json({ sessionId: existing.id, question });
        }
        // Refresh raced the grade: the answer landed but grading didn't.
        // Finish it here instead of forking a duplicate session.
        const answered = repo
          .getSessionQuestions(existing.id)
          .find(
            (q) =>
              q.status === "answered" &&
              repo.getGrade(q.id) === undefined &&
              repo.getTurns(q.id).some((t) => t.role === "candidate"),
          );
        if (answered) {
          await gradeAndRecord(answered.id);
          return NextResponse.json({ sessionId: existing.id, alreadyCompleted: true });
        }
      }
    }
    const early = fixit.nextCheckAt.getTime() > Date.now();
    const { session, question } = await startSpotCheck(fixit, { early });
    return NextResponse.json({ sessionId: session.id, question });
  } catch (err) {
    return errorResponse(err);
  }
}

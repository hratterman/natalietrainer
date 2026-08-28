import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { FOLLOW_UP_CAPS } from "@/lib/session/engine";
import { errorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const state = repo.getSessionWithTranscript(id);
    if (!state) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    const active = repo.getActiveQuestion(id);
    return NextResponse.json({
      session: state.session,
      rounds: state.rounds,
      questions: state.questions,
      activeQuestionId: active?.id ?? null,
      followUpCap: FOLLOW_UP_CAPS[state.session.mode],
    });
  } catch (err) {
    return errorResponse(err);
  }
}

import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { completeSession } from "@/lib/session/engine";
import { errorResponse } from "@/lib/api/validate";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await ctx.params;
    const session = repo.getSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    if (session.status === "completed" && session.debriefJson) {
      return NextResponse.json({ debrief: session.debriefJson });
    }
    if (session.mode === "learn") {
      return NextResponse.json(
        { error: "Learn sessions are completed by the fix-it lifecycle, not this route." },
        { status: 409 },
      );
    }
    const debrief = await completeSession(sessionId);
    return NextResponse.json({ debrief });
  } catch (err) {
    return errorResponse(err);
  }
}

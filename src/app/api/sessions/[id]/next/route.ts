import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { nextQuestion } from "@/lib/session/engine";
import { errorResponse } from "@/lib/api/validate";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await ctx.params;
    const session = repo.getSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    if (session.status !== "active") {
      return NextResponse.json({ error: "Session is not active." }, { status: 409 });
    }
    const result = await nextQuestion(sessionId);
    if (result.done) return NextResponse.json({ done: true });
    return NextResponse.json({
      done: false,
      question: result.question,
      roundIndex: result.roundIndex,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

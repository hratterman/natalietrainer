import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { gradeAndRecord } from "@/lib/session/engine";
import { errorResponse, parseBody } from "@/lib/api/validate";

const gradeRequestSchema = z.object({
  questionId: z.string(),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const body = await parseBody(request, gradeRequestSchema);
  if (!body.ok) return body.response;
  try {
    const { id: sessionId } = await ctx.params;
    const question = repo.getQuestion(body.data.questionId);
    if (!question || question.sessionId !== sessionId) {
      return NextResponse.json({ error: "Question not found in this session." }, { status: 404 });
    }
    const turns = repo.getTurns(question.id);
    if (!turns.some((t) => t.role === "candidate")) {
      return NextResponse.json(
        { error: "Nothing to grade — no answer submitted." },
        { status: 409 },
      );
    }
    const { fixitId, alreadyGraded, ...grade } = await gradeAndRecord(question.id);
    void alreadyGraded;
    return NextResponse.json({ grade, fixitId });
  } catch (err) {
    return errorResponse(err);
  }
}

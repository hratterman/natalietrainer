import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { coachTurn } from "@/lib/llm/coach";
import { errorResponse, parseBody } from "@/lib/api/validate";

const chatSchema = z.object({
  /** Her message, or null to generate the coach's opening (first turn only). */
  message: z.string().min(1).max(8000).nullable(),
});

/**
 * One coach turn in a learn session's lesson. SSE like /answer:
 *   data: {"type":"delta","text":"..."}
 *   data: {"type":"done","action":"coach"|"check"}
 */
export async function POST(request: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const body = await parseBody(request, chatSchema);
  if (!body.ok) return body.response;
  try {
    const { sessionId } = await ctx.params;
    const session = repo.getSession(sessionId);
    if (!session || session.mode !== "learn") {
      return NextResponse.json({ error: "Learn session not found." }, { status: 404 });
    }
    if (session.configJson.spotCheck === true) {
      return NextResponse.json({ error: "Spot-checks have no lesson chat." }, { status: 409 });
    }
    const fixit = session.configJson.fixitId ? repo.getFixit(session.configJson.fixitId) : undefined;
    if (!fixit) return NextResponse.json({ error: "Fixit not found." }, { status: 404 });

    const anchor = repo.getSessionQuestions(sessionId).find((q) => q.askedIndex === 0);
    if (!anchor) return NextResponse.json({ error: "Lesson has no anchor." }, { status: 500 });

    const sourceQuestion = repo.getQuestion(fixit.sourceQuestionId);
    const sourceGrade = sourceQuestion ? repo.getGrade(sourceQuestion.id) : undefined;
    if (!sourceQuestion || !sourceGrade) {
      return NextResponse.json({ error: "Source question or grade missing." }, { status: 500 });
    }

    const priorLessonTurns = repo.getTurns(anchor.id);
    if (body.data.message === null && priorLessonTurns.length > 0) {
      return NextResponse.json(
        { error: "Lesson already opened — send a message." },
        { status: 409 },
      );
    }

    if (body.data.message !== null) {
      repo.appendTurn({ questionId: anchor.id, role: "candidate", content: body.data.message });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (data: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        try {
          const gen = coachTurn({
            sourceQuestion,
            sourceTurns: repo.getTurns(sourceQuestion.id),
            sourceGrade,
            fixit,
            priorLessonTurns,
            latestMessage: body.data.message,
          });
          let result = await gen.next();
          while (!result.done) {
            send({ type: "delta", text: result.value });
            result = await gen.next();
          }
          repo.appendTurn({
            questionId: anchor.id,
            role: "interviewer",
            content: result.value.spoken,
          });
          send({ type: "done", action: result.value.action });
        } catch (err) {
          send({
            type: "error",
            error: err instanceof Error ? err.message : "Coach turn failed.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

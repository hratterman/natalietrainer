import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { interviewerOpen } from "@/lib/llm/interviewer";
import { personaIdForQuestion } from "@/lib/session/engine";
import { errorResponse, parseBody } from "@/lib/api/validate";

const openSchema = z.object({
  questionId: z.string(),
});

/**
 * Voice mode: the interviewer speaks the question opening (greeting/small
 * talk on session/round starts, the question asked naturally). Streams SSE
 * like /answer; the spoken text persists as the question's first turn.
 * Idempotent: if the opening was already spoken, it replays from the DB.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const body = await parseBody(request, openSchema);
  if (!body.ok) return body.response;
  try {
    const { id: sessionId } = await ctx.params;
    const session = repo.getSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    const question = repo.getQuestion(body.data.questionId);
    if (!question || question.sessionId !== sessionId) {
      return NextResponse.json({ error: "Question not found in this session." }, { status: 404 });
    }

    const existingTurns = repo.getTurns(question.id);
    const existingOpen = existingTurns.find((t) => t.role === "interviewer" && t.turnIndex === 0);

    const isSessionStart = question.askedIndex === 0;
    const isRoundStart =
      question.roundId != null &&
      repo
        .getSessionQuestions(sessionId)
        .filter((q) => q.roundId === question.roundId)
        .every((q) => q.id === question.id || q.askedIndex > question.askedIndex);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            /* client went away — persistence below still matters */
          }
        };
        try {
          if (existingOpen) {
            send({ type: "delta", text: existingOpen.content });
            send({ type: "done", action: "ask", questionStatus: question.status });
            return;
          }
          const gen = interviewerOpen({
            personaId: personaIdForQuestion(session, question),
            question,
            isSessionStart,
            isRoundStart,
          });
          let result = await gen.next();
          while (!result.done) {
            send({ type: "delta", text: result.value });
            result = await gen.next();
          }
          // A concurrent /open may have persisted the opening while we generated;
          // never append a second one (it would count as a follow-up).
          const nowOpen = repo
            .getTurns(question.id)
            .find((t) => t.role === "interviewer" && t.turnIndex === 0);
          if (!nowOpen) {
            repo.appendTurn({
              questionId: question.id,
              role: "interviewer",
              content: result.value.spoken,
            });
          }
          send({ type: "done", action: "ask", questionStatus: question.status });
        } catch (err) {
          send({
            type: "error",
            error: err instanceof Error ? err.message : "Question opening failed.",
          });
        } finally {
          try {
            controller.close();
          } catch {
            /* already closed/cancelled */
          }
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

import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { FOLLOW_UP_CAPS, followUpsUsed } from "@/lib/session/engine";
import { interviewerTurn } from "@/lib/llm/interviewer";
import { errorResponse, parseBody } from "@/lib/api/validate";

const answerSchema = z.object({
  questionId: z.string(),
  answer: z.string().min(1),
  scratchpad: z.string().nullable().optional(),
  elapsedMs: z.number().int().min(0).nullable().optional(),
});

/**
 * Persist the candidate's answer. For rapid-fire, returns JSON immediately.
 * For the other modes, streams the interviewer's reply as SSE:
 *   data: {"type":"delta","text":"..."}
 *   data: {"type":"done","action":"followup"|"wrapup","questionStatus":"active"|"answered"}
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const body = await parseBody(request, answerSchema);
  if (!body.ok) return body.response;
  try {
    const { id: sessionId } = await ctx.params;
    const session = repo.getSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    const question = repo.getQuestion(body.data.questionId);
    if (!question || question.sessionId !== sessionId) {
      return NextResponse.json({ error: "Question not found in this session." }, { status: 404 });
    }
    if (question.status !== "active") {
      return NextResponse.json({ error: "Question is no longer active." }, { status: 409 });
    }

    const priorTurns = repo.getTurns(question.id);
    repo.appendTurn({
      questionId: question.id,
      role: "candidate",
      content: body.data.answer,
      scratchpad: body.data.scratchpad ?? null,
      elapsedMs: body.data.elapsedMs ?? null,
    });

    if (session.mode === "rapid") {
      repo.updateQuestionStatus(question.id, "answered");
      return NextResponse.json({ action: "wrapup", questionStatus: "answered" });
    }

    const cap = FOLLOW_UP_CAPS[session.mode];
    const forceWrapup = followUpsUsed(question.id) >= cap;

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (data: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        try {
          const gen = interviewerTurn({
            mode: session.mode,
            personaId: session.configJson.personaId,
            question,
            priorTurns,
            answer: body.data.answer,
            scratchpad: body.data.scratchpad ?? null,
            forceWrapup,
          });
          let result = await gen.next();
          while (!result.done) {
            send({ type: "delta", text: result.value });
            result = await gen.next();
          }
          const { action, spoken } = result.value;
          repo.appendTurn({
            questionId: question.id,
            role: "interviewer",
            content: spoken,
          });
          const questionStatus = action === "wrapup" ? "answered" : "active";
          if (action === "wrapup") repo.updateQuestionStatus(question.id, "answered");
          send({ type: "done", action, questionStatus });
        } catch (err) {
          send({
            type: "error",
            error: err instanceof Error ? err.message : "Interviewer turn failed.",
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

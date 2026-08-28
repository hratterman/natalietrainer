import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { FOLLOW_UP_CAPS, followUpsUsed, personaIdForQuestion } from "@/lib/session/engine";
import { interviewerTurn } from "@/lib/llm/interviewer";
import { computeDeliveryMetrics } from "@/lib/voice/deliveryMetrics";
import { errorResponse, parseBody } from "@/lib/api/validate";

/** One day — nothing in a session legitimately runs longer. */
const MAX_DURATION_MS = 86_400_000;

const answerSchema = z.object({
  questionId: z.string(),
  answer: z.string().min(1).max(20_000),
  scratchpad: z.string().max(20_000).nullable().optional(),
  elapsedMs: z.number().int().min(0).max(MAX_DURATION_MS).nullable().optional(),
  /** Spoken answers: client-measured timing + interruption context. */
  voice: z
    .object({
      audioDurationMs: z.number().int().min(0).max(MAX_DURATION_MS),
      pausesMs: z.array(z.number().int().min(0).max(MAX_DURATION_MS)).max(100),
      bargeIn: z.boolean(),
      /** How many chars of the previous interviewer reply she actually heard. */
      heardChars: z.number().int().min(0).max(1_000_000).optional(),
    })
    .nullable()
    .optional(),
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

    const voice = body.data.voice ?? null;
    const priorTurns = repo.getTurns(question.id);
    repo.appendTurn({
      questionId: question.id,
      role: "candidate",
      content: body.data.answer,
      scratchpad: body.data.scratchpad ?? null,
      elapsedMs: body.data.elapsedMs ?? null,
      interruption: voice?.bargeIn ? "barge_in" : null,
      audioDurationMs: voice?.audioDurationMs ?? null,
      deliveryMetrics: voice
        ? computeDeliveryMetrics(body.data.answer, {
            audioDurationMs: voice.audioDurationMs,
            pausesMs: voice.pausesMs,
          })
        : null,
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
        // Never let a disconnected client abort persistence: enqueue throws once
        // the reader cancels, but the interviewer turn + status must still land.
        const send = (data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            /* client went away — keep going, persistence below still matters */
          }
        };
        try {
          const gen = interviewerTurn({
            mode: session.mode,
            personaId: personaIdForQuestion(session, question),
            question,
            priorTurns,
            answer: body.data.answer,
            scratchpad: body.data.scratchpad ?? null,
            forceWrapup,
            voice: voice != null,
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
          // Only active → answered; a concurrent grade may already have moved it on.
          const current = repo.getQuestion(question.id);
          if (action === "wrapup" && current?.status === "active") {
            repo.updateQuestionStatus(question.id, "answered");
          }
          const questionStatus = action === "wrapup" ? "answered" : "active";
          send({ type: "done", action, questionStatus });
        } catch (err) {
          send({
            type: "error",
            error: err instanceof Error ? err.message : "Interviewer turn failed.",
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

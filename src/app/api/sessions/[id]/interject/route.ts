import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { computeDeliveryMetrics } from "@/lib/voice/deliveryMetrics";
import { errorResponse, parseBody } from "@/lib/api/validate";

/** One day — nothing in a session legitimately runs longer. */
const MAX_DURATION_MS = 86_400_000;

const interjectSchema = z.object({
  questionId: z.string(),
  /** What she managed to say before being cut off (incl. the grace tail). */
  answer: z.string().max(20_000),
  elapsedMs: z.number().int().min(0).max(MAX_DURATION_MS).nullable().optional(),
  voice: z
    .object({
      audioDurationMs: z.number().int().min(0).max(MAX_DURATION_MS),
      pausesMs: z.array(z.number().int().min(0).max(MAX_DURATION_MS)).max(100),
    })
    .nullable()
    .optional(),
  trigger: z.enum(["ramble", "stall", "filler", "time"]),
  /** The canned persona line that was played. */
  interjectionText: z.string().min(1).max(500),
});

/**
 * Persist an interviewer barge-in: the candidate's cut-off partial answer and
 * the canned interjection line that was played over her. No LLM call — the
 * context-aware follow-through happens on her next /answer turn.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const body = await parseBody(request, interjectSchema);
  if (!body.ok) return body.response;
  try {
    const { id: sessionId } = await ctx.params;
    const session = repo.getSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    if (session.configJson.voiceMode !== true || session.mode === "learn") {
      // Barge-ins only exist in spoken interviewer sessions.
      return NextResponse.json(
        { error: "Interjections only apply to voice interview sessions." },
        { status: 409 },
      );
    }
    const question = repo.getQuestion(body.data.questionId);
    if (!question || question.sessionId !== sessionId) {
      return NextResponse.json({ error: "Question not found in this session." }, { status: 404 });
    }
    if (question.status !== "active") {
      return NextResponse.json({ error: "Question is no longer active." }, { status: 409 });
    }

    const metrics = computeDeliveryMetrics(
      body.data.answer,
      body.data.voice
        ? { audioDurationMs: body.data.voice.audioDurationMs, pausesMs: body.data.voice.pausesMs }
        : null,
    );
    const candidateTurn = repo.appendTurn({
      questionId: question.id,
      role: "candidate",
      content: body.data.answer || "(cut off before saying anything substantive)",
      elapsedMs: body.data.elapsedMs ?? null,
      interruption: "cut_off",
      audioDurationMs: body.data.voice?.audioDurationMs ?? null,
      deliveryMetrics: metrics,
    });
    const interviewerTurn = repo.appendTurn({
      questionId: question.id,
      role: "interviewer",
      content: body.data.interjectionText,
      interruption: "interjection",
    });
    return NextResponse.json({
      candidateTurnId: candidateTurn.id,
      interviewerTurnId: interviewerTurn.id,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

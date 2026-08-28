import { NextResponse } from "next/server";
import { z } from "zod";
import { PLAYABLE_MODES } from "@/lib/db/schema";
import { startSession } from "@/lib/session/engine";
import { errorResponse, parseBody } from "@/lib/api/validate";

const createSessionSchema = z.object({
  mode: z.enum(PLAYABLE_MODES),
  config: z.object({
    subtopicIds: z.array(z.string()).default([]),
    areaIds: z.array(z.string()).default([]),
    difficulty: z.union([z.number().int().min(1).max(5), z.literal("adaptive")]),
    questionCount: z.number().int().min(1).max(30),
    personaId: z.string().nullable().default(null),
    secondsPerQuestion: z.number().int().min(10).max(600).nullable().default(null),
    voiceMode: z.boolean().default(false),
    rounds: z
      .array(
        z.object({
          personaId: z.string(),
          focusAreaId: z.string(),
          questionCount: z.number().int().min(1).max(10),
        }),
      )
      .nullable()
      .default(null),
  }),
});

export async function POST(request: Request) {
  const body = await parseBody(request, createSessionSchema);
  if (!body.ok) return body.response;
  try {
    const session = await startSession(body.data.mode, body.data.config);
    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    return errorResponse(err);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { startLesson } from "@/lib/session/learn";
import { errorResponse } from "@/lib/api/validate";

const lessonSchema = z.object({
  /** Spoken lesson (coach voice + mic). Omitted = leave the lesson's current setting alone. */
  voice: z.boolean().optional(),
});

/** Start (or resume) the coaching lesson for a fixit. Idempotent. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = lessonSchema.safeParse(raw ?? {});
    const voice = parsed.success ? parsed.data.voice : undefined;
    const fixit = repo.getFixit(id);
    if (!fixit) return NextResponse.json({ error: "Fixit not found." }, { status: 404 });
    if (fixit.status !== "open") {
      return NextResponse.json(
        { error: "This fixit isn't open — nothing to relearn right now." },
        { status: 409 },
      );
    }
    const { session, anchor } = startLesson(fixit, voice);
    return NextResponse.json({ sessionId: session.id, anchorQuestionId: anchor.id });
  } catch (err) {
    return errorResponse(err);
  }
}

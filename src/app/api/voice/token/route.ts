import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { getPersona } from "@/lib/llm/personas";
import { mintTranscriptionSecret, VoiceUpstreamError } from "@/lib/voice/openai";
import { parseBody } from "@/lib/api/validate";

const tokenRequestSchema = z.object({
  sessionId: z.string(),
  /** Superday rounds switch personas; the client passes the active one. */
  personaId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const body = await parseBody(request, tokenRequestSchema);
  if (!body.ok) return body.response;
  try {
    const session = repo.getSession(body.data.sessionId);
    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    const persona = getPersona(body.data.personaId ?? session.configJson.personaId);
    const secret = await mintTranscriptionSecret(persona);
    return NextResponse.json(secret);
  } catch (err) {
    // Surface voice failures in the server log too — the browser's Network
    // tab shouldn't be the only place the real upstream error lands.
    console.error("[voice] token mint failed:", err instanceof Error ? err.message : err);
    if (err instanceof VoiceUpstreamError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Token mint failed." },
      { status: 500 },
    );
  }
}

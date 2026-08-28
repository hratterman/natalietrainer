import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersona } from "@/lib/llm/personas";
import { ttsStream, VoiceUpstreamError } from "@/lib/voice/openai";
import { parseBody } from "@/lib/api/validate";

const ttsRequestSchema = z.object({
  text: z.string().min(1).max(4096),
  personaId: z.string().nullable(),
});

export async function POST(request: Request) {
  const body = await parseBody(request, ttsRequestSchema);
  if (!body.ok) return body.response;
  try {
    const persona = getPersona(body.data.personaId);
    const stream = await ttsStream(body.data.text, persona);
    return new Response(stream, {
      headers: {
        // 24kHz, 16-bit, mono PCM.
        "Content-Type": "audio/pcm",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof VoiceUpstreamError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS failed." },
      { status: 500 },
    );
  }
}

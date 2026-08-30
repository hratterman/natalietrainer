import "server-only";
import type { Persona } from "@/lib/llm/personas";

/**
 * Server-side OpenAI voice-edge helpers. The raw OPENAI_API_KEY lives only
 * here: the browser gets short-lived ephemeral client secrets (STT) or
 * proxied audio bytes (TTS), never the key.
 */

const OPENAI_BASE = "https://api.openai.com/v1";

/** Pinned TTS model snapshot — update deliberately. */
export const TTS_MODEL = "gpt-4o-mini-tts-2025-12-15";
/**
 * Realtime streaming transcription model. Must support server_vad turn
 * detection — the strict-IRL flow (silence auto-submit, barge-in) rides on
 * VAD turn commits. NOT gpt-live-transcribe or gpt-realtime-whisper: both
 * reject turn_detection ("Turn detection is not supported for this
 * transcription model", 400 invalid_value at the client_secrets mint).
 */
export const TRANSCRIBE_MODEL = "gpt-4o-transcribe";

/** Biases transcription toward finance vocabulary and verbatim disfluencies. */
export const TRANSCRIPTION_PROMPT =
  "Transcribe exactly as spoken, keeping filler words (um, uh, like, you know) and false starts. " +
  "Finance interview context; expect terms like EBITDA, DCF, WACC, LBO, accretion, dilution, " +
  "deferred tax liability, treasury stock method, IRR, MOIC, covenant, tranche.";

export function voiceAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY) || process.env.VOICE_FAKE === "1";
}

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set — voice mode is unavailable.");
  return key;
}

export class VoiceUpstreamError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "VoiceUpstreamError";
  }
}

async function upstreamError(res: Response, what: string): Promise<VoiceUpstreamError> {
  const body = await res.text().catch(() => "");
  return new VoiceUpstreamError(`${what} failed (${res.status}): ${body.slice(0, 300)}`, res.status);
}

/**
 * Mint an ephemeral client secret for a Realtime transcription session. The
 * full session config (incl. the persona's strict-IRL silence window) is
 * baked into the token server-side, so the browser cannot alter it.
 */
export async function mintTranscriptionSecret(persona: Persona): Promise<{
  value: string;
  expires_at: number;
}> {
  const res = await fetch(`${OPENAI_BASE}/realtime/client_secrets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 600 },
      session: {
        type: "transcription",
        audio: {
          input: {
            format: { type: "audio/pcm", rate: 24000 },
            transcription: {
              model: TRANSCRIBE_MODEL,
              prompt: TRANSCRIPTION_PROMPT,
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: persona.silenceDurationMs,
            },
          },
        },
      },
    }),
  });
  if (!res.ok) throw await upstreamError(res, "ephemeral token mint");
  const body = (await res.json()) as { value: string; expires_at: number };
  if (!body.value) throw new VoiceUpstreamError("token mint returned no value", 502);
  return body;
}

/**
 * Stream persona-styled speech as 24kHz 16-bit mono PCM. Returns the raw
 * upstream body stream for piping straight to the client.
 */
export async function ttsStream(text: string, persona: Persona): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${OPENAI_BASE}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: text,
      voice: persona.voice.ttsVoice,
      instructions: persona.voice.ttsInstructions,
      ...(persona.voice.speed ? { speed: persona.voice.speed } : {}),
      response_format: "pcm",
      stream_format: "audio",
    }),
  });
  if (!res.ok || !res.body) throw await upstreamError(res, "TTS");
  return res.body;
}

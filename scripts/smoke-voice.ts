/**
 * Voice-edge smoke test against the real OpenAI API:
 *   1. Mint an ephemeral Realtime transcription client secret (ek_…).
 *   2. TTS round trip — stream persona-styled PCM, check time-to-first-chunk.
 *   3. Feed the TTS audio into a Realtime transcription WebSocket and assert
 *      VAD + transcript events arrive (the TTS output is the STT input, so no
 *      audio fixture is needed).
 *
 *   npm run smoke:voice          # requires OPENAI_API_KEY (reads .env.local)
 *   npm run smoke:voice -- --skip-ws   # skip step 3
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && m[1] && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
}

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error("OPENAI_API_KEY is not set (checked env and .env.local).");
  process.exit(1);
}

async function main() {
  const openai = await import("../src/lib/voice/openai");
  const { mintTranscriptionSecret, ttsStream } = openai;
  const { getPersona } = await import("../src/lib/llm/personas");

  // 1. Ephemeral token mint
  console.log("[1/3] minting ephemeral transcription client secret...");
  const persona = getPersona("trader");
  const secret = await mintTranscriptionSecret(persona);
  if (!secret.value.startsWith("ek_")) {
    throw new Error(`unexpected secret shape: ${secret.value.slice(0, 6)}…`);
  }
  const ttlSeconds = secret.expires_at - Math.floor(Date.now() / 1000);
  console.log(`  ok — ek_… secret, expires in ${ttlSeconds}s`);
  if (ttlSeconds < 60 || ttlSeconds > 7200) throw new Error(`implausible expiry: ${ttlSeconds}s`);

  // 2. TTS streaming round trip
  console.log("[2/3] TTS round trip (persona: trader)...");
  const started = Date.now();
  const stream = await ttsStream(
    "Net income falls by seven dollars and fifty cents, and cash goes up by two fifty.",
    persona,
  );
  const reader = stream.getReader();
  let firstChunkMs: number | null = null;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      if (firstChunkMs === null) firstChunkMs = Date.now() - started;
      chunks.push(value);
    }
  }
  const totalBytes = chunks.reduce((n, c) => n + c.byteLength, 0);
  const seconds = totalBytes / (24000 * 2);
  console.log(
    `  ok — ${totalBytes} PCM bytes (~${seconds.toFixed(1)}s audio), first chunk in ${firstChunkMs}ms`,
  );
  if (totalBytes < 24000) throw new Error("TTS returned under half a second of audio");
  if ((firstChunkMs ?? Infinity) > 3000) {
    console.warn("  warning: time-to-first-chunk above 3s — voice will feel laggy");
  }

  // 3. Transcribe the TTS audio over a Realtime WebSocket
  if (process.argv.includes("--skip-ws")) {
    console.log("[3/3] skipped (--skip-ws)");
    console.log("\nsmoke:voice — all checks passed.");
    return;
  }
  console.log("[3/3] realtime transcription WebSocket round trip...");
  const pcm = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  await transcribeOverWebSocket(pcm, openai.TRANSCRIBE_MODEL, openai.TRANSCRIPTION_PROMPT);
  console.log("\nsmoke:voice — all checks passed.");
}

function transcribeOverWebSocket(
  pcm: Buffer,
  TRANSCRIBE_MODEL: string,
  TRANSCRIPTION_PROMPT: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Node's standard WebSocket has no headers option; OpenAI supports
    // subprotocol-based auth for exactly this case.
    const ws = new WebSocket("wss://api.openai.com/v1/realtime", [
      "realtime",
      `openai-insecure-api-key.${KEY}`,
      "openai-beta.realtime-v1",
    ]);
    let sawSpeechStart = false;
    let transcript = "";
    const timeout = setTimeout(() => {
      ws.close();
      reject(
        new Error(
          `transcription timed out (speech_started=${sawSpeechStart}, transcript="${transcript}")`,
        ),
      );
    }, 45_000);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "session.update",
          session: {
            type: "transcription",
            audio: {
              input: {
                format: { type: "audio/pcm", rate: 24000 },
                transcription: { model: TRANSCRIBE_MODEL, prompt: TRANSCRIPTION_PROMPT },
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 700,
                },
              },
            },
          },
        }),
      );
      // Stream the PCM in ~100ms chunks, then a second of silence so VAD commits.
      const chunkBytes = 24000 * 2 * 0.1;
      for (let i = 0; i < pcm.length; i += chunkBytes) {
        ws.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: pcm.subarray(i, i + chunkBytes).toString("base64"),
          }),
        );
      }
      const silence = Buffer.alloc(24000 * 2);
      ws.send(
        JSON.stringify({ type: "input_audio_buffer.append", audio: silence.toString("base64") }),
      );
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as { type: string; [k: string]: unknown };
      if (msg.type === "error") {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(`realtime error: ${JSON.stringify(msg).slice(0, 400)}`));
        return;
      }
      if (msg.type === "input_audio_buffer.speech_started") {
        sawSpeechStart = true;
        console.log("  VAD: speech_started");
      }
      if (msg.type.includes("input_audio_transcription.delta")) {
        transcript += String((msg as { delta?: string }).delta ?? "");
      }
      if (msg.type.includes("input_audio_transcription.completed")) {
        clearTimeout(timeout);
        const full = String((msg as { transcript?: string }).transcript ?? transcript);
        console.log(`  transcript: "${full.trim()}"`);
        ws.close();
        if (!sawSpeechStart) {
          reject(new Error("never saw input_audio_buffer.speech_started"));
        } else if (!/seven|7/i.test(full)) {
          reject(new Error(`transcript did not contain the expected number: "${full}"`));
        } else {
          resolve();
        }
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket error (check network / API key)"));
    };
  });
}

main().catch((err) => {
  console.error("\nsmoke:voice failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});

import { SentenceChunker } from "./sentenceChunker";
import { VoicePlayer } from "./player";
import type { VoiceController, VoiceControllerEvents } from "./transport";

/**
 * Real voice controller: mic → WebRTC → OpenAI Realtime transcription
 * (ephemeral-token auth; the raw API key never reaches this code), and
 * interviewer text → /api/voice/tts → PCM → Web Audio.
 *
 * Browser-only. Never import from server code.
 */

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export class OpenAiVoiceController implements VoiceController {
  events: VoiceControllerEvents = {};

  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private player = new VoicePlayer();
  private listening = false;
  private partialTranscript = "";

  // Interviewer-speech cycle state
  private chunker: SentenceChunker | null = null;
  private playbackChain: Promise<void> = Promise.resolve();
  private inflight = new Set<AbortController>();
  private cycleChars = 0;
  private canceled = false;

  private clips = new Map<string, Uint8Array>();

  get connected(): boolean {
    return this.dc?.readyState === "open";
  }

  get speaking(): boolean {
    return this.player.playing;
  }

  async start(opts: { sessionId: string; personaId: string | null }): Promise<void> {
    this.personaId = opts.personaId;
    const tokenRes = await fetch("/api/voice/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: opts.sessionId, personaId: opts.personaId }),
    });
    if (!tokenRes.ok) {
      throw new Error(
        ((await tokenRes.json().catch(() => null)) as { error?: string } | null)?.error ??
          `Could not get a voice session token (HTTP ${tokenRes.status}).`,
      );
    }
    const { value: secret } = (await tokenRes.json()) as { value: string };

    this.mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });

    const pc = new RTCPeerConnection();
    this.pc = pc;
    for (const track of this.mic.getTracks()) pc.addTrack(track, this.mic);

    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.onmessage = (e) => this.handleEvent(String(e.data));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const sdpRes = await fetch(REALTIME_CALLS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/sdp" },
      body: offer.sdp,
    });
    if (!sdpRes.ok) {
      throw new Error(`Voice connection refused (${sdpRes.status}).`);
    }
    await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Voice channel timed out.")), 10_000);
      if (dc.readyState === "open") {
        clearTimeout(timeout);
        resolve();
        return;
      }
      dc.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };
      dc.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Voice channel failed to open."));
      };
    });
  }

  stop(): void {
    this.cancelSpeech();
    this.player.close();
    this.dc?.close();
    this.pc?.close();
    for (const track of this.mic?.getTracks() ?? []) track.stop();
    this.dc = null;
    this.pc = null;
    this.mic = null;
  }

  setListening(on: boolean): void {
    this.listening = on;
    if (on) this.partialTranscript = "";
  }

  private handleEvent(raw: string): void {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(raw) as { type: string };
    } catch {
      return;
    }
    const now = Date.now();
    switch (true) {
      case msg.type === "input_audio_buffer.speech_started":
        this.events.onSpeechStarted?.(now);
        break;
      case msg.type === "input_audio_buffer.speech_stopped":
        this.events.onSpeechStopped?.(now);
        break;
      case msg.type.endsWith("input_audio_transcription.delta"): {
        const delta = String((msg as { delta?: string }).delta ?? "");
        this.partialTranscript += delta;
        if (delta) this.events.onTranscriptDelta?.(delta);
        break;
      }
      case msg.type.endsWith("input_audio_transcription.completed"): {
        const transcript = String(
          (msg as { transcript?: string }).transcript ?? this.partialTranscript,
        ).trim();
        this.partialTranscript = "";
        if (this.listening && transcript) {
          this.events.onTurnCommitted?.(transcript);
        }
        break;
      }
      case msg.type === "error":
        this.events.onError?.(new Error(`Voice transport error: ${raw.slice(0, 200)}`));
        break;
    }
  }

  // ---- interviewer speech out ----

  speakDelta(text: string): void {
    if (!this.chunker) {
      this.canceled = false;
      this.cycleChars = 0;
      this.player.resetAccounting();
      this.player.onPlaybackStart = () => this.events.onPlaybackStart?.();
      this.chunker = new SentenceChunker((chunk) => this.enqueueTts(chunk));
    }
    this.chunker.push(text);
  }

  async speakFlush(): Promise<void> {
    this.chunker?.flush();
    this.chunker = null;
    await this.playbackChain;
    await this.waitForDrain();
    this.events.onPlaybackEnd?.();
  }

  cancelSpeech(): number {
    this.canceled = true;
    for (const ac of this.inflight) ac.abort();
    this.inflight.clear();
    this.chunker = null;
    const total = this.player.totalScheduledSeconds();
    const heardRatio = total > 0 ? Math.min(1, this.player.playedSeconds() / total) : 0;
    this.player.stopAll();
    return Math.round(this.cycleChars * heardRatio);
  }

  private enqueueTts(chunk: string): void {
    if (this.canceled) return;
    this.cycleChars += chunk.length;
    const ac = new AbortController();
    this.inflight.add(ac);
    const responsePromise = fetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunk, personaId: this.personaId }),
      signal: ac.signal,
    });
    // Fetches run concurrently; appends stay ordered via the chain.
    this.playbackChain = this.playbackChain
      .then(async () => {
        const res = await responsePromise;
        this.inflight.delete(ac);
        if (!res.ok || !res.body || this.canceled) return;
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (this.canceled) {
            await reader.cancel().catch(() => {});
            break;
          }
          if (value) this.player.enqueuePcm(value);
        }
      })
      .catch(() => {
        this.inflight.delete(ac);
      });
  }

  private waitForDrain(): Promise<void> {
    if (!this.player.playing) return Promise.resolve();
    return new Promise((resolve) => {
      this.player.onDrained = () => resolve();
    });
  }

  // ---- prefetched clips (interjections) ----

  async prefetchClip(clipId: string, text: string): Promise<void> {
    if (this.clips.has(clipId)) return;
    const res = await fetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, personaId: this.personaId }),
    });
    if (!res.ok) return; // interjections are best-effort
    const bytes = new Uint8Array(await res.arrayBuffer());
    this.clips.set(clipId, bytes);
  }

  async playClip(clipId: string): Promise<void> {
    const bytes = this.clips.get(clipId);
    if (!bytes) return;
    this.player.resetAccounting();
    this.player.duckIn();
    this.player.enqueuePcm(bytes);
    await this.waitForDrain();
  }

  // Persona for TTS voice selection; set at start() time by the hook.
  personaId: string | null = null;
}

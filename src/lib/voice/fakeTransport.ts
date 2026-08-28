import type { VoiceController, VoiceControllerEvents } from "./transport";

/**
 * Deterministic voice controller for tests and offline dev (VOICE_FAKE=1).
 * No audio, no network: interviewer "speech" resolves instantly, and tests /
 * the dev driver simulate the candidate with `simulateUtterance`.
 */
export class FakeVoiceController implements VoiceController {
  events: VoiceControllerEvents = {};
  personaId: string | null = null;

  started = false;
  listening = false;
  private _speaking = false;
  /** Everything "spoken" by the interviewer, per speech cycle. */
  spokenCycles: string[] = [];
  private currentCycle: string | null = null;
  prefetched = new Map<string, string>();
  playedClips: string[] = [];
  canceledAtChars: number[] = [];

  get connected(): boolean {
    return this.started;
  }

  get speaking(): boolean {
    return this._speaking;
  }

  async start(opts: { sessionId: string; personaId: string | null }): Promise<void> {
    // Test hook: `window.__voiceFakeFailNextStart = true` makes the next
    // connect/reconnect attempt fail once (network-drop simulation).
    const g = globalThis as { __voiceFakeFailNextStart?: boolean };
    if (g.__voiceFakeFailNextStart) {
      g.__voiceFakeFailNextStart = false;
      throw new Error("fake voice start failure");
    }
    this.personaId = opts.personaId;
    this.started = true;
  }

  stop(): void {
    this.started = false;
  }

  setListening(on: boolean): void {
    this.listening = on;
  }

  speakDelta(text: string): void {
    if (this.currentCycle === null) {
      this.currentCycle = "";
      this._speaking = true;
      this.events.onPlaybackStart?.();
    }
    this.currentCycle += text;
  }

  async speakFlush(): Promise<void> {
    if (this.currentCycle !== null) {
      this.spokenCycles.push(this.currentCycle);
      this.currentCycle = null;
    }
    this._speaking = false;
    // Yield a tick so React effects settle like they would with real audio.
    await new Promise((r) => setTimeout(r, 5));
    this.events.onPlaybackEnd?.();
  }

  cancelSpeech(): number {
    const heard = Math.floor((this.currentCycle ?? this.spokenCycles.at(-1) ?? "").length / 2);
    this.currentCycle = null;
    this._speaking = false;
    this.canceledAtChars.push(heard);
    return heard;
  }

  async prefetchClip(clipId: string, text: string): Promise<void> {
    this.prefetched.set(clipId, text);
  }

  async playClip(clipId: string): Promise<void> {
    this.playedClips.push(clipId);
    await new Promise((r) => setTimeout(r, 5));
  }

  // ---- test/dev drivers ----

  /** Simulate the candidate speaking one complete turn (VAD → deltas → commit). */
  async simulateUtterance(
    transcript: string,
    opts: { chunkSize?: number; commit?: boolean } = {},
  ): Promise<void> {
    const { chunkSize = 12, commit = true } = opts;
    this.events.onSpeechStarted?.(Date.now());
    for (let i = 0; i < transcript.length; i += chunkSize) {
      this.events.onTranscriptDelta?.(transcript.slice(i, i + chunkSize));
      await new Promise((r) => setTimeout(r, 2));
    }
    this.events.onSpeechStopped?.(Date.now());
    if (commit && this.listening) {
      this.events.onTurnCommitted?.(transcript);
    }
  }

  /** Simulate the candidate starting to talk while the interviewer is speaking. */
  simulateBargeInStart(): void {
    this.events.onSpeechStarted?.(Date.now());
  }

  /** Simulate a transport failure (network drop) — the voice hook degrades to typing. */
  simulateError(message = "fake transport failure"): void {
    this.started = false;
    this.events.onError?.(new Error(message));
  }
}

/**
 * Gapless PCM playback queue over Web Audio. All interviewer speech routes
 * through one GainNode so barge-in stops and duck-ins are instant and
 * uniform. 24kHz 16-bit mono PCM in (matching the TTS proxy).
 */

const SAMPLE_RATE = 24000;

export class VoicePlayer {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private carry: Uint8Array = new Uint8Array(0);
  /** Total seconds of audio scheduled since the last resetAccounting(). */
  private scheduledSeconds = 0;
  onPlaybackStart: (() => void) | null = null;
  onDrained: (() => void) | null = null;
  private drainTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  get playing(): boolean {
    return this.sources.size > 0;
  }

  /** Seconds of audio actually played since the last resetAccounting(). */
  playedSeconds(): number {
    if (!this.ctx) return 0;
    const remaining = Math.max(0, this.nextStartTime - this.ctx.currentTime);
    return Math.max(0, this.scheduledSeconds - remaining);
  }

  totalScheduledSeconds(): number {
    return this.scheduledSeconds;
  }

  resetAccounting(): void {
    this.scheduledSeconds = 0;
    this.started = false;
  }

  /** Append raw PCM bytes (possibly unaligned) to the gapless queue. */
  enqueuePcm(bytes: Uint8Array): void {
    const ctx = this.ensureCtx();
    const merged = new Uint8Array(this.carry.length + bytes.length);
    merged.set(this.carry);
    merged.set(bytes, this.carry.length);
    const usable = merged.length - (merged.length % 2);
    this.carry = merged.slice(usable);
    if (usable === 0) return;

    const samples = new Int16Array(merged.buffer.slice(0, usable));
    const floats = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) floats[i] = samples[i]! / 32768;

    const buffer = ctx.createBuffer(1, floats.length, SAMPLE_RATE);
    buffer.copyToChannel(floats, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain!);

    const startAt = Math.max(ctx.currentTime + 0.02, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
    this.scheduledSeconds += buffer.duration;
    this.sources.add(source);
    if (!this.started) {
      this.started = true;
      this.onPlaybackStart?.();
    }
    source.onended = () => {
      this.sources.delete(source);
      if (this.sources.size === 0) this.scheduleDrainCheck();
    };
  }

  private scheduleDrainCheck(): void {
    // Small debounce: the next chunk may be milliseconds away.
    if (this.drainTimer) clearTimeout(this.drainTimer);
    this.drainTimer = setTimeout(() => {
      if (this.sources.size === 0) this.onDrained?.();
    }, 120);
  }

  /** Ramp from 70% to full over 300ms — a natural "talking over you" onset. */
  duckIn(): void {
    const ctx = this.ensureCtx();
    if (!this.gain) return;
    this.gain.gain.cancelScheduledValues(ctx.currentTime);
    this.gain.gain.setValueAtTime(0.7, ctx.currentTime);
    this.gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.3);
  }

  /** Hard-stop everything scheduled (candidate barge-in). */
  stopAll(): void {
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    this.sources.clear();
    this.carry = new Uint8Array(0);
    if (this.ctx) this.nextStartTime = this.ctx.currentTime;
    if (this.drainTimer) clearTimeout(this.drainTimer);
  }

  close(): void {
    this.stopAll();
    void this.ctx?.close();
    this.ctx = null;
    this.gain = null;
  }
}

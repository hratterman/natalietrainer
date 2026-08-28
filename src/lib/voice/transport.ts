/**
 * The client-side voice controller contract. Two implementations:
 * `openaiTransport.ts` (real WebRTC + TTS) and `fakeTransport.ts`
 * (deterministic, for tests and offline dev). SessionRunner's voice hook only
 * ever talks to this interface, so the phase machine stays testable with
 * zero keys.
 */

export type VoiceControllerEvents = {
  /** VAD: the candidate started speaking (epoch ms). */
  onSpeechStarted?: (atMs: number) => void;
  /** VAD: the candidate stopped speaking (epoch ms). */
  onSpeechStopped?: (atMs: number) => void;
  /** Live partial transcript text for the in-progress turn. */
  onTranscriptDelta?: (text: string) => void;
  /** The strict-IRL turn end: VAD silence elapsed and the transcript committed. */
  onTurnCommitted?: (transcript: string) => void;
  /** Interviewer audio playback started / fully drained. */
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (err: Error) => void;
};

export interface VoiceController {
  /** Connect mic + transcription. Resolves when audio is flowing. */
  start(opts: { sessionId: string; personaId: string | null }): Promise<void>;
  /** Tear everything down (mic, connections, audio). */
  stop(): void;
  /** Whether the controller is currently connected and usable. */
  readonly connected: boolean;
  /** Whether interviewer audio is currently playing. */
  readonly speaking: boolean;

  /**
   * Gate turn commits: while false, committed transcripts are dropped (used
   * during grading/transitions). The mic and VAD stay hot regardless so
   * barge-in detection keeps working.
   */
  setListening(on: boolean): void;

  /** Push a streamed piece of interviewer text to be spoken. */
  speakDelta(text: string): void;
  /** Interviewer reply finished: flush the chunker and resolve when playback drains. */
  speakFlush(): Promise<void>;
  /**
   * Hard-stop interviewer speech (candidate barge-in). Returns the
   * approximate number of characters actually heard.
   */
  cancelSpeech(): number;

  /** Pre-synthesize a clip (persona interjection line) for instant playback. */
  prefetchClip(clipId: string, text: string): Promise<void>;
  /** Play a prefetched clip, ducking in over the candidate. Resolves when done. */
  playClip(clipId: string): Promise<void>;

  events: VoiceControllerEvents;
}

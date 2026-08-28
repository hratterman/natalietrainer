"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPersona } from "@/lib/llm/personas";
import { FakeVoiceController } from "./fakeTransport";
import type { VoiceController } from "./transport";
import {
  containsNumber,
  decideInterruption,
  fillerStreakIn,
  type InterruptTrigger,
} from "./interruption";

export type VoiceStatus = "idle" | "connecting" | "ready" | "error";

export type SpokenTurnPayload = {
  transcript: string;
  voice: {
    audioDurationMs: number;
    pausesMs: number[];
    bargeIn: boolean;
    heardChars?: number;
  };
};

export type InterjectionEvent = {
  trigger: InterruptTrigger;
  line: string;
  partialTranscript: string;
  elapsedMs: number;
  voice: { audioDurationMs: number; pausesMs: number[] };
};

export type UseVoiceSession = {
  status: VoiceStatus;
  error: string | null;
  captions: string;
  speaking: boolean;
  listening: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Restart the transport (e.g. a superday round switches persona/silence window). */
  reconnect: (personaId: string | null) => Promise<void>;
  /** New question: reset per-question interruption budget + prefetch interjection clips. */
  resetQuestion: () => void;
  beginListening: () => void;
  endListening: () => void;
  speakDelta: (text: string) => void;
  speakFlush: () => Promise<void>;
  cancelSpeech: () => number;
  /** Exposed for tests / the fake dev driver. */
  getController: () => VoiceController | null;
};

export function useVoiceSession(opts: {
  enabled: boolean;
  fake: boolean;
  sessionId: string;
  personaId: string | null;
  /** A committed spoken turn — submit it. */
  onTurn: (turn: SpokenTurnPayload) => void;
  /** She started talking over the interviewer; speech was stopped. */
  onBargeIn?: () => void;
  /** The interviewer cut her off; the clip has been played. */
  onInterject?: (event: InterjectionEvent) => void;
  onError?: (message: string) => void;
  /** Set false to disable interviewer barge-ins (V2 default until wired). */
  interruptionsEnabled?: boolean;
}): UseVoiceSession {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [captions, setCaptions] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListeningState] = useState(false);

  const controllerRef = useRef<VoiceController | null>(null);
  const personaIdRef = useRef(opts.personaId);

  // Per-turn timing accumulation
  const turnStartRef = useRef<number | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const lastSpeechStopRef = useRef<number | null>(null);
  const speechMsRef = useRef(0);
  const pausesRef = useRef<number[]>([]);
  const partialRef = useRef("");
  const bargeInRef = useRef(false);
  const heardCharsRef = useRef<number | undefined>(undefined);
  const listeningRef = useRef(false);
  const interjectionsUsedRef = useRef(0);
  const interjectingRef = useRef(false);
  const bargeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  const resetTurnState = useCallback(() => {
    turnStartRef.current = null;
    speechStartRef.current = null;
    lastSpeechStopRef.current = null;
    speechMsRef.current = 0;
    pausesRef.current = [];
    partialRef.current = "";
    setCaptions("");
  }, []);

  const currentTimings = useCallback(() => {
    let speechMs = speechMsRef.current;
    if (speechStartRef.current !== null) speechMs += Date.now() - speechStartRef.current;
    return { audioDurationMs: Math.round(speechMs), pausesMs: [...pausesRef.current] };
  }, []);

  const endListening = useCallback(() => {
    listeningRef.current = false;
    setListeningState(false);
    controllerRef.current?.setListening(false);
  }, []);

  const fireInterjection = useCallback(
    async (trigger: InterruptTrigger) => {
      const controller = controllerRef.current;
      const persona = getPersona(personaIdRef.current);
      const lines = persona.interrupt.interjections[trigger];
      if (!controller || lines.length === 0 || interjectingRef.current) return;
      interjectingRef.current = true;
      interjectionsUsedRef.current += 1;
      const lineIndex = (interjectionsUsedRef.current - 1) % lines.length;
      const line = lines[lineIndex]!;

      // Grace tail: keep transcribing ~1.2s so we capture what she said while
      // being talked over, then close her turn.
      const clipPromise = controller.playClip(`${persona.id}:${trigger}:${lineIndex}`);
      await new Promise((r) => setTimeout(r, optsRef.current.fake ? 10 : 1200));
      endListening();
      const event: InterjectionEvent = {
        trigger,
        line,
        partialTranscript: partialRef.current.trim(),
        elapsedMs: turnStartRef.current ? Date.now() - turnStartRef.current : 0,
        voice: currentTimings(),
      };
      resetTurnState();
      await clipPromise;
      interjectingRef.current = false;
      optsRef.current.onInterject?.(event);
    },
    [currentTimings, endListening, resetTurnState],
  );

  const maybeInterrupt = useCallback(() => {
    if (!listeningRef.current || interjectingRef.current) return;
    if (optsRef.current.interruptionsEnabled === false) return;
    const persona = getPersona(personaIdRef.current);
    const transcript = partialRef.current;
    const midPause =
      speechStartRef.current === null && lastSpeechStopRef.current !== null
        ? Date.now() - lastSpeechStopRef.current
        : null;
    const trigger = decideInterruption({
      profile: persona.interrupt,
      elapsedMs: turnStartRef.current ? Date.now() - turnStartRef.current : 0,
      transcriptChars: transcript.length,
      hasNumber: containsNumber(transcript),
      fillerStreak: fillerStreakIn(transcript),
      midAnswerPauseMs: midPause,
      interjectionsUsed: interjectionsUsedRef.current,
    });
    if (trigger) void fireInterjection(trigger);
  }, [fireInterjection]);

  // Periodic check catches time/stall triggers between transcript events.
  useEffect(() => {
    if (!listening) return;
    const iv = setInterval(maybeInterrupt, 500);
    return () => clearInterval(iv);
  }, [listening, maybeInterrupt]);

  const wireEvents = useCallback(
    (controller: VoiceController) => {
      controller.events = {
        onSpeechStarted: (atMs) => {
          // Candidate barge-in: she talks while the interviewer is speaking.
          if (controller.speaking) {
            if (bargeTimerRef.current) clearTimeout(bargeTimerRef.current);
            bargeTimerRef.current = setTimeout(
              () => {
                if (!controller.speaking) return;
                const heard = controller.cancelSpeech();
                setSpeaking(false);
                bargeInRef.current = true;
                heardCharsRef.current = heard;
                optsRef.current.onBargeIn?.();
              },
              optsRef.current.fake ? 0 : 250,
            );
          }
          if (turnStartRef.current === null) turnStartRef.current = atMs;
          if (lastSpeechStopRef.current !== null) {
            pausesRef.current.push(atMs - lastSpeechStopRef.current);
            lastSpeechStopRef.current = null;
          }
          speechStartRef.current = atMs;
        },
        onSpeechStopped: (atMs) => {
          if (bargeTimerRef.current) {
            clearTimeout(bargeTimerRef.current);
            bargeTimerRef.current = null;
          }
          if (speechStartRef.current !== null) {
            speechMsRef.current += atMs - speechStartRef.current;
            speechStartRef.current = null;
          }
          lastSpeechStopRef.current = atMs;
        },
        onTranscriptDelta: (text) => {
          partialRef.current += text;
          setCaptions(partialRef.current);
          maybeInterrupt();
        },
        onTurnCommitted: (transcript) => {
          if (interjectingRef.current) return;
          const timings = currentTimings();
          const payload: SpokenTurnPayload = {
            transcript,
            voice: {
              ...timings,
              bargeIn: bargeInRef.current,
              ...(heardCharsRef.current !== undefined
                ? { heardChars: heardCharsRef.current }
                : {}),
            },
          };
          bargeInRef.current = false;
          heardCharsRef.current = undefined;
          endListening();
          resetTurnState();
          optsRef.current.onTurn(payload);
        },
        onPlaybackStart: () => setSpeaking(true),
        onPlaybackEnd: () => setSpeaking(false),
        onError: (err) => {
          setError(err.message);
          setStatus("error");
          optsRef.current.onError?.(err.message);
        },
      };
    },
    [currentTimings, endListening, maybeInterrupt, resetTurnState],
  );

  const connect = useCallback(async () => {
    if (controllerRef.current?.connected) return;
    setStatus("connecting");
    setError(null);
    try {
      const controller: VoiceController = optsRef.current.fake
        ? new FakeVoiceController()
        : new (await import("./openaiTransport")).OpenAiVoiceController();
      wireEvents(controller);
      await controller.start({
        sessionId: optsRef.current.sessionId,
        personaId: personaIdRef.current,
      });
      controllerRef.current = controller;
      if (optsRef.current.fake && typeof window !== "undefined") {
        // Test/dev driver handle (VOICE_FAKE only).
        (window as unknown as { __voiceFakeController?: VoiceController }).__voiceFakeController =
          controller;
      }
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice setup failed.");
      setStatus("error");
      throw err;
    }
  }, [wireEvents]);

  const disconnect = useCallback(() => {
    controllerRef.current?.stop();
    controllerRef.current = null;
    setStatus("idle");
  }, []);

  const reconnect = useCallback(
    async (personaId: string | null) => {
      if (personaIdRef.current === personaId && controllerRef.current?.connected) return;
      personaIdRef.current = personaId;
      disconnect();
      await connect();
    },
    [connect, disconnect],
  );

  const resetQuestion = useCallback(() => {
    interjectionsUsedRef.current = 0;
    resetTurnState();
    // Best-effort prefetch of this persona's interjection clips.
    const controller = controllerRef.current;
    const persona = getPersona(personaIdRef.current);
    if (!controller) return;
    for (const [trigger, lines] of Object.entries(persona.interrupt.interjections)) {
      lines.forEach((line, i) => {
        void controller.prefetchClip(`${persona.id}:${trigger}:${i}`, line);
      });
    }
  }, [resetTurnState]);

  const beginListening = useCallback(() => {
    resetTurnState();
    turnStartRef.current = Date.now();
    listeningRef.current = true;
    setListeningState(true);
    controllerRef.current?.setListening(true);
  }, [resetTurnState]);

  const speakDelta = useCallback((text: string) => {
    controllerRef.current?.speakDelta(text);
  }, []);

  const speakFlush = useCallback(async () => {
    await controllerRef.current?.speakFlush();
  }, []);

  const cancelSpeech = useCallback(() => {
    return controllerRef.current?.cancelSpeech() ?? 0;
  }, []);

  // Teardown on unmount.
  useEffect(() => {
    return () => {
      controllerRef.current?.stop();
      controllerRef.current = null;
    };
  }, []);

  return {
    status,
    error,
    captions,
    speaking,
    listening,
    connect,
    disconnect,
    reconnect,
    resetQuestion,
    beginListening,
    endListening,
    speakDelta,
    speakFlush,
    cancelSpeech,
    getController: () => controllerRef.current,
  };
}

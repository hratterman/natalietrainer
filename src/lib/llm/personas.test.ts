import { describe, expect, it } from "vitest";
import { INTERRUPT_TRIGGERS } from "@/lib/voice/interruption";
import { PERSONAS, getPersona } from "./personas";

describe("persona roster integrity", () => {
  it("has 7 personas with unique ids and unique voices", () => {
    expect(PERSONAS).toHaveLength(7);
    const ids = PERSONAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(7);
    const voices = PERSONAS.map((p) => p.voice.ttsVoice);
    expect(new Set(voices).size).toBe(7);
  });

  it("every persona has greetings and sane silence windows", () => {
    for (const p of PERSONAS) {
      expect(p.greetings.length, p.id).toBeGreaterThanOrEqual(1);
      expect(p.silenceDurationMs, p.id).toBeGreaterThanOrEqual(1000);
      expect(p.silenceDurationMs, p.id).toBeLessThanOrEqual(4000);
      expect(p.voice.ttsInstructions.length, p.id).toBeGreaterThan(20);
    }
  });

  it("interjection lines exist exactly for the non-null triggers", () => {
    for (const p of PERSONAS) {
      const { interrupt } = p;
      const thresholdFor = {
        ramble: interrupt.rambleCharThreshold,
        stall: interrupt.stallPauseMs,
        filler: interrupt.fillerStreakLimit,
        time: interrupt.patienceMs,
      };
      for (const trigger of INTERRUPT_TRIGGERS) {
        if (thresholdFor[trigger] !== null) {
          expect(
            interrupt.interjections[trigger].length,
            `${p.id} has a ${trigger} threshold but no lines`,
          ).toBeGreaterThanOrEqual(1);
        } else {
          expect(
            interrupt.interjections[trigger].length,
            `${p.id} has ${trigger} lines but no threshold`,
          ).toBe(0);
        }
      }
      const anyTrigger = Object.values(thresholdFor).some((t) => t !== null);
      if (!anyTrigger) {
        expect(interrupt.maxInterjectionsPerQuestion, p.id).toBe(0);
      } else {
        expect(interrupt.maxInterjectionsPerQuestion, p.id).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("friendly-vp never interrupts; trader is the most aggressive", () => {
    const vp = getPersona("friendly-vp");
    expect(vp.interrupt.maxInterjectionsPerQuestion).toBe(0);
    const trader = getPersona("trader");
    expect(trader.interrupt.patienceMs).toBeLessThanOrEqual(30_000);
  });

  it("getPersona falls back to the first persona", () => {
    expect(getPersona("nope").id).toBe("friendly-vp");
    expect(getPersona(null).id).toBe("friendly-vp");
  });
});

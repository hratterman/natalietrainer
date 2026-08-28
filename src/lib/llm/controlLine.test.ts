import { describe, expect, it } from "vitest";
import { ControlLineBuffer, parseControlLine, splitControlLine } from "./controlLine";

describe("parseControlLine", () => {
  it("parses all actions", () => {
    expect(parseControlLine('{"action":"followup"}')).toBe("followup");
    expect(parseControlLine('{"action":"wrapup"}')).toBe("wrapup");
    expect(parseControlLine('{"action":"ask"}')).toBe("ask");
    expect(parseControlLine('{"action":"coach"}')).toBe("coach");
    expect(parseControlLine('{"action":"check"}')).toBe("check");
  });

  it("rejects malformed lines", () => {
    expect(parseControlLine("hello")).toBeNull();
    expect(parseControlLine('{"action":"grade"}')).toBeNull();
    expect(parseControlLine('{"action"')).toBeNull();
  });
});

describe("ControlLineBuffer", () => {
  it("withholds output until the newline, then releases the remainder", () => {
    const buf = new ControlLineBuffer();
    expect(buf.push('{"action":"fol')).toBe("");
    expect(buf.action).toBeNull();
    expect(buf.push('lowup"}\nOkay, but')).toBe("Okay, but");
    expect(buf.action).toBe("followup");
    expect(buf.push(" what if it's cash-financed?")).toBe(" what if it's cash-financed?");
    expect(buf.result()).toEqual({
      action: "followup",
      spoken: "Okay, but what if it's cash-financed?",
    });
  });

  it("handles the control line split across many chunks", () => {
    const buf = new ControlLineBuffer();
    const full = '{"action":"wrapup"}\nAlright, let\'s move on.';
    let spoken = "";
    for (const ch of full) spoken += buf.push(ch);
    expect(spoken).toBe("Alright, let's move on.");
    expect(buf.result().action).toBe("wrapup");
  });

  it("falls back to followup + full passthrough when the first line is not a control line", () => {
    const buf = new ControlLineBuffer();
    const out = buf.push("Good answer. Now tell me\nwhy the DTL exists.");
    expect(out).toBe("Good answer. Now tell me\nwhy the DTL exists.");
    expect(buf.result().action).toBe("followup");
  });

  it("gives up waiting for a newline after a long prefix", () => {
    const buf = new ControlLineBuffer();
    const long = "x".repeat(250);
    expect(buf.push(long)).toBe(long);
    expect(buf.result().action).toBe("followup");
  });

  it("handles stream ending right after the control line", () => {
    const buf = new ControlLineBuffer();
    buf.push('{"action":"wrapup"}');
    expect(buf.result()).toEqual({ action: "wrapup", spoken: "" });
  });
});

describe("defaultAction fallback", () => {
  it("malformed coach output falls back to the coach action", () => {
    const buf = new ControlLineBuffer("coach");
    buf.push("Let me explain that differently.\nThe tax shield works like this.");
    expect(buf.result().action).toBe("coach");
  });
});

describe("splitControlLine", () => {
  it("splits complete replies", () => {
    expect(splitControlLine('{"action":"wrapup"}\nLet\'s move on.')).toEqual({
      action: "wrapup",
      spoken: "Let's move on.",
    });
  });
});

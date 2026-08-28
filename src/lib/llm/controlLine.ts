/**
 * The interviewer's control-line protocol: every interviewer message begins
 * with one JSON object on the first line ({"action":"followup"} or
 * {"action":"wrapup"}), then a newline, then the spoken text.
 *
 * Pure module (no server deps) so it is unit-testable and usable by both the
 * SSE route and the mock stream.
 */

export type InterviewerAction = "followup" | "wrapup" | "ask" | "coach" | "check";

export type ParsedControlLine = {
  action: InterviewerAction;
  /** Spoken text after the control line (may be empty while streaming). */
  spoken: string;
};

/**
 * Incremental parser for a streamed interviewer reply. Feed it text deltas;
 * it withholds output until the first newline, parses the control line, and
 * exposes the spoken remainder.
 */
export class ControlLineBuffer {
  private buffer = "";
  private parsed: ParsedControlLine | null = null;
  private malformed = false;
  private readonly defaultAction: InterviewerAction;

  constructor(defaultAction: InterviewerAction = "followup") {
    this.defaultAction = defaultAction;
  }

  /** Feed a delta. Returns newly available spoken text (empty until the control line resolves). */
  push(delta: string): string {
    if (this.malformed) return delta;
    if (this.parsed) {
      this.parsed.spoken += delta;
      return delta;
    }
    this.buffer += delta;
    const newlineIndex = this.buffer.indexOf("\n");
    if (newlineIndex === -1) {
      // Guard: if the model never emits a newline in a reasonable prefix,
      // treat the whole thing as spoken text with the default action.
      if (this.buffer.length > 200) {
        this.malformed = true;
        this.parsed = { action: this.defaultAction, spoken: this.buffer };
        return this.buffer;
      }
      return "";
    }
    const firstLine = this.buffer.slice(0, newlineIndex).trim();
    const rest = this.buffer.slice(newlineIndex + 1);
    const action = parseControlLine(firstLine);
    if (action) {
      this.parsed = { action, spoken: rest };
      return rest;
    }
    // First line wasn't a control line: pass everything through as spoken.
    this.malformed = true;
    this.parsed = { action: this.defaultAction, spoken: this.buffer };
    return this.buffer;
  }

  /** Finalize; call after the stream ends. */
  result(): ParsedControlLine {
    if (this.parsed) return this.parsed;
    // Stream ended before a newline ever arrived.
    const firstLine = this.buffer.trim();
    const action = parseControlLine(firstLine);
    if (action) return { action, spoken: "" };
    return { action: this.defaultAction, spoken: this.buffer };
  }

  get action(): InterviewerAction | null {
    return this.parsed?.action ?? null;
  }
}

export function parseControlLine(line: string): InterviewerAction | null {
  if (!line.startsWith("{")) return null;
  try {
    const obj = JSON.parse(line) as { action?: unknown };
    if (
      obj.action === "followup" ||
      obj.action === "wrapup" ||
      obj.action === "ask" ||
      obj.action === "coach" ||
      obj.action === "check"
    ) {
      return obj.action;
    }
    return null;
  } catch {
    return null;
  }
}

/** Split a complete (non-streamed) interviewer reply. */
export function splitControlLine(full: string): ParsedControlLine {
  const buf = new ControlLineBuffer();
  buf.push(full);
  return buf.result();
}

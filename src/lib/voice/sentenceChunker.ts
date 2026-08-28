/**
 * Incremental sentence chunker: feed it streamed text deltas and it emits
 * TTS-sized chunks at natural speech boundaries, so audio synthesis can start
 * on the first sentence while the LLM is still generating.
 *
 * Pure module — usable client-side and unit-testable.
 */

/** Merge chunks shorter than this with the next sentence (prosody). */
export const MIN_CHUNK_CHARS = 60;
/** Split anything longer than this on secondary boundaries (TTS input cap 4096; we stay well under). */
export const MAX_CHUNK_CHARS = 350;

const SENTENCE_END = /([.!?:])(["')\]]*)(\s|$)/;

export class SentenceChunker {
  private buffer = "";
  private readonly out: (chunk: string) => void;

  constructor(onChunk: (chunk: string) => void) {
    this.out = onChunk;
  }

  push(delta: string): void {
    this.buffer += delta;
    this.drain(false);
  }

  /** Call when the stream ends; flushes any remainder. */
  flush(): void {
    this.drain(true);
    const rest = this.buffer.trim();
    if (rest.length > 0) this.out(rest);
    this.buffer = "";
  }

  private drain(final: boolean): void {
    for (;;) {
      const cut = this.findCut(final);
      if (cut === null) return;
      const chunk = this.buffer.slice(0, cut).trim();
      this.buffer = this.buffer.slice(cut);
      if (chunk.length > 0) this.out(chunk);
    }
  }

  /** Index to cut at, or null if no complete-enough chunk is buffered yet. */
  private findCut(final: boolean): number | null {
    // Hard split: buffer exceeded max — cut at the last comma/space before max.
    if (this.buffer.length > MAX_CHUNK_CHARS) {
      const window = this.buffer.slice(0, MAX_CHUNK_CHARS);
      const comma = window.lastIndexOf(", ");
      if (comma > MIN_CHUNK_CHARS) return comma + 2;
      const space = window.lastIndexOf(" ");
      return space > 0 ? space + 1 : MAX_CHUNK_CHARS;
    }

    // Look for a sentence end far enough in to satisfy the minimum.
    let searchFrom = 0;
    for (;;) {
      const slice = this.buffer.slice(searchFrom);
      const m = SENTENCE_END.exec(slice);
      if (!m || m.index === undefined) return null;
      const end = searchFrom + m.index + m[1]!.length + (m[2]?.length ?? 0);
      // Require trailing whitespace (or final flush) so we don't cut "3.5" mid-number.
      const boundaryChar = this.buffer[end] ?? "";
      const atStreamEnd = end >= this.buffer.length;
      const isBoundary = /\s/.test(boundaryChar) || (atStreamEnd && final);
      if (!isBoundary) {
        searchFrom = end;
        continue;
      }
      if (end >= MIN_CHUNK_CHARS) return end;
      // Sentence too short: keep looking for the next boundary to merge into.
      searchFrom = end;
    }
  }
}

/** Convenience: chunk a complete string. */
export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const chunker = new SentenceChunker((c) => chunks.push(c));
  chunker.push(text);
  chunker.flush();
  return chunks;
}

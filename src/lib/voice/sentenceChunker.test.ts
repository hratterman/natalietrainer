import { describe, expect, it } from "vitest";
import { chunkText, MAX_CHUNK_CHARS, MIN_CHUNK_CHARS, SentenceChunker } from "./sentenceChunker";

function collect(): { chunks: string[]; chunker: SentenceChunker } {
  const chunks: string[] = [];
  return { chunks, chunker: new SentenceChunker((c) => chunks.push(c)) };
}

describe("SentenceChunker", () => {
  it("emits a chunk once a sentence boundary past the minimum arrives", () => {
    const { chunks, chunker } = collect();
    chunker.push("Walk me through the three statements when depreciation rises. ");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe("Walk me through the three statements when depreciation rises.");
  });

  it("holds short sentences and merges them with the next", () => {
    const { chunks, chunker } = collect();
    chunker.push("Okay. ");
    expect(chunks).toHaveLength(0); // below MIN — wait
    chunker.push("Let's start with something on accounting that I think you'll enjoy. ");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.startsWith("Okay. Let's start")).toBe(true);
    expect(chunks[0]!.length).toBeGreaterThanOrEqual(MIN_CHUNK_CHARS);
  });

  it("does not cut decimals like 3.5", () => {
    const { chunks, chunker } = collect();
    chunker.push("The company trades at 3.5 turns of leverage and roughly 10.2 times EBITDA today. ");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("3.5");
    expect(chunks[0]).toContain("10.2");
  });

  it("streams char-by-char and produces the same chunks", () => {
    const text =
      "First, pre-tax income falls by ten dollars. Second, taxes fall by two fifty, so net income is down seven fifty. Does that all make sense to you?";
    const whole = chunkText(text);
    const { chunks, chunker } = collect();
    for (const ch of text) chunker.push(ch);
    chunker.flush();
    expect(chunks).toEqual(whole);
    expect(chunks.join(" ")).toBe(text);
  });

  it("hard-splits overlong sentences near the max", () => {
    const long = `${"alpha beta gamma delta, ".repeat(30)}end.`;
    const chunks = chunkText(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
  });

  it("flush emits any trailing text without punctuation", () => {
    const { chunks, chunker } = collect();
    chunker.push("And one more thing about the tax shield");
    expect(chunks).toHaveLength(0);
    chunker.flush();
    expect(chunks).toEqual(["And one more thing about the tax shield"]);
  });

  it("flush on empty buffer emits nothing", () => {
    const { chunks, chunker } = collect();
    chunker.flush();
    expect(chunks).toHaveLength(0);
  });
});

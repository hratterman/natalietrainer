import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaMessageParam, BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta";
import type { BetaMessageStream } from "@anthropic-ai/sdk/lib/BetaMessageStream";
import type { z } from "zod";

/** Exact model string — no date suffix. */
export const MODEL = "claude-opus-5";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

const globalForClient = globalThis as unknown as { __anthropic?: Anthropic };

export function getClient(): Anthropic {
  if (!globalForClient.__anthropic) {
    globalForClient.__anthropic = new Anthropic();
  }
  return globalForClient.__anthropic;
}

export function isMock(): boolean {
  return process.env.LLM_MOCK === "1";
}

export type Effort = "low" | "medium" | "high";

export type SystemBlock = BetaTextBlockParam;

/** Build a cache-stable system prompt: breakpoint on the last block. */
export function systemBlocks(...texts: string[]): SystemBlock[] {
  return texts.map((text, i) => ({
    type: "text" as const,
    text,
    ...(i === texts.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
}

/** App-level error the routes can map to friendly responses. */
export class LlmError extends Error {
  constructor(
    message: string,
    public readonly kind: "auth" | "rate_limit" | "refusal" | "parse" | "unknown",
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

function mapError(err: unknown): LlmError {
  if (err instanceof Anthropic.AuthenticationError) {
    return new LlmError(
      "Anthropic API key missing or invalid — check ANTHROPIC_API_KEY in .env.local.",
      "auth",
      false,
    );
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new LlmError("Rate limited by the Anthropic API — wait a moment and retry.", "rate_limit", true);
  }
  if (err instanceof Anthropic.APIError) {
    return new LlmError(`Anthropic API error: ${err.message}`, "unknown", err.status >= 500);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new LlmError("Could not reach the Anthropic API — check your connection.", "unknown", true);
  }
  return new LlmError(err instanceof Error ? err.message : String(err), "unknown", false);
}

/**
 * Structured, non-streaming call. All policy (model, thinking, fallbacks)
 * lives here; callers pass content only.
 */
export async function parseStructured<Schema extends z.ZodType>(
  schema: Schema,
  input: {
    system: SystemBlock[];
    messages: BetaMessageParam[];
    effort: Effort;
    maxTokens?: number;
  },
): Promise<z.infer<Schema>> {
  const client = getClient();
  try {
    const message = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: input.maxTokens ?? 8000,
      thinking: { type: "adaptive" },
      output_config: { format: betaZodOutputFormat(schema), effort: input.effort },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: input.system,
      messages: input.messages,
    });
    if (message.stop_reason === "refusal") {
      throw new LlmError(
        "The model declined this request even after fallback — try again or rephrase.",
        "refusal",
        true,
      );
    }
    if (message.parsed_output == null) {
      throw new LlmError("Model returned no parseable structured output.", "parse", true);
    }
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[llm] structured call: cache_read=${message.usage.cache_read_input_tokens ?? 0} in=${message.usage.input_tokens} out=${message.usage.output_tokens}`,
      );
    }
    return message.parsed_output;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    throw mapError(err);
  }
}

/**
 * Streaming text call for interviewer turns. Returns the SDK stream; callers
 * pipe deltas to SSE and read the final message for persistence.
 */
export function streamText(input: {
  system: SystemBlock[];
  messages: BetaMessageParam[];
  effort: Effort;
  maxTokens?: number;
}): BetaMessageStream {
  const client = getClient();
  return client.beta.messages.stream({
    model: MODEL,
    max_tokens: input.maxTokens ?? 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: input.effort },
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: input.system,
    messages: input.messages,
  });
}

export { mapError as mapLlmError };

import { NextResponse } from "next/server";
import type { z } from "zod";
import { LlmError } from "@/lib/llm/client";

export async function parseBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<{ ok: true; data: z.infer<Schema> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Body must be JSON." }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Invalid request: ${issue?.path.join(".") ?? ""} ${issue?.message ?? ""}`.trim() },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof LlmError) {
    const status = err.kind === "auth" ? 500 : err.kind === "rate_limit" ? 429 : 502;
    return NextResponse.json({ error: err.message, retryable: err.retryable }, { status });
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 500 });
}

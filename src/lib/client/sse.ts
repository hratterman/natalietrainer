"use client";

/** Read an SSE response of {"type":"delta"|"done"|"error"} events (shared by SessionRunner and LearnRunner). */
export async function readSseStream(
  res: Response,
  handlers: { onDelta?: (text: string) => void; onDone?: (done: { action: string }) => void },
): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const line = event.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const payload = JSON.parse(line.slice(6)) as {
        type: string;
        text?: string;
        action?: string;
        error?: string;
      };
      if (payload.type === "delta") handlers.onDelta?.(payload.text ?? "");
      else if (payload.type === "done") handlers.onDone?.({ action: payload.action ?? "wrapup" });
      else if (payload.type === "error") throw new Error(payload.error ?? "Stream failed");
    }
  }
}

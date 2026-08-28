import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "natalie-voice-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "test.db");
  process.env.LLM_MOCK = "1";
});

afterEach(async () => {
  const { resetDbForTests } = await import("@/lib/db/index");
  resetDbForTests();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATABASE_PATH;
});

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function readSse(response: Response): Promise<{ text: string; done: { action?: string } }> {
  const raw = await response.text();
  let text = "";
  let done: { action?: string } = {};
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = JSON.parse(line.slice(6)) as { type: string; text?: string; action?: string };
    if (payload.type === "delta") text += payload.text ?? "";
    if (payload.type === "done") done = payload;
    if (payload.type === "error") throw new Error(JSON.stringify(payload));
  }
  return { text, done };
}

const VOICE_CONFIG = {
  subtopicIds: ["acct.cascades"],
  areaIds: ["acct"],
  difficulty: 4,
  questionCount: 2,
  personaId: "trader",
  secondsPerQuestion: null,
  rounds: null,
  voiceMode: true,
};

describe("voice drill lifecycle (LLM_MOCK)", () => {
  it("open → spoken answer with metrics → interject → grade with delivery → complete", async () => {
    const { POST: createSession } = await import("./sessions/route");
    const { POST: open } = await import("./sessions/[id]/open/route");
    const { POST: answer } = await import("./sessions/[id]/answer/route");
    const { POST: interject } = await import("./sessions/[id]/interject/route");
    const { POST: grade } = await import("./sessions/[id]/grade/route");
    const repo = await import("@/lib/db/repo");
    const { followUpsUsed } = await import("@/lib/session/engine");

    const createRes = await createSession(
      jsonRequest("http://test/api/sessions", { mode: "drill", config: VOICE_CONFIG }),
    );
    expect(createRes.status).toBe(200);
    const { sessionId } = (await createRes.json()) as { sessionId: string };
    const question = repo.getActiveQuestion(sessionId)!;

    // Spoken opening — persisted as first interviewer turn, action "ask".
    const openRes = await open(
      jsonRequest(`http://test/api/sessions/${sessionId}/open`, { questionId: question.id }),
      ctx(sessionId),
    );
    const opened = await readSse(openRes);
    expect(opened.done.action).toBe("ask");
    expect(opened.text.length).toBeGreaterThan(0);
    const turns0 = repo.getTurns(question.id);
    expect(turns0).toHaveLength(1);
    expect(turns0[0]?.role).toBe("interviewer");
    // Session start ⇒ greeting included in the spoken open (mock uses greetings[0]).
    expect(opened.text).toContain("fifteen minutes");
    // Opening never consumes the follow-up budget.
    expect(followUpsUsed(question.id)).toBe(0);

    // Re-opening replays idempotently without a new turn.
    const reopen = await open(
      jsonRequest(`http://test/api/sessions/${sessionId}/open`, { questionId: question.id }),
      ctx(sessionId),
    );
    const replayed = await readSse(reopen);
    expect(replayed.text).toBe(opened.text);
    expect(repo.getTurns(question.id)).toHaveLength(1);

    // Interviewer cuts her off mid-ramble.
    const interjectRes = await interject(
      jsonRequest(`http://test/api/sessions/${sessionId}/interject`, {
        questionId: question.id,
        answer: "So um basically the way to think about it is, you know, there are effects",
        elapsedMs: 21_000,
        voice: { audioDurationMs: 20_000, pausesMs: [900] },
        trigger: "ramble",
        interjectionText: "Stop. Number first, story later.",
      }),
      ctx(sessionId),
    );
    expect(interjectRes.status).toBe(200);
    const afterInterject = repo.getTurns(question.id);
    expect(afterInterject).toHaveLength(3);
    expect(afterInterject[1]?.interruption).toBe("cut_off");
    expect(afterInterject[1]?.deliveryMetricsJson?.fillerCount).toBeGreaterThan(0);
    expect(afterInterject[2]?.interruption).toBe("interjection");
    // Interjections don't eat the follow-up cap.
    expect(followUpsUsed(question.id)).toBe(0);

    // She recovers with a spoken answer (barge-in tagged).
    const answerRes = await answer(
      jsonRequest(`http://test/api/sessions/${sessionId}/answer`, {
        questionId: question.id,
        answer: "Net income falls seven fifty and cash rises two fifty.",
        elapsedMs: 12_000,
        voice: { audioDurationMs: 11_000, pausesMs: [], bargeIn: true, heardChars: 20 },
      }),
      ctx(sessionId),
    );
    const sse = await readSse(answerRes);
    expect(["followup", "wrapup"]).toContain(sse.done.action);
    const candidateTurns = repo
      .getTurns(question.id)
      .filter((t) => t.role === "candidate");
    expect(candidateTurns[1]?.interruption).toBe("barge_in");
    expect(candidateTurns[1]?.deliveryMetricsJson?.wordCount).toBeGreaterThan(5);

    // Keep answering until wrapup (drill cap = 1 follow-up).
    let guard = 0;
    while (repo.getQuestion(question.id)?.status === "active" && guard++ < 4) {
      const res = await answer(
        jsonRequest(`http://test/api/sessions/${sessionId}/answer`, {
          questionId: question.id,
          answer: "With cash financing you lose the after-tax interest income instead.",
          voice: { audioDurationMs: 8_000, pausesMs: [], bargeIn: false },
        }),
        ctx(sessionId),
      );
      await res.text();
    }
    expect(repo.getQuestion(question.id)?.status).toBe("answered");

    // Grade carries the delivery dimension for voice sessions.
    const gradeRes = await grade(
      jsonRequest(`http://test/api/sessions/${sessionId}/grade`, { questionId: question.id }),
      ctx(sessionId),
    );
    const gradeBody = (await gradeRes.json()) as {
      grade: { delivery: number | null; deliveryFeedback: string[] };
    };
    expect(gradeBody.grade.delivery).not.toBeNull();
    expect(gradeBody.grade.deliveryFeedback.length).toBeGreaterThan(0);
    const stored = repo.getGrade(question.id);
    expect(stored?.delivery).not.toBeNull();
    expect(stored?.feedbackJson.delivery?.length).toBeGreaterThan(0);
  });

  it("typed sessions still yield delivery: null", async () => {
    const { POST: createSession } = await import("./sessions/route");
    const { POST: answer } = await import("./sessions/[id]/answer/route");
    const { POST: grade } = await import("./sessions/[id]/grade/route");
    const repo = await import("@/lib/db/repo");

    const createRes = await createSession(
      jsonRequest("http://test/api/sessions", {
        mode: "drill",
        config: { ...VOICE_CONFIG, voiceMode: false, personaId: null },
      }),
    );
    const { sessionId } = (await createRes.json()) as { sessionId: string };
    const question = repo.getActiveQuestion(sessionId)!;

    let guard = 0;
    while (repo.getQuestion(question.id)?.status === "active" && guard++ < 4) {
      const res = await answer(
        jsonRequest(`http://test/api/sessions/${sessionId}/answer`, {
          questionId: question.id,
          answer: "Typed answer covering the full walk.",
        }),
        ctx(sessionId),
      );
      await res.text();
    }
    const gradeRes = await grade(
      jsonRequest(`http://test/api/sessions/${sessionId}/grade`, { questionId: question.id }),
      ctx(sessionId),
    );
    const body = (await gradeRes.json()) as { grade: { delivery: number | null } };
    expect(body.grade.delivery).toBeNull();
    expect(repo.getGrade(question.id)?.delivery).toBeNull();
  });

  it("voice availability reflects VOICE_FAKE", async () => {
    const { GET } = await import("./voice/availability/route");
    delete process.env.OPENAI_API_KEY;
    process.env.VOICE_FAKE = "1";
    const res = await GET();
    expect(((await res.json()) as { available: boolean }).available).toBe(true);
    delete process.env.VOICE_FAKE;
    const res2 = await GET();
    expect(((await res2.json()) as { available: boolean }).available).toBe(false);
  });
});

/**
 * B2: double-clicks and second tabs must never duplicate work or dead-end —
 * double Submit, double Next, a stale tab answering an already-wrapped
 * question, and two tabs completing the same session.
 */
import { LONG_ANSWER, setVoiceToggle } from "../helpers.mjs";

export const name = "double actions + two tabs";

async function sessionState(page, base, sessionId) {
  return page.evaluate(
    async ({ b, id }) => {
      const res = await fetch(`${b}/api/sessions/${id}`);
      return res.json();
    },
    { b: base, id: sessionId },
  );
}

export async function run({ page, base }) {
  await page.goto(`${base}/train/new?mode=drill&subtopicId=acct.cascades&difficulty=4`);
  await page.waitForSelector("text=Subtopics to drill");
  await setVoiceToggle(page, false);
  await page.click("text=Start session");
  await page.waitForSelector("textarea", { timeout: 60000 });
  const sessionId = page.url().split("/train/")[1];

  // ---- Double-click Submit: exactly one candidate turn lands ----
  await page.locator("textarea").first().fill(LONG_ANSWER);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Submit answer"),
    );
    btn.click();
    btn.click();
  });
  await page.waitForSelector("text=Interviewer", { timeout: 60000 });
  await page.waitForSelector("textarea", { timeout: 60000 });
  let state = await sessionState(page, base, sessionId);
  const q1 = state.questions[0];
  const candidateTurns = q1.turns.filter((t) => t.role === "candidate").length;
  if (candidateTurns !== 1) {
    throw new Error(`double submit persisted ${candidateTurns} candidate turns`);
  }

  // Finish the question.
  await page.locator("textarea").first().fill(LONG_ANSWER);
  await page.click("text=Submit answer");
  await page.waitForSelector("text=Show model answer", { timeout: 90000 });

  // ---- Double-click Next: exactly one new question ----
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Next question"),
    );
    btn.click();
    btn.click();
  });
  await page.waitForSelector("textarea", { timeout: 60000 });
  state = await sessionState(page, base, sessionId);
  if (state.questions.length !== 2) {
    throw new Error(`double Next produced ${state.questions.length} questions, expected 2`);
  }

  // ---- Second tab answers a question the first tab already wrapped up ----
  const tab2 = await page.context().newPage();
  tab2.setDefaultTimeout(30000);
  await tab2.goto(`${base}/train/${sessionId}`);
  await tab2.waitForSelector("textarea", { timeout: 60000 });

  // Tab 1 drives question 2 to answered (wrapup after the follow-up).
  for (let i = 0; i < 3; i++) {
    const graded = await page.locator("text=Show model answer").isVisible().catch(() => false);
    if (graded) break;
    await page.waitForSelector("textarea", { timeout: 60000 });
    await page.locator("textarea").first().fill(LONG_ANSWER);
    await page.click("text=Submit answer");
    await Promise.race([
      page.waitForSelector("text=Show model answer", { timeout: 90000 }),
      page.waitForSelector("textarea", { timeout: 90000 }),
    ]);
  }

  // Tab 2 still shows the stale textarea for question 2 — submit anyway.
  await tab2.locator("textarea").first().fill("Stale tab answer.");
  await tab2.click("text=Submit answer");
  // It must recover via resync — never the error screen.
  await tab2.waitForTimeout(2500);
  if (await tab2.locator("text=Something went wrong").isVisible().catch(() => false)) {
    throw new Error("stale-tab submit dead-ended on the error screen");
  }
  state = await sessionState(page, base, sessionId);
  const q2 = state.questions[1];
  const staleLanded = q2.turns.some((t) => t.content === "Stale tab answer.");
  if (staleLanded) throw new Error("stale-tab answer was persisted onto a wrapped question");

  // ---- Concurrent completion: the button and a raw POST race cleanly ----
  await page.click("text=Next question");
  await page.waitForSelector("textarea", { timeout: 60000 });
  await Promise.all([
    page.click("text=End session early"),
    tab2.evaluate(
      async ({ b, id }) => {
        const res = await fetch(`${b}/api/sessions/${id}/complete`, { method: "POST" });
        if (res.status >= 500) throw new Error(`concurrent complete blew up: ${res.status}`);
      },
      { b: base, id: sessionId },
    ),
  ]);
  await page.waitForURL("**/debrief", { timeout: 90000 });
  // The other tab now redirects to the same debrief.
  await tab2.goto(`${base}/train/${sessionId}`);
  await tab2.waitForURL("**/debrief", { timeout: 60000 });
  await tab2.close();
}

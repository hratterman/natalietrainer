/**
 * B6: voice failure angles — a dropped transport degrades to typing and the
 * typed answer is graded WITHOUT delivery (A11); speech during grading is
 * dropped silently; the voice toggle turns off mid-lesson; a failed
 * round-break reconnect degrades instead of dead-ending.
 */
import { LONG_ANSWER, missDrillQuestion, passVoiceCheck, say } from "../helpers.mjs";

export const name = "voice failure angles";

export async function run({ page, base }) {
  // ---- Voice drill: drop the transport mid-question ----
  await page.goto(`${base}/train/new?mode=drill&subtopicId=acct.cascades&difficulty=4`);
  await page.waitForSelector("text=Voice interview");
  await page.click("text=Start session");
  await passVoiceCheck(page);
  await page.waitForSelector('[data-listening="true"]', { timeout: 60000 });

  await page.evaluate(() => {
    window.__voiceFakeController.simulateError("network drop");
  });
  // Degrades to typing with a visible notice, not a dead screen.
  await page.waitForSelector("textarea", { timeout: 30000 });
  const noticed = await page.evaluate(() => document.body.innerText.includes("Voice dropped"));
  if (!noticed) throw new Error("voice drop degraded silently");

  // The typed answers must be graded WITHOUT the delivery rubric (A11).
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
  await page.waitForSelector("text=Show model answer", { timeout: 60000 });
  const hasDelivery = await page.evaluate(() => document.body.innerText.includes("Delivery"));
  if (hasDelivery) throw new Error("typed-after-degrade answer was delivery-graded");
  await page.click("text=Next question");
  await page.waitForSelector("textarea", { timeout: 60000 });
  await page.click("text=End session early");
  await page.waitForURL("**/debrief", { timeout: 90000 });

  // ---- Speech committed during grading is dropped, not submitted ----
  await page.goto(`${base}/train/new?mode=drill&subtopicId=acct.cascades&difficulty=4`);
  await page.waitForSelector("text=Voice interview");
  await page.click("text=Start session");
  await passVoiceCheck(page);
  await page.waitForSelector('[data-listening="true"]', { timeout: 60000 });
  await say(page, "Net income falls seven fifty, cash rises two fifty, twenty five percent on ten.");
  await page.waitForSelector('[data-listening="true"]', { timeout: 60000 });
  await say(page, "Because the tax shield is two fifty on the ten of depreciation.");
  // Immediately talk over the grading transition — this must be ignored.
  await say(page, "Wait, one more thing about deferred taxes.");
  await page.waitForSelector("text=Show model answer", { timeout: 90000 });
  const sessionId2 = page.url().split("/train/")[1];
  const state = await page.evaluate(async (id) => {
    const res = await fetch(`/api/sessions/${id}`);
    return res.json();
  }, sessionId2);
  const stray = state.questions.some((q) =>
    q.turns.some((t) => t.content.includes("deferred taxes")),
  );
  if (stray) throw new Error("speech during grading was submitted as an answer");
  await page.click("text=Next question");
  await page.waitForSelector('[data-listening="true"]', { timeout: 60000 });
  await page.click("text=End session early");
  await page.waitForURL("**/debrief", { timeout: 90000 });

  // ---- Voice lesson: toggle off mid-lesson, typed continues ----
  await missDrillQuestion(page, base);
  await page.click("text=Learn this properly with the coach");
  await page.waitForSelector("text=walk me through just the first step", { timeout: 60000 });
  await page.click("text=Talk it through");
  await page.waitForSelector("text=Voice on", { timeout: 15000 });
  await say(page, "Pre-tax income falls ten, taxes fall two fifty, net income falls seven fifty.");
  await page.waitForSelector("text=add-back", { timeout: 30000 });
  await page.click("text=Voice on"); // toggle off
  await page.waitForSelector("text=Talk it through", { timeout: 15000 });
  await page.locator("textarea").fill("Typed now: the add-back puts the ten back, cash up two fifty.");
  await page.locator("textarea").press("Enter");
  await page.waitForFunction(() => !document.body.innerText.includes("thinking"), {
    timeout: 30000,
  });

  // ---- Superday round-break reconnect failure degrades to typing ----
  await page.goto(`${base}/train/new?mode=superday`);
  await page.waitForSelector("text=Round plan");
  await page.click("text=Start session");
  await passVoiceCheck(page);
  await page.waitForSelector("text=Round 1/4", { timeout: 60000 });
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    const body = await page.evaluate(() => document.body.innerText).catch(() => "");
    if (body.includes("Round 2 of 4")) break;
    const listening = await page.locator('[data-listening="true"]').isVisible().catch(() => false);
    if (listening) {
      await say(page, "Net income falls seven fifty, cash rises two fifty, on ten at twenty five percent.");
    }
    await page.waitForTimeout(400);
  }
  await page.waitForSelector("text=Round 2 of 4", { timeout: 5000 });
  await page.evaluate(() => {
    window.__voiceFakeFailNextStart = true;
  });
  await page.click("text=start now");
  // Never a control-less screen: the typed answer box takes over.
  await page.waitForSelector("textarea", { timeout: 60000 });
  await page.click("text=End session early");
  await page.waitForURL("**/debrief", { timeout: 120000 });
}

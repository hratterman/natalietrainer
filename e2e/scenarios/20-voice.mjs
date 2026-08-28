/** Voice drill with the trader: voice check, spoken answers, delivery grading, interruption engine. */
import { passVoiceCheck, say } from "../helpers.mjs";

export const name = "voice drill + interruptions";

export async function run({ page, base }) {
  await page.goto(`${base}/train/new?mode=drill&subtopicId=acct.cascades&difficulty=4`);
  await page.waitForSelector("text=Voice interview");
  const toggleOn = await page.evaluate(() =>
    document.body.innerText.includes("Speak your answers out loud"),
  );
  if (!toggleOn) throw new Error("voice toggle not available/enabled");
  // the trader for interruption flavor
  await page.locator("select").nth(1).selectOption("trader");
  await page.click("text=Start session");

  await passVoiceCheck(page);

  // Interviewer speaks the opening, then listens
  await page.waitForSelector('[data-listening="true"]', { timeout: 60000 });

  // Spoken answer → follow-up → spoken answer → wrapup → grade with delivery
  await say(
    page,
    "Net income falls by seven fifty because the ten of extra depreciation is tax deductible at twenty five percent, cash rises two fifty from the tax shield, and the balance sheet ties with P P and E down ten.",
  );
  await page.waitForSelector('[data-listening="true"]', { timeout: 60000 });
  await say(
    page,
    "If it is cash financed you lose the after tax interest income on that cash, roughly three percent after tax.",
  );
  await page.waitForSelector("text=Show model answer", { timeout: 90000 });
  const hasDelivery = await page.evaluate(() => document.body.innerText.includes("Delivery"));
  if (!hasDelivery) throw new Error("delivery rubric bar missing on voice grade");

  // Next question: ramble without numbers → the trader cuts her off
  await page.click("text=Next question");
  await page.waitForSelector('[data-listening="true"]', { timeout: 60000 });
  const ramble =
    "So um the way I think about this is that there are like a lot of moving pieces and you know it really depends on the context of the business and um the accounting treatment which sort of flows through the statements in a few different ways and I mean conceptually speaking the direction of the effects kind of depends on the assumptions we make about the tax treatment and honestly the framework I would use here is to sort of go statement by statement carefully";
  await say(page, ramble, { commit: false });
  await page.waitForSelector("text=cut off", { timeout: 30000 });
  const cutLine = await page.evaluate(() =>
    ["Stop. Number first, story later.", "Too much setup. What's the number?"].some((l) =>
      document.body.innerText.includes(l),
    ),
  );
  if (!cutLine) throw new Error("interjection line not shown");

  // Recovery answer + one follow-up (interjections don't consume the cap)
  await page.waitForSelector('[data-listening="true"]', { timeout: 30000 });
  await say(page, "Sorry — the number is seven fifty lower net income and two fifty higher cash.");
  await page.waitForSelector('[data-listening="true"]', { timeout: 60000 });
  await say(page, "Yes — because the tax shield is two fifty at a twenty five percent rate on ten.");
  await page.waitForSelector("text=Show model answer", { timeout: 90000 });

  // End early → debrief
  await page.click("text=Next question");
  await page.waitForSelector('[data-listening="true"]', { timeout: 60000 });
  await page.click("text=End session early");
  await page.waitForURL("**/debrief", { timeout: 120000 });
}

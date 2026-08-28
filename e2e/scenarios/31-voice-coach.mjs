/** Voice lesson: talk it through with the coach, then pass spoken proofs to resolve. */
import { LONG_ANSWER, missDrillQuestion, say } from "../helpers.mjs";

export const name = "voice coach lesson";

export async function run({ page, base }) {
  await missDrillQuestion(page, base);
  await page.click("text=Learn this properly with the coach");

  // Lesson: coach opens; enable voice.
  await page.waitForSelector("text=walk me through just the first step", { timeout: 60000 });
  await page.click("text=Talk it through");
  await page.waitForSelector("text=Voice on", { timeout: 15000 });
  await page.waitForSelector("text=listening", { timeout: 15000 });

  // Spoken replies to the coach until it offers the check.
  await say(page, "Pre-tax income falls ten, taxes fall two fifty, net income falls seven fifty.");
  await page.waitForSelector("text=add-back", { timeout: 30000 });
  await page.waitForSelector("text=listening", { timeout: 30000 });
  await say(page, "The add back puts the ten back so operating cash is up two fifty.");
  await page.waitForSelector("text=Say the whole chain", { timeout: 30000 });
  await page.waitForSelector("text=listening", { timeout: 30000 });
  await say(page, "Income down seven fifty, add back ten, cash up two fifty, balance sheet ties.");
  await page.waitForSelector("text=Start the check", { timeout: 30000 });

  // Spoken proofs: pass twice → resolved.
  await page.click("text=Start the check");
  await page.waitForSelector("text=Prove it: 0/2", { timeout: 60000 });
  for (let i = 0; i < 8; i++) {
    const listening = await page.locator("text=listening").first().isVisible().catch(() => false);
    if (listening) await say(page, LONG_ANSWER);
    await page.waitForTimeout(700);
    const done = await page.locator("text=Proven — nice work").isVisible().catch(() => false);
    if (done) break;
    const nextBtn = await page.locator("text=Next check question").isVisible().catch(() => false);
    if (nextBtn) await page.click("text=Next check question");
  }
  await page.waitForSelector("text=Proven — nice work", { timeout: 60000 });
}

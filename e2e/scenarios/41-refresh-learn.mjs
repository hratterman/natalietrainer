/**
 * B1 (learn mode): refresh mid-chat keeps the lesson transcript; refresh after
 * a passed proof returns to proving with the pass count intact.
 */
import { answerProof, LONG_ANSWER, missDrillQuestion } from "../helpers.mjs";

export const name = "refresh-resume: learn mode";

export async function run({ page, base }) {
  await missDrillQuestion(page, base);
  await page.click("text=Learn this properly with the coach");
  await page.waitForSelector("text=walk me through just the first step", { timeout: 60000 });

  // One exchange, then refresh mid-chat.
  await page.locator("textarea").fill("Pre-tax income falls ten, taxes fall two fifty.");
  await page.locator("textarea").press("Enter");
  await page.waitForFunction(() => !document.body.innerText.includes("thinking"), {
    timeout: 30000,
  });
  await page.reload();
  await page.waitForSelector("textarea", { timeout: 60000 });
  const kept = await page.evaluate(() =>
    document.body.innerText.includes("Pre-tax income falls ten, taxes fall two fifty."),
  );
  if (!kept) throw new Error("lesson transcript lost on refresh");

  // Two more exchanges to unlock the check.
  for (const msg of [
    "The add-back puts the ten back, so operating cash is up two fifty.",
    "Income down seven fifty, add back ten, cash up two fifty, ties through retained earnings.",
  ]) {
    await page.locator("textarea").fill(msg);
    await page.locator("textarea").press("Enter");
    await page.waitForFunction(() => !document.body.innerText.includes("thinking"), {
      timeout: 30000,
    });
  }
  await page.waitForSelector("text=Start the check", { timeout: 30000 });
  await page.click("text=Start the check");
  await page.waitForSelector("text=Prove it: 0/2", { timeout: 60000 });

  // Pass proof #1, then refresh on the "Next check question" screen.
  await answerProof(page, LONG_ANSWER);
  await page.waitForSelector("text=Next check question", { timeout: 30000 });
  await page.reload();
  // Resume must return to proving with the pass remembered — not the lesson.
  await page.waitForSelector("text=Prove it: 1/2", { timeout: 60000 });
  await answerProof(page, LONG_ANSWER);
  await page.waitForSelector("text=Proven — nice work", { timeout: 60000 });
}

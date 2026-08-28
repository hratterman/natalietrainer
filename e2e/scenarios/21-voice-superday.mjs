/** Voice superday: round 1 spoken, round break, persona switch into round 2. */
import { passVoiceCheck, say } from "../helpers.mjs";

export const name = "voice superday round switch";

export async function run({ page, base }) {
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
      await say(
        page,
        "Net income falls seven fifty, cash rises two fifty, at a twenty five percent rate on ten.",
      );
    }
    await page.waitForTimeout(400);
  }
  await page.waitForSelector("text=Round 2 of 4", { timeout: 5000 });
  await page.click("text=start now");
  await page.waitForSelector('[data-listening="true"]', { timeout: 60000 });
  const header = await page.evaluate(() => document.body.innerText);
  if (!header.includes("Round 2/4")) throw new Error("round 2 header missing");
  if (!/with The (Quant|Trader|Skeptic|Grinder|Stone|Rambly|Friendly)/.test(header)) {
    throw new Error("persona name missing in round 2 header");
  }
}

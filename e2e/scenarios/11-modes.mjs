/** Typed mock, rapid, and superday happy paths through to their debriefs. */
import { driveToDebrief, setVoiceToggle } from "../helpers.mjs";

export const name = "modes (mock/rapid/superday)";

export async function run({ page, base }) {
  // ---------- MOCK ----------
  await page.goto(`${base}/train/new?mode=mock`);
  await page.waitForSelector("text=Areas in scope");
  await setVoiceToggle(page, false);
  await page.locator('input[type="number"]').first().fill("2");
  await page.click("text=Start session");
  await page.waitForSelector("text=Mock interview", { timeout: 60000 });
  await driveToDebrief(page, "Mock answer");
  await page.waitForSelector("text=Session debrief");

  // ---------- RAPID (no voice toggle — rapid stays typed) ----------
  await page.goto(`${base}/train/new?mode=rapid`);
  await page.waitForSelector("text=Seconds per question");
  await page.locator('input[type="number"]').first().fill("4");
  await page.click("text=Start session");
  await page.waitForSelector("text=Rapid fire", { timeout: 60000 });
  await driveToDebrief(page, "42%");

  // ---------- SUPERDAY: round 1 → round break → round 2 → end early ----------
  await page.goto(`${base}/train/new?mode=superday`);
  await page.waitForSelector("text=Round plan");
  await setVoiceToggle(page, false);
  await page.click("text=Start session");
  await page.waitForSelector("text=Round 1/4", { timeout: 60000 });
  const sd = await driveToDebrief(page, "Superday answer", { stopAtText: "Round 2 of 4" });
  if (sd !== "stopped") throw new Error("expected to hit the round break");
  await page.click("text=start now");
  await page.waitForSelector("text=Round 2/4", { timeout: 60000 });
  await page.waitForSelector("textarea");
  await page.click("text=End session early");
  await page.waitForURL("**/debrief", { timeout: 120000 });
}

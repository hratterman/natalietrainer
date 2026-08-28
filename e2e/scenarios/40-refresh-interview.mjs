/**
 * B1 (interview modes): refreshing at any point must resume cleanly —
 * drill review screens, mid-transcript, rapid mid-batch, superday round 2.
 */
import { driveToDebrief, LONG_ANSWER, setVoiceToggle } from "../helpers.mjs";

export const name = "refresh-resume: interview modes";

async function answerOnce(page, text) {
  await page.waitForSelector("textarea", { timeout: 60000 });
  await page.locator("textarea").first().fill(text);
  await page.click("text=Submit answer");
}

async function answerToGrade(page, text) {
  for (let i = 0; i < 3; i++) {
    await answerOnce(page, text);
    await Promise.race([
      page.waitForSelector("text=Show model answer", { timeout: 90000 }),
      page.waitForSelector("textarea", { timeout: 90000 }),
    ]);
    if (await page.locator("text=Show model answer").isVisible().catch(() => false)) return;
  }
  throw new Error("question never graded");
}

export async function run({ page, base }) {
  // ---- Drill: refresh on the review screen must auto-advance (A1) ----
  await page.goto(`${base}/train/new?mode=drill&subtopicId=acct.cascades&difficulty=4`);
  await page.waitForSelector("text=Subtopics to drill");
  await setVoiceToggle(page, false);
  await page.locator('input[type="number"]').first().fill("3");
  await page.click("text=Start session");
  await answerToGrade(page, LONG_ANSWER);

  await page.reload();
  // Not an eternal spinner: the next question appears.
  await page.waitForSelector("textarea", { timeout: 60000 });
  if (await page.locator("text=Preparing your debrief").isVisible().catch(() => false)) {
    throw new Error("stuck on the debrief spinner after review refresh");
  }

  // ---- Mid-transcript refresh: the follow-up survives ----
  await answerOnce(page, "First pass at question two.");
  await page.waitForSelector("text=Interviewer", { timeout: 60000 });
  await page.waitForSelector("textarea", { timeout: 60000 });
  await page.reload();
  await page.waitForSelector("textarea", { timeout: 60000 });
  const transcriptSurvived = await page.evaluate(() =>
    document.body.innerText.includes("First pass at question two."),
  );
  if (!transcriptSurvived) throw new Error("candidate turn lost on refresh");
  await answerToGrade(page, LONG_ANSWER);
  await page.click("text=Next question");
  await page.waitForSelector("textarea", { timeout: 60000 });
  await page.click("text=End session early");
  await page.waitForURL("**/debrief", { timeout: 90000 });
  // Refreshing the debrief stays on the debrief.
  await page.reload();
  await page.waitForSelector("text=Session debrief");

  // ---- Rapid: refresh mid-batch continues at the current question ----
  await page.goto(`${base}/train/new?mode=rapid`);
  await page.waitForSelector("text=Seconds per question");
  await page.locator('input[type="number"]').first().fill("4");
  await page.locator('input[type="number"]').nth(1).fill("600");
  await page.click("text=Start session");
  await page.waitForSelector("text=Rapid fire", { timeout: 60000 });
  for (let i = 0; i < 2; i++) {
    await page.waitForSelector("textarea", { timeout: 60000 });
    await page.locator("textarea").fill("42%");
    await page.locator("textarea").press("Enter");
    await page.waitForTimeout(400);
  }
  await page.reload();
  await page.waitForSelector("text=Rapid fire", { timeout: 60000 });
  await page.waitForSelector("textarea", { timeout: 60000 });
  const counter = await page.evaluate(() => document.body.innerText.match(/Question (\d)\/4/)?.[1]);
  if (counter !== "3") throw new Error(`rapid resumed at question ${counter}, expected 3`);
  await page.click("text=End session early");
  await page.waitForURL("**/debrief", { timeout: 90000 });

  // ---- Superday: refresh in round 2 keeps the round header (A3) ----
  await page.goto(`${base}/train/new?mode=superday`);
  await page.waitForSelector("text=Round plan");
  await setVoiceToggle(page, false);
  await page.click("text=Start session");
  await page.waitForSelector("text=Round 1/4", { timeout: 60000 });
  const sd = await driveToDebrief(page, "Superday answer", { stopAtText: "Round 2 of 4" });
  if (sd !== "stopped") throw new Error("expected the round break");
  await page.click("text=start now");
  await page.waitForSelector("text=Round 2/4", { timeout: 60000 });
  await answerOnce(page, "Round two answer before the refresh.");
  await page.waitForSelector("text=Interviewer", { timeout: 60000 });

  await page.reload();
  await page.waitForSelector("textarea", { timeout: 60000 });
  const header = await page.evaluate(() => document.body.innerText);
  if (!header.includes("Round 2/4")) {
    throw new Error("superday refresh fell back to the wrong round header");
  }
  if (header.includes("Round 1/4")) throw new Error("superday refresh reset to round 1");
  await page.click("text=End session early");
  await page.waitForURL("**/debrief", { timeout: 120000 });
}

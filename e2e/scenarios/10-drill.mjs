/** Typed topic drill: setup → answer → follow-up → grade review → next → end early → debrief. */
import { setVoiceToggle } from "../helpers.mjs";

export const name = "drill";

export async function run({ page, base }) {
  await page.goto(base);
  await page.waitForSelector("text=Mastery map");

  await page.goto(`${base}/train/new?mode=drill&subtopicId=acct.cascades&difficulty=4`);
  await page.waitForSelector("text=Subtopics to drill");
  const checked = await page.locator('input[type="checkbox"]:checked').count();
  if (checked !== 1) throw new Error(`expected 1 prefilled subtopic, saw ${checked}`);
  await setVoiceToggle(page, false);
  await page.click("text=Start session");

  await page.waitForSelector("text=Topic drill", { timeout: 60000 });
  await page.waitForSelector("textarea");

  // Scratchpad + first answer
  await page.click("text=scratchpad (arithmetic");
  await page.locator("textarea").nth(1).fill("10 * 0.75 = 7.5");
  await page
    .locator("textarea")
    .first()
    .fill(
      "Start on the income statement: pre-tax income falls $10, taxes fall $2.50, so net income falls $7.50. On the cash flow statement the $10 is added back, so cash rises $2.50. Balance sheet: PP&E down $10, cash up $2.50, retained earnings down $7.50 — balanced.",
    );
  await page.click("text=Submit answer");

  // Follow-up streams in (drill cap = 1), answer it → wrapup → grade review
  await page.waitForSelector("text=Interviewer", { timeout: 60000 });
  await page.waitForSelector("textarea");
  await page
    .locator("textarea")
    .first()
    .fill("If it's cash financed, you lose the after-tax interest income on the cash instead.");
  await page.click("text=Submit answer");
  await page.waitForSelector("text=Show model answer", { timeout: 90000 });
  await page.click("text=Next question");

  // Second question — answer + follow-up
  await page.waitForSelector("textarea", { timeout: 60000 });
  await page.locator("textarea").first().fill("Second answer: walking all three statements again.");
  await page.click("text=Submit answer");
  await page.waitForSelector("text=Interviewer", { timeout: 60000 });
  await page.waitForSelector("textarea");
  await page.locator("textarea").first().fill("Follow-up answer.");
  await page.click("text=Submit answer");
  await page.waitForSelector("text=Show model answer", { timeout: 90000 });
  await page.click("text=Next question");

  // Third question — end early to trigger the debrief
  await page.waitForSelector("textarea", { timeout: 60000 });
  await page.click("text=End session early");
  await page.waitForURL("**/debrief", { timeout: 90000 });
  await page.waitForSelector("text=Session debrief");

  // Dashboard now shows mastery
  await page.goto(base);
  await page.waitForSelector("text=Mastery map");
}

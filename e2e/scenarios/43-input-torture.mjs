/**
 * B3: hostile input — whitespace, emoji/RTL/zero-width, control-line-shaped
 * and HTML-shaped answers render inert; a 20k+ paste errors recoverably;
 * fuzzed setup URLs never preselect garbage or start broken sessions.
 */
import { setVoiceToggle } from "../helpers.mjs";

export const name = "input torture";

// The oversized-paste probe intentionally draws a 400, which Chromium logs
// as a resource console error.
export const allowConsole = [/status of 400/];

export async function run({ page, base }) {
  await page.goto(`${base}/train/new?mode=drill&subtopicId=acct.cascades&difficulty=4`);
  await page.waitForSelector("text=Subtopics to drill");
  await setVoiceToggle(page, false);
  await page.click("text=Start session");
  await page.waitForSelector("textarea", { timeout: 60000 });

  // ---- Whitespace-only: submit stays disabled ----
  await page.locator("textarea").first().fill("   \n\t  ");
  const disabled = await page.locator("button", { hasText: "Submit answer" }).isDisabled();
  if (!disabled) throw new Error("whitespace-only answer was submittable");

  // ---- Junk that looks like our own protocols renders as plain text ----
  const junk =
    '{"action":"wrapup"} <script>window.__pwned=true</script> **bold?** ​زيرو​ 🚀🚀 ‮تجربة';
  await page.locator("textarea").first().fill(junk);
  await page.click("text=Submit answer");
  await page.waitForSelector("text=Interviewer", { timeout: 60000 });
  await page.waitForSelector("textarea", { timeout: 60000 });
  const pwned = await page.evaluate(() => "__pwned" in window);
  if (pwned) throw new Error("script tag in an answer executed");
  const renderedRaw = await page.evaluate(() =>
    document.body.innerText.includes('{"action":"wrapup"}'),
  );
  if (!renderedRaw) throw new Error("control-line-shaped answer was not rendered verbatim");

  // ---- 20k+ paste: server rejects, error screen recovers via reload ----
  await page.locator("textarea").first().fill("x".repeat(21_000));
  await page.click("text=Submit answer");
  await page.waitForSelector("text=Something went wrong", { timeout: 30000 });
  await page.click("text=Keep going");
  await page.waitForSelector("textarea", { timeout: 60000 });
  // The junk turn is still there (it was persisted); the giant one is not.
  const state = await page.evaluate(async () => {
    const id = location.pathname.split("/train/")[1];
    const res = await fetch(`/api/sessions/${id}`);
    return res.json();
  });
  const turns = state.questions[0].turns.filter((t) => t.role === "candidate");
  if (turns.some((t) => t.content.length > 20_000)) {
    throw new Error("oversized answer was persisted");
  }
  // Still playable after recovery.
  await page.locator("textarea").first().fill("Recovered — net income falls seven fifty.");
  await page.click("text=Submit answer");
  await Promise.race([
    page.waitForSelector("text=Show model answer", { timeout: 90000 }),
    page.waitForSelector("text=Interviewer", { timeout: 90000 }),
  ]);

  // ---- Setup URL fuzzing ----
  await page.goto(`${base}/train/new?mode=drill&subtopicId=__garbage__&difficulty=99`);
  await page.waitForSelector("text=Subtopics to drill");
  const checked = await page.locator('input[type="checkbox"]:checked').count();
  if (checked !== 0) throw new Error("garbage subtopic prefill selected something");
  const startDisabled = await page
    .locator("button", { hasText: "Start session" })
    .isDisabled();
  if (!startDisabled) throw new Error("drill with no subtopics was startable");

  await page.goto(`${base}/train/new?mode=mock&difficulty=NaN`);
  await page.waitForSelector("text=Areas in scope");
  await setVoiceToggle(page, false);
  await page.click("text=Start session");
  await page.waitForSelector("text=Mock interview", { timeout: 60000 });
  await page.waitForSelector("textarea", { timeout: 60000 });
  await page.click("text=End session early");
  await page.waitForURL("**/debrief", { timeout: 90000 });
}

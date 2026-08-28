/**
 * Shared helpers for the browser E2E suite (run via `npm run e2e`).
 *
 * The suite runs against a server booted with LLM_MOCK=1 VOICE_FAKE=1, so the
 * voice toggle defaults ON in setup — typed scenarios switch it off through
 * the UI, exactly as a user would.
 */
import fs from "node:fs";

export const SHORT_ANSWER = "It goes down I think."; // < 70 under the mock → miss
export const LONG_ANSWER =
  "Start on the income statement: pre-tax income falls ten dollars, taxes fall two fifty at the twenty five percent rate, so net income falls seven fifty. On the cash flow statement net income is down seven fifty but the ten dollars is added back as a non-cash charge, so operating cash rises two fifty. On the balance sheet cash is up two fifty, PP&E is down ten, and retained earnings absorbs the seven fifty drop, so both sides tie. Net change in cash is positive two fifty because the tax shield exceeds nothing else in the walk.";

/** Load playwright from the project if installed, else from a global install. */
export async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    /* fall through to known global locations */
  }
  for (const candidate of [
    "/opt/node22/lib/node_modules/playwright/index.mjs",
    "/usr/lib/node_modules/playwright/index.mjs",
  ]) {
    if (fs.existsSync(candidate)) return await import(candidate);
  }
  throw new Error(
    "playwright not found — `npm i -D playwright` (or install it globally) to run the E2E suite",
  );
}

/** Chromium launch options that work with or without a downloaded browser. */
export function chromiumLaunchOptions() {
  const explicit = process.env.CHROMIUM_PATH;
  if (explicit) return { executablePath: explicit };
  if (fs.existsSync("/opt/pw-browsers/chromium")) {
    return { executablePath: "/opt/pw-browsers/chromium" };
  }
  return {};
}

/** Flip the setup form's voice toggle to the desired state (it defaults ON when voice is available). */
export async function setVoiceToggle(page, on) {
  const toggle = page.locator("[data-voice-on]");
  await toggle.waitFor();
  const current = (await toggle.getAttribute("data-voice-on")) === "true";
  if (current !== on) await toggle.click();
}

/** Speak an utterance through the fake voice transport (VOICE_FAKE=1). */
export async function say(page, text, { commit = true } = {}) {
  await page.evaluate(
    async ({ t, c }) => {
      await window.__voiceFakeController.simulateUtterance(t, { commit: c });
    },
    { t: text, c: commit },
  );
}

/** Pass the voice check screen: enable mic, confirm captions, start. */
export async function passVoiceCheck(page) {
  await page.waitForSelector("text=Voice check", { timeout: 30000 });
  await page.click("text=Enable microphone");
  await page.waitForSelector("text=Say something");
  await say(page, "Testing one two three");
  await page.waitForSelector("text=Mic and captions working");
  await page.click("text=Start the interview");
}

/** Keep answering whatever question is on screen until the session reaches the debrief. */
export async function driveToDebrief(page, label, { stopAtText = null, deadlineMs = 240000 } = {}) {
  const deadline = Date.now() + deadlineMs;
  let turn = 0;
  while (Date.now() < deadline) {
    if (page.url().includes("/debrief")) return "debrief";
    const body = await page.evaluate(() => document.body.innerText).catch(() => "");
    if (stopAtText && body.includes(stopAtText)) return "stopped";
    const box = page.locator("textarea").first();
    if (await box.isVisible().catch(() => false)) {
      turn += 1;
      await box.fill(`${label} — statement walk, numbers included (turn ${turn})`);
      const submit = page.locator("text=Submit answer");
      if (await submit.isVisible().catch(() => false)) await submit.click();
      else await box.press("Enter");
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`driveToDebrief timed out for ${label}`);
}

/** Answer a learn-mode proof/spot-check question until the grade card shows (learn allows 1 follow-up). */
export async function answerProof(page, text) {
  for (let i = 0; i < 3; i++) {
    await page.waitForSelector("textarea", { timeout: 60000 });
    await page.locator("textarea").fill(text);
    await page.click("text=Submit answer");
    await Promise.race([
      page.waitForSelector("text=Show model answer", { timeout: 90000 }),
      page.waitForSelector("textarea", { timeout: 90000 }),
    ]);
    if (await page.locator("text=Show model answer").isVisible().catch(() => false)) return;
  }
  throw new Error("proof never graded");
}

/**
 * Miss a typed drill question on purpose (voice toggled off), landing on the
 * grade card with its "Learn this properly with the coach" link.
 */
export async function missDrillQuestion(page, base) {
  await page.goto(`${base}/train/new?mode=drill&subtopicId=acct.cascades&difficulty=4`);
  await page.waitForSelector("text=Subtopics to drill");
  await setVoiceToggle(page, false);
  await page.click("text=Start session");
  for (let i = 0; i < 2; i++) {
    await page.waitForSelector("textarea", { timeout: 60000 });
    await page.locator("textarea").first().fill(SHORT_ANSWER);
    await page.click("text=Submit answer");
    const graded = await Promise.race([
      page.waitForSelector("text=Show model answer", { timeout: 90000 }).then(() => true),
      page.waitForSelector("textarea", { timeout: 90000 }).then(() => false),
    ]);
    if (graded) break;
  }
  await page.waitForSelector("text=Learn this properly with the coach", { timeout: 60000 });
}

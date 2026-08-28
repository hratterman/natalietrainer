/**
 * B5: learn-mode state machine — resolved status card, early spot-check pass
 * keeps the spaced schedule, and a full second relearn cycle works after a
 * new miss on the same material.
 */
import { answerProof, LONG_ANSWER, missDrillQuestion } from "../helpers.mjs";

export const name = "learn state machine + early policy";

async function resolveViaUi(page) {
  await page.waitForSelector("text=walk me through just the first step", { timeout: 60000 });
  for (const msg of [
    "Pre-tax income falls ten, taxes fall two fifty, net income falls seven fifty.",
    "The add-back puts the ten back, so operating cash is up two fifty.",
    "Income down seven fifty, add back ten, cash up two fifty, ties.",
  ]) {
    await page.locator("textarea").fill(msg);
    await page.locator("textarea").press("Enter");
    await page.waitForFunction(() => !document.body.innerText.includes("thinking"), {
      timeout: 30000,
    });
  }
  await page.click("text=Start the check");
  await page.waitForSelector("text=Prove it:", { timeout: 60000 });
  for (let i = 0; i < 2; i++) {
    await answerProof(page, LONG_ANSWER);
    const done = await page.locator("text=Proven — nice work").isVisible().catch(() => false);
    if (done) return;
    await page.click("text=Next check question");
  }
  await page.waitForSelector("text=Proven — nice work", { timeout: 60000 });
}

export async function run({ page, base }) {
  // Cycle 1: miss → lesson → resolved.
  await missDrillQuestion(page, base);
  await page.click("text=Learn this properly with the coach");
  await page.waitForURL("**/learn/**", { timeout: 30000 });
  const fixitId = page.url().split("/learn/")[1].split("?")[0];
  await resolveViaUi(page);

  // Resolved-but-not-due state card offers the early spot-check.
  await page.goto(`${base}/learn/${fixitId}`);
  await page.waitForSelector("text=Spot-check me now", { timeout: 30000 });

  // Early spot-check PASS keeps the schedule (checkStage stays 0).
  await page.click("text=Spot-check me now");
  await page.waitForSelector("text=Spot-check — one question, cold.", { timeout: 60000 });
  await answerProof(page, LONG_ANSWER);
  await page.waitForSelector("text=Spot-check passed", { timeout: 60000 });
  const fixit = await page.evaluate(async (id) => {
    const res = await fetch(`/api/fixits/${id}`);
    return (await res.json()).fixit;
  }, fixitId);
  if (fixit.status !== "resolved") throw new Error(`fixit is ${fixit.status}, expected resolved`);
  if (fixit.checkStage !== 0) {
    throw new Error(`early pass advanced checkStage to ${fixit.checkStage}`);
  }
  if (!fixit.nextCheckAt) throw new Error("early pass cleared the schedule");

  // Cycle 2: a fresh miss on the same material starts a clean second lesson.
  await missDrillQuestion(page, base);
  await page.click("text=Learn this properly with the coach");
  await resolveViaUi(page);
}

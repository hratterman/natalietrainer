/** Full learn loop: miss → fix-it queue → coach → fail a proof → pass twice → spot-check fail reopens. */
import { answerProof, LONG_ANSWER, missDrillQuestion, SHORT_ANSWER } from "../helpers.mjs";

export const name = "learn loop + spot-check reopen";

export async function run({ page, base }) {
  // 1. Miss a drill question deliberately (typed).
  await missDrillQuestion(page, base);

  // 2. Dashboard shows the fix-it queue.
  await page.goto(base);
  await page.waitForSelector("text=Fix-it queue");
  await page.waitForSelector("text=balance check tie-out"); // mock missedConcept
  await page.getByRole("link", { name: "Learn", exact: true }).first().click();

  // 3. Coach chat: opening → 3 replies → check CTA (mock coach signals on the 3rd).
  await page.waitForSelector("text=Coach", { timeout: 60000 });
  await page.waitForSelector("text=walk me through just the first step", { timeout: 30000 });
  for (const msg of [
    "Pre-tax income falls ten, taxes fall two fifty, net income falls seven fifty.",
    "The add-back puts the ten back, so operating cash is up two fifty.",
    "Income down seven fifty, add back ten, cash up two fifty, balance sheet ties through retained earnings.",
  ]) {
    await page.locator("textarea").fill(msg);
    await page.locator("textarea").press("Enter");
    await page.waitForFunction(() => !document.body.innerText.includes("thinking"), {
      timeout: 30000,
    });
  }
  await page.waitForSelector("text=Start the check", { timeout: 30000 });

  // 4. Prove it: fail once → back to lesson → pass twice → resolved.
  await page.click("text=Start the check");
  await page.waitForSelector("text=Prove it: 0/2", { timeout: 60000 });
  await answerProof(page, SHORT_ANSWER); // fail
  await page.waitForSelector("text=Back to the lesson");
  await page.click("text=Back to the lesson");
  await page.waitForSelector("text=Check missed", { timeout: 15000 });

  await page.click("text=I'm ready — test me");
  await page.waitForSelector("text=Prove it:", { timeout: 60000 });
  for (let i = 0; i < 2; i++) {
    await answerProof(page, LONG_ANSWER); // pass
    const resolved = await page.locator("text=Proven — nice work").isVisible().catch(() => false);
    if (resolved) break;
    await page.click("text=Next check question");
  }
  await page.waitForSelector("text=Proven — nice work", { timeout: 60000 });

  // 5. Early spot-check, failed → reopens with the miss as the new anchor.
  const fixits = await page.evaluate(async (b) => {
    const res = await fetch(`${b}/api/fixits`);
    return res.json();
  }, base);
  const fixitId = fixits.pending[0]?.id ?? fixits.due[0]?.id;
  if (!fixitId) throw new Error("no pending fixit to spot-check");
  await page.goto(`${base}/learn/${fixitId}?early=1`);
  await page.waitForSelector("text=Spot-check — one question, cold.", { timeout: 60000 });
  await answerProof(page, SHORT_ANSWER); // fail the spot-check
  await page.waitForSelector("text=back in your queue", { timeout: 60000 });

  // Queue shows it open again.
  await page.goto(base);
  await page.waitForSelector("text=Fix-it queue");
  await page.waitForSelector("text=× missed");
}

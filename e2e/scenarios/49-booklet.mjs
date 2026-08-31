/**
 * B6: booklet memorization loop — pacing settings persist, the daily queue
 * runs right/wrong/reveal paths with in-session requeue of misses, the
 * session summary lands, and the reference canon renders. Runs against the
 * checked-in fixture canon (BOOKLET_FIXTURE=1).
 */
import { LONG_ANSWER } from "../helpers.mjs";

export const name = "booklet queue + pacing + reference";

// The deliberate fit-item API probe below 404s, which Chromium logs.
export const allowConsole = [/status of 404/];

async function submitAndAdvance(page, text) {
  await page.fill('[data-testid="booklet-answer"]', text);
  await page.getByRole("button", { name: "Submit answer" }).click();
  await page.waitForSelector("text=Canonical answer", { timeout: 30000 });
}

async function clickNext(page) {
  await page.getByRole("button", { name: /Next question|Finish session/ }).click();
}

export async function run({ page, base }) {
  // --- Overview + pacing settings ---
  await page.goto(`${base}/booklet`);
  await page.waitForSelector("text=Today's plan");
  await page.waitForSelector("text=Cold coverage");

  const superday = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
  await page.fill('[data-testid="superday-date"]', superday);
  await page.getByRole("button", { name: "Save pacing" }).click();
  await page.waitForSelector("text=Saved");

  await page.reload();
  await page.waitForSelector("text=Today's plan");
  const persisted = await page.inputValue('[data-testid="superday-date"]');
  if (persisted !== superday) {
    throw new Error(`superday date did not persist: ${persisted} != ${superday}`);
  }

  // --- The session loop ---
  await page.click("text=Start today's session");
  await page.waitForURL("**/booklet/session", { timeout: 15000 });
  await page.waitForSelector('[data-testid="booklet-answer"]', { timeout: 15000 });

  // Q1 right: long answer → good verdict + canonical answer + no requeue tag.
  await submitAndAdvance(page, LONG_ANSWER);
  await page.waitForSelector("text=Nailed it");
  if (await page.locator("text=comes back this session").isVisible().catch(() => false)) {
    throw new Error("right answer was requeued");
  }
  await clickNext(page);

  // Q2 wrong: short answer → miss verdict + requeued for this session.
  await page.waitForSelector('[data-testid="booklet-answer"]');
  await submitAndAdvance(page, "no idea");
  await page.waitForSelector("text=Not yet");
  await page.waitForSelector("text=comes back this session");
  await clickNext(page);

  // Q3 reveal: counts as a miss and still shows the canon.
  await page.waitForSelector('[data-testid="booklet-answer"]');
  await page.getByRole("button", { name: /Show the answer/ }).click();
  await page.waitForSelector("text=Not yet");
  await page.waitForSelector("text=Canonical answer");
  await clickNext(page);

  // Everything else (requeues included) answered right until the summary.
  for (let i = 0; i < 30; i++) {
    if (await page.locator("text=Session done").isVisible().catch(() => false)) break;
    await page.waitForSelector('[data-testid="booklet-answer"]', { timeout: 15000 });
    await submitAndAdvance(page, LONG_ANSWER);
    await clickNext(page);
  }
  await page.waitForSelector("text=Session done", { timeout: 15000 });
  await page.waitForSelector("text=missed");

  // --- Overview reflects the work ---
  await page.click("text=Back to the Booklet");
  await page.waitForURL("**/booklet", { timeout: 15000 });
  await page.waitForSelector("text=answers in already today");

  // --- Reference canon ---
  await page.click("text=Browse the full canon");
  await page.waitForSelector("text=Technical canon — drilled to cold");
  await page.waitForSelector("text=personalize, don't memorize");
  await page.locator("details").first().click();
  await page.waitForSelector("text=Why can a profitable company still run out of cash?");

  // --- Fit items are reference-only: the grading API refuses them ---
  const status = await page.evaluate(async () => {
    const res = await fetch("/api/booklet/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: "why-banking-01", answer: "attempt" }),
    });
    return res.status;
  });
  if (status !== 404) {
    throw new Error(`fit-deck item should be ungradable, got HTTP ${status}`);
  }
}

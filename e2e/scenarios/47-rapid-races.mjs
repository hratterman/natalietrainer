/**
 * B7: rapid-fire timer races — instant submits, Enter mashing, buzzer
 * expiries, and an all-expired tail must all flow into one clean debrief
 * without the error screen.
 */
export const name = "rapid timer races";

export async function run({ page, base }) {
  await page.goto(`${base}/train/new?mode=rapid`);
  await page.waitForSelector("text=Seconds per question");
  await page.locator('input[type="number"]').first().fill("4"); // questions
  await page.locator('input[type="number"]').nth(1).fill("10"); // min timer
  await page.click("text=Start session");
  await page.waitForSelector("text=Rapid fire", { timeout: 60000 });

  const assertAlive = async () => {
    if (await page.locator("text=Something went wrong").isVisible().catch(() => false)) {
      throw new Error("rapid session hit the error screen");
    }
  };

  // Q1: type and mash Enter repeatedly in one tick.
  await page.waitForSelector("textarea", { timeout: 60000 });
  await page.locator("textarea").fill("42%");
  await page.evaluate(() => {
    const box = document.querySelector("textarea");
    for (let i = 0; i < 3; i++) {
      box.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    }
  });
  await page.waitForTimeout(1500);
  await assertAlive();

  // Q2: type something but let the buzzer submit it.
  await page.waitForSelector("textarea", { timeout: 60000 });
  await page.locator("textarea").fill("half-typed thought");
  await page.waitForTimeout(11_000);
  await assertAlive();

  // Q3: submit right around the buzzer (~10s mark).
  await page.waitForSelector("textarea", { timeout: 60000 });
  await page.waitForTimeout(9_300);
  await page.locator("textarea").fill("buzzer beater");
  await page.locator("textarea").press("Enter").catch(() => {});
  await page.waitForTimeout(2_000);
  await assertAlive();

  // Q4: fully expire, untouched → the session self-completes.
  await page.waitForURL("**/debrief", { timeout: 120_000 });

  // The whole batch persisted exactly four questions, all resolved.
  const sessionId = page.url().split("/train/")[1].split("/")[0];
  const state = await page.evaluate(async (id) => {
    const res = await fetch(`/api/sessions/${id}`);
    return res.json();
  }, sessionId);
  if (state.questions.length !== 4) {
    throw new Error(`expected 4 questions, saw ${state.questions.length}`);
  }
  const unresolved = state.questions.filter(
    (q) => q.status !== "graded" && q.status !== "skipped",
  );
  if (unresolved.length > 0) {
    throw new Error(`questions left ${unresolved.map((q) => q.status).join(",")}`);
  }
}

/**
 * The un-seeded path a first-time user actually walks: the PIN gate (redirect,
 * API 401, wrong PIN, right PIN with a return target), the welcome card, the
 * full spotlight tour, its persistence, the relaunch button, and locking.
 */
export const name = "login gate + onboarding tour";
export const noAuth = true;
// The gate's own 401s (unauthenticated /api probe, wrong PIN) are the point.
export const allowConsole = [/status of 401/];

export async function run({ page, base }) {
  // Deep link without a cookie → login with a return target.
  await page.goto(`${base}/history`);
  await page.waitForURL("**/login?from=%2Fhistory");

  // API without a cookie → 401 JSON, not a redirect.
  const status = await page.evaluate(async () => (await fetch("/api/progress")).status);
  if (status !== 401) throw new Error(`expected 401 from /api, got ${status}`);

  // Wrong PIN via the keypad → inline error, digits cleared.
  for (const d of ["9", "9", "9", "9"]) await page.click(`[data-key="${d}"]`);
  await page.waitForSelector("text=Wrong PIN");

  // Right PIN via the keyboard → lands on the deep-link target.
  await page.keyboard.type("1234");
  await page.waitForURL("**/history", { timeout: 30000 });
  await page.waitForSelector("text=Session history");

  // First dashboard visit → welcome card → full tour.
  await page.goto(base);
  await page.waitForSelector("text=Welcome, Natalie");
  await page.click("text=Show me around");
  await page.waitForSelector("text=Step 1 of");
  for (let i = 0; i < 8; i++) {
    const doneBtn = page.getByRole("button", { name: "Done", exact: true });
    if (await doneBtn.isVisible().catch(() => false)) {
      await doneBtn.click();
      break;
    }
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(250);
  }
  if (await page.locator('[role="dialog"]').isVisible().catch(() => false)) {
    throw new Error("tour never finished");
  }

  // The done-cookie sticks: reload shows no welcome card.
  await page.reload();
  await page.waitForSelector("text=Mastery map");
  if (await page.locator("text=Welcome, Natalie").isVisible().catch(() => false)) {
    throw new Error("welcome card reappeared after the tour");
  }

  // Relaunch on demand, then bail out via Skip.
  await page.getByRole("button", { name: "Tour" }).click();
  await page.waitForSelector("text=Step 1 of");
  await page.getByRole("button", { name: "Skip", exact: true }).click();

  // Lock → gated again, everywhere.
  await page.click("[data-testid=lock]");
  await page.waitForURL("**/login**");
  await page.goto(base);
  await page.waitForURL("**/login**");
}

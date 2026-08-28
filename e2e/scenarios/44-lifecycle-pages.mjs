/**
 * B4: lifecycle + page dispatch — zero-answer sessions get a real debrief,
 * completed sessions redirect, learn sessions stay out of /train, /history,
 * and the dashboard resume banner.
 */
import { missDrillQuestion, setVoiceToggle } from "../helpers.mjs";

export const name = "lifecycle + page dispatch";

export async function run({ page, base }) {
  // ---- End early with zero answers → static debrief, no crash ----
  await page.goto(`${base}/train/new?mode=mock`);
  await page.waitForSelector("text=Areas in scope");
  await setVoiceToggle(page, false);
  await page.click("text=Start session");
  await page.waitForSelector("textarea", { timeout: 60000 });
  const zeroSessionId = page.url().split("/train/")[1];
  await page.click("text=End session early");
  await page.waitForURL("**/debrief", { timeout: 90000 });
  await page.waitForSelector("text=Session debrief");

  // ---- /train/<completed> redirects to its debrief ----
  await page.goto(`${base}/train/${zeroSessionId}`);
  await page.waitForURL("**/debrief", { timeout: 30000 });

  // ---- A learn session under /train redirects to its fix-it lesson ----
  await missDrillQuestion(page, base);
  await page.click("text=Learn this properly with the coach");
  await page.waitForSelector("text=walk me through just the first step", { timeout: 60000 });
  const fixitUrl = page.url();
  const learnState = await page.evaluate(async () => {
    const res = await fetch("/api/fixits");
    return res.json();
  });
  const openFixit = learnState.open[0];
  if (!openFixit) throw new Error("no open fixit after the miss");

  // Find the lesson session id via the sessions the dashboard would see.
  const lessonSessionId = await page.evaluate(async (fixitId) => {
    const res = await fetch(`/api/fixits/${fixitId}/lesson`, { method: "POST" });
    const body = await res.json();
    return body.sessionId;
  }, openFixit.id);
  await page.goto(`${base}/train/${lessonSessionId}`);
  await page.waitForURL("**/learn/**", { timeout: 30000 });

  // ---- Its debrief URL also bounces to the lesson ----
  await page.goto(`${base}/train/${lessonSessionId}/debrief`);
  await page.waitForURL("**/learn/**", { timeout: 30000 });

  // ---- Dashboard: active lesson never hijacks the resume banner ----
  await page.goto(base);
  await page.waitForSelector("text=Mastery map");
  const bannerText = await page.evaluate(() => document.body.innerText);
  if (bannerText.includes("unfinished learn session")) {
    throw new Error("resume banner offered a learn session");
  }

  // ---- History: lesson sessions are not listed ----
  await page.goto(`${base}/history`);
  await page.waitForSelector("text=Session history");
  const learnRows = await page.getByText("learn", { exact: true }).count();
  if (learnRows > 0) throw new Error("history lists learn sessions");

  // Sanity: the lesson is still reachable and alive afterwards.
  await page.goto(fixitUrl);
  await page.waitForSelector("textarea", { timeout: 60000 });
}

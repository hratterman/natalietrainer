/**
 * Design-QA screenshot walk: boots the app exactly like the e2e runner
 * (fresh throwaway DB, LLM_MOCK + VOICE_FAKE + APP_PIN) and captures every
 * major screen/state to e2e/.artifacts/shots/. Usage:
 *   node scripts/screenshots.mjs [--width=1280]
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chromiumLaunchOptions,
  defaultCookies,
  loadPlaywright,
  LONG_ANSWER,
  SHORT_ANSWER,
  setVoiceToggle,
  passVoiceCheck,
} from "../e2e/helpers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "e2e", ".artifacts", "shots");
const width = Number(process.argv.find((a) => a.startsWith("--width="))?.slice(8) ?? 1280);

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function waitForServer(base, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server never became ready");
}

async function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), "natalie-shots-"));
  const env = {
    ...process.env,
    LLM_MOCK: "1",
    VOICE_FAKE: "1",
    APP_PIN: "1234",
    DATABASE_PATH: path.join(dbDir, "shots.db"),
    NEXT_TELEMETRY_DISABLED: "1",
  };
  const port = await freePort();
  const base = `http://localhost:${port}`;
  const log = fs.openSync(path.join(outDir, "server.log"), "w");
  const server = spawn("npx", ["next", "dev", "-p", String(port)], {
    cwd: root,
    env,
    stdio: ["ignore", log, log],
    detached: true,
  });
  const kill = () => {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* gone */
    }
  };
  process.on("exit", kill);
  await waitForServer(base, 120_000);

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch(chromiumLaunchOptions());
  const shot = async (page, name, opts = {}) => {
    await page.screenshot({ path: path.join(outDir, `${name}.png`), ...opts });
    console.log(`• ${name}`);
  };

  // ---- Unauthenticated: login + welcome + tour ----
  {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(base);
    await page.waitForURL("**/login**");
    await shot(page, "01-login");
    for (const d of ["9", "9", "9", "9"]) await page.click(`[data-key="${d}"]`);
    await page.waitForSelector("text=Wrong PIN");
    await shot(page, "02-login-wrong-pin");
    await page.keyboard.type("1234");
    await page.waitForSelector("text=Welcome, Natalie");
    await shot(page, "03-welcome-card");
    await page.click("text=Show me around");
    await page.waitForSelector("text=Step 1 of");
    await shot(page, "04-tour-step1");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(400);
    await shot(page, "05-tour-step2");
    await ctx.close();
  }

  // ---- Authenticated walk ----
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.addCookies(defaultCookies(base));
  const page = await ctx.newPage();

  await page.goto(base);
  await page.waitForSelector("text=Mastery map");
  await shot(page, "10-dashboard-empty");

  // Setup screens
  for (const mode of ["drill", "mock", "rapid", "superday"]) {
    await page.goto(`${base}/train/new?mode=${mode}${mode === "drill" ? "&subtopicId=acct.cascades" : ""}`);
    await page.waitForSelector("text=Start session");
    await shot(page, `11-setup-${mode}`, { fullPage: true });
  }

  // Typed drill: answering → streaming → review → debrief
  await page.goto(`${base}/train/new?mode=drill&subtopicId=acct.cascades&difficulty=4`);
  await page.waitForSelector("text=Subtopics to drill");
  await setVoiceToggle(page, false);
  await page.click("text=Start session");
  await page.waitForSelector("textarea", { timeout: 60000 });
  await page.locator("textarea").first().fill(SHORT_ANSWER);
  await shot(page, "20-drill-answering");
  await page.click("text=Submit answer");
  await page.waitForSelector("text=Interviewer", { timeout: 60000 });
  await page.waitForSelector("textarea");
  await shot(page, "21-drill-followup");
  await page.locator("textarea").first().fill(SHORT_ANSWER);
  await page.click("text=Submit answer");
  await page.waitForSelector("text=Show model answer", { timeout: 90000 });
  await shot(page, "22-drill-review-miss", { fullPage: true });
  await page.click("text=Next question");
  await page.waitForSelector("textarea", { timeout: 60000 });
  await page.click("text=End session early");
  await page.waitForURL("**/debrief", { timeout: 90000 });
  await shot(page, "23-debrief", { fullPage: true });

  // Learn: lesson → proving → closed
  await page.goto(base);
  await page.waitForSelector("text=Fix-it queue");
  await page.getByRole("link", { name: "Learn", exact: true }).first().click();
  await page.waitForSelector("text=walk me through just the first step", { timeout: 60000 });
  await shot(page, "30-learn-lesson");
  for (const msg of ["one", "two", "three"]) {
    await page.locator("textarea").fill(msg);
    await page.locator("textarea").press("Enter");
    await page.waitForFunction(() => !document.body.innerText.includes("thinking"), { timeout: 30000 });
  }
  await page.waitForSelector("text=Start the check");
  await shot(page, "31-learn-ready");
  await page.click("text=Start the check");
  await page.waitForSelector("text=Prove it:", { timeout: 60000 });
  await shot(page, "32-learn-proving");
  for (let i = 0; i < 2; i++) {
    await page.waitForSelector("textarea", { timeout: 60000 });
    await page.locator("textarea").fill(LONG_ANSWER);
    await page.click("text=Submit answer");
    await Promise.race([
      page.waitForSelector("text=Show model answer", { timeout: 90000 }),
      page.waitForSelector("textarea", { timeout: 90000 }),
    ]);
    if (await page.locator("text=Show model answer").isVisible().catch(() => false)) break;
  }
  await shot(page, "33-learn-proof-graded", { fullPage: true });

  // Voice: check screen + listening
  await page.goto(`${base}/train/new?mode=drill&subtopicId=ev.bridge`);
  await page.waitForSelector("text=Voice interview");
  await page.click("text=Start session");
  await page.waitForSelector("text=Voice check", { timeout: 30000 });
  await shot(page, "40-voice-check");
  await passVoiceCheck(page);
  await page.waitForSelector('[data-listening="true"]', { timeout: 60000 });
  await shot(page, "41-voice-listening");
  await page.click("text=End session early");
  await page.waitForURL("**/debrief", { timeout: 90000 });

  // Populated dashboard + history
  await page.goto(base);
  await page.waitForSelector("text=Mastery map");
  await shot(page, "50-dashboard-populated", { fullPage: true });
  await page.goto(`${base}/history`);
  await page.waitForSelector("text=Session history");
  await shot(page, "51-history");

  await browser.close();
  kill();
  fs.rmSync(dbDir, { recursive: true, force: true });
  console.log(`\nShots in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

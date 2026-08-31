/**
 * Browser E2E runner: `npm run e2e [-- --prod] [-- --only=<substr>] [-- --repeat=N]`
 *
 * Boots the app on a free port with a fresh throwaway SQLite database and the
 * offline doubles (LLM_MOCK=1, VOICE_FAKE=1), then runs every scenario in
 * e2e/scenarios/ sequentially in one Chromium instance. A scenario fails on a
 * thrown error OR on any browser console error / uncaught page error it did
 * not explicitly allow. Failure screenshots land in e2e/.artifacts/.
 *
 *   --prod        run against `next build` + `next start` instead of dev
 *   --only=drill  run only scenarios whose filename contains the substring
 *   --repeat=3    run the whole suite N times against one server/database
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromiumLaunchOptions, defaultCookies, loadPlaywright } from "../e2e/helpers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = path.join(root, "e2e", ".artifacts");
const scenariosDir = path.join(root, "e2e", "scenarios");

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const only = args.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? null;
const repeat = Number(args.find((a) => a.startsWith("--repeat="))?.slice("--repeat=".length) ?? 1);

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
  let lastErr = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base, { redirect: "manual" });
      if (res.status < 500) return;
      lastErr = `status ${res.status}`;
    } catch (err) {
      lastErr = err.message;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server never became ready at ${base}: ${lastErr}`);
}

async function main() {
  fs.rmSync(artifactsDir, { recursive: true, force: true });
  fs.mkdirSync(artifactsDir, { recursive: true });

  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), "natalie-e2e-"));
  const env = {
    ...process.env,
    LLM_MOCK: "1",
    VOICE_FAKE: "1",
    BOOKLET_FIXTURE: "1",
    APP_PIN: "1234",
    DATABASE_PATH: path.join(dbDir, "e2e.db"),
    NEXT_TELEMETRY_DISABLED: "1",
  };

  if (prod) {
    console.log("• building production bundle…");
    const build = spawnSync("npx", ["next", "build"], { cwd: root, env, stdio: "inherit" });
    if (build.status !== 0) throw new Error("next build failed");
  }

  const port = await freePort();
  const base = `http://localhost:${port}`;
  const serverLog = fs.openSync(path.join(artifactsDir, "server.log"), "w");
  const server = spawn(
    "npx",
    prod ? ["next", "start", "-p", String(port)] : ["next", "dev", "-p", String(port)],
    { cwd: root, env, stdio: ["ignore", serverLog, serverLog], detached: true },
  );
  const killServer = () => {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  };
  process.on("exit", killServer);

  console.log(`• waiting for ${prod ? "prod" : "dev"} server on ${base}…`);
  await waitForServer(base, 120_000);

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch(chromiumLaunchOptions());

  const files = fs
    .readdirSync(scenariosDir)
    .filter((f) => f.endsWith(".mjs"))
    .filter((f) => (only ? f.includes(only) : true))
    .sort();
  if (files.length === 0) throw new Error(`no scenarios matched${only ? ` --only=${only}` : ""}`);

  const results = [];
  for (let round = 1; round <= repeat; round++) {
    for (const file of files) {
      const mod = await import(path.join(scenariosDir, file));
      const label = repeat > 1 ? `${mod.name ?? file} (round ${round})` : (mod.name ?? file);
      const allow = (mod.allowConsole ?? []).map((p) => (p instanceof RegExp ? p : new RegExp(p)));

      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      // Pre-seed the PIN-gate + tour cookies unless the scenario tests them.
      if (!mod.noAuth) await context.addCookies(defaultCookies(base));
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const consoleErrors = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e}`));

      const startedAt = Date.now();
      let failure = null;
      try {
        await mod.run({ page, base, say: undefined });
        const offending = consoleErrors.filter((e) => !allow.some((p) => p.test(e)));
        if (offending.length > 0) {
          failure = new Error(`console errors:\n  ${offending.join("\n  ")}`);
        }
      } catch (err) {
        failure = err;
      }
      if (failure) {
        const shot = path.join(artifactsDir, `${file.replace(/\.mjs$/, "")}-r${round}-fail.png`);
        await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
        console.error(`✗ ${label} — ${failure.message}\n  screenshot: ${shot}`);
      } else {
        console.log(`✓ ${label} (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
      }
      results.push({ label, ok: !failure });
      await context.close();
    }
  }

  await browser.close();
  killServer();
  fs.rmSync(dbDir, { recursive: true, force: true });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} scenarios passed${prod ? " (prod)" : ""}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

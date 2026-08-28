# Deploying NatalieTrainer

This is the ops guide for standing the app up on the Mac mini and putting it behind the site. It assumes you've never seen the project before; product details live in `README.md`.

## What you're deploying

An investment-banking interview trainer built for one user (Natalie). It generates hard technical questions, interviews her (typed or fully spoken), grades every answer, and tracks mastery over time. Stack: Next.js (Node 20+), SQLite on local disk, the Claude API server-side for all intelligence, and optionally the OpenAI realtime API as the audio edge for voice mode. There is no external database and no other services — one Node process and one SQLite file.

Two things follow from "built for one user" and shape everything below:

1. **The only login is a PIN.** The app ships with a built-in PIN gate (default **1234** — change it via `APP_PIN`, see below). That keeps casual visitors out, but a 4-digit PIN is not internet-grade security on its own: still put basic auth or a private network in front of it (step 5).
2. **The SQLite file is all of her progress.** Lose it and the mastery history, fix-it queue, and session record are gone. Back it up.

## 1. Get the code

```bash
git clone https://github.com/hratterman/natalietrainer.git
cd natalietrainer
git checkout claude/busy-allen-rbntkt   # the working branch (may already be checked out — it's the only branch)
node --version                          # needs 20+
npm install
```

## 2. Configure

```bash
cp .env.example .env.local
```

Edit `.env.local`:

| Variable | Required? | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | **Yes** | Powers question generation, interviewing, grading. Without it, nothing real works. |
| `OPENAI_API_KEY` | Only for voice mode | Used exclusively for speech-to-text and the interviewer's voice. Skip it and the app runs typed-only; the voice toggle greys out. |
| `APP_PIN` | Strongly recommended | The login PIN. Defaults to `1234` if unset — set your own before exposing the app. Changing it requires an app restart and signs out existing browsers. |
| `LLM_MOCK`, `VOICE_FAKE` | **Never in production** | Offline test doubles. If either is set, sessions look real but are canned fixtures. Leave them out of `.env.local`. |
| `DATABASE_PATH` | No | Defaults to `data/natalie.db` relative to the working directory. |

Keys live only in `.env.local` (gitignored) and are only ever read server-side. Don't put them anywhere else.

## 3. Run it

```bash
npm run build
npm start          # serves on http://localhost:3000 (override with PORT=xxxx npm start)
```

The database self-creates and self-migrates at `data/natalie.db` on first use — no setup step. **Always start the app from the repo root** so the `data/` directory lands in the same place every time.

## 4. Keep it alive across reboots (launchd)

Save as `~/Library/LaunchAgents/com.natalietrainer.app.plist`, fixing the two paths (`which npm` tells you the npm path — usually `/opt/homebrew/bin/npm` on Apple Silicon):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.natalietrainer.app</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/npm</string>
    <string>start</string>
  </array>
  <key>WorkingDirectory</key><string>/PATH/TO/natalietrainer</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>3000</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/PATH/TO/natalietrainer/logs/app.log</string>
  <key>StandardErrorPath</key><string>/PATH/TO/natalietrainer/logs/app.log</string>
</dict>
</plist>
```

```bash
mkdir -p logs
launchctl load ~/Library/LaunchAgents/com.natalietrainer.app.plist
launchctl list | grep natalietrainer   # should show it running
```

A LaunchAgent starts at login; if the mini runs headless with no auto-login, use the same plist as a LaunchDaemon in `/Library/LaunchDaemons` instead. (`pm2 start npm -- start` + `pm2 startup` works too if you'd rather.)

## 5. Putting it on the site

Run it on a subdomain (e.g. `trainer.` + the site's domain) behind a reverse proxy. Two hard requirements:

> **Set a real PIN, and add a second lock.** The built-in PIN gate (`APP_PIN`) covers every page and API route, but four digits alone won't survive a determined stranger. Before going public: set `APP_PIN` to something that isn't 1234, and add either HTTP basic auth at the proxy (below) or keep the app off the public internet entirely with Tailscale (`tailscale serve`) / Cloudflare Tunnel + Access. Defense in depth is cheap here.
>
> **Real HTTPS is required for voice mode.** The browser only grants mic access and WebRTC in a secure context. `localhost` is exempt, but on a domain it must be genuine TLS.

Caddy gives you both in a few lines and manages certificates automatically. `brew install caddy`, then `/opt/homebrew/etc/Caddyfile`:

```
trainer.example.com {
    basic_auth {
        natalie <HASH>    # generate with: caddy hash-password
    }
    reverse_proxy localhost:3000 {
        flush_interval -1
    }
}
```

```bash
caddy hash-password          # paste the output over <HASH>
brew services start caddy
```

Point the subdomain's DNS at the mini's public IP and forward ports 80/443 on the router to it. Notes:

- `flush_interval -1` matters: the interviewer streams replies over SSE, and proxy buffering would freeze the conversation. Same rule if you use nginx (`proxy_buffering off;` for `/api/`) — and don't put a buffering CDN in front of `/api/`.
- Voice also opens a direct browser→OpenAI WebRTC connection; nothing to configure for that beyond HTTPS on the page itself.
- Tell users (well, Natalie) to wear headphones in voice mode — echo cancellation keeps the mic hot for interruptions.

## 6. Verify the install

In order — the first four are free and offline, the rest use real keys (pennies):

```bash
npm run test && npm run typecheck && npm run lint   # 100+ offline tests
npm run e2e -- --prod    # full browser suite against a production build (boots its own server + throwaway DB)
npm run smoke:llm        # one real Claude round trip: structured output, fallbacks, prompt-cache hit
npm run smoke:voice      # only if voice is enabled: token mint + TTS + transcription loop
```

Then open the site in a real browser and: run one topic drill end-to-end (question → answer → grade → debrief), and if voice is on, walk the manual checklist at the bottom of `README.md`'s voice section (mic captions, silence auto-submit, barge-in both directions).

## 7. Care and feeding

**Backups.** Everything is the three files `data/natalie.db`, `data/natalie.db-wal`, `data/natalie.db-shm`. Copy them somewhere nightly, e.g. a second launchd job or cron running:

```bash
rsync -a /PATH/TO/natalietrainer/data/ /PATH/TO/backups/natalietrainer-$(date +%F)/
```

**Updating.** `git pull && npm install && npm run build`, then `launchctl kickstart -k gui/$(id -u)/com.natalietrainer.app` (or unload/load). The database migrates itself on boot — never edit files under `drizzle/` by hand.

**Costs.** Each real session makes multiple Claude API calls (generation, interviewer turns, grading, debrief); voice adds roughly **$0.70 per 30-minute session** on the OpenAI side. Single-user usage is modest, but this is why access control is non-negotiable.

**Troubleshooting.**

| Symptom | Likely cause |
| --- | --- |
| Port 3000 already in use | Another instance (launchd `KeepAlive` restarted one). `launchctl list | grep natalietrainer`, then unload before running by hand. |
| Questions look canned / repeat "[MOCK …]" | `LLM_MOCK=1` leaked into the environment — remove it and restart. |
| Voice toggle greyed out in session setup | No `OPENAI_API_KEY` in `.env.local`, or the app was rebuilt without it — it's read at request time, so a restart after adding it is enough. |
| Mic permission never appears on the site | Page isn't a secure context — check the cert / that you're not on plain HTTP. |
| Interviewer reply appears all at once at the end | Proxy is buffering the SSE stream — see `flush_interval` note above. |
| App won't start, log mentions `better-sqlite3` | Native module built for a different Node — `rm -rf node_modules && npm install` with the Node the service uses. |

Logs are wherever the plist points (`logs/app.log` above).

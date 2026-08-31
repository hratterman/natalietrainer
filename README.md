# NatalieTrainer

An investment banking technical-interview trainer built for superday prep. It generates genuinely hard, non-repeating technical questions across the full IB canon, interviews you the way a real banker does — streaming follow-ups, personas, time pressure — grades every answer against a superday-calibrated rubric, and tracks per-subtopic mastery so you always know what to attack next.

## What's inside

- **12 content areas, 90+ question archetypes**: accounting & 3-statement cascades, Enterprise/Equity Value, comps & precedents, DCF & WACC, M&A (accretion/dilution, purchase accounting), LBO (paper LBOs, debt stacks, returns math), capital markets, credit, restructuring, markets & stock pitches, mental math, and behavioral-with-technical-followups.
- **Four session modes**:
  - **Topic drill** — focused reps on chosen subtopics with a graded review after every question.
  - **Mock interview** — open-ended answers, adaptive follow-ups ("okay, but what if it's cash-financed?"), scored debrief.
  - **Rapid fire** — countdown-timed short answers and mental math, back to back.
  - **Superday simulation** — four rounds, four interviewer personas, one overall debrief.
- **Honest scoring**: accuracy / completeness / structure rubrics with model answers and specific corrections; 80+ means offer-quality.
- **Progress tracking**: a mastery heatmap over every subtopic, adaptive difficulty, weakness surfacing, and prescribed drill plans after every session.
- **PIN login + onboarding**: a built-in PIN gate (`APP_PIN`, default 1234) covers every page and API route, and a first-visit welcome card + spotlight tour walks the dashboard.
- **The Booklet**: her "400 questions" guide turned into a deadline-aware memorization system — daily recall queue, spaced re-proofs, and grading against the guide's own answers (see below).

## Setup

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # then put your Anthropic API key in it
npm run dev
```

Open http://localhost:3000. You'll be asked for a PIN — the default is **1234**; set your own with `APP_PIN` in `.env.local` (restart to apply). The SQLite database self-creates at `data/natalie.db` on first use. The first visit after logging in offers a guided tour of the dashboard — relaunch it anytime with the Tour button.

Questions, interviewing, and grading run on the Claude API (`claude-opus-5`), so `ANTHROPIC_API_KEY` is required for real sessions. To try the app without a key (canned questions and grades), set `LLM_MOCK=1` in `.env.local`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app |
| `npm run test` | Unit + route tests (offline, mock LLM) |
| `npm run e2e` | Browser E2E suite (offline; `-- --prod` runs it against a production build, `-- --repeat=3` soaks) |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm run booklet:ingest -- <guide.docx>` | Load the 400-question guide into `data/booklet.json` (local only — see Booklet section) |
| `npm run smoke:llm` | One real Claude API round trip — run after SDK/prompt changes |
| `npm run smoke:voice` | Real OpenAI voice-edge round trip — run after voice changes |

## Voice mode — interviews like IRL

With an `OPENAI_API_KEY` in `.env.local`, drills, mocks, and superdays can run **fully spoken**: the interviewer talks in a distinct voice per persona, you answer out loud, and a few seconds of silence submits your answer — no editing, exactly like the real thing. Claude remains the interviewer/grader brain; OpenAI powers only the audio edge (streaming transcription in, streaming TTS out; the key never reaches the browser).

- **Seven interviewers** with real dispositions: the Friendly VP, the Quant, the Skeptic, the Grinder, a stone-faced MD, a rambly associate, and a trader. Different voices, different greetings, different amounts of patience.
- **Live interruptions, both ways.** Talk over the interviewer and the voice stops. Ramble without a number in front of the trader and you'll hear "Stop. Number first, story later." mid-sentence — then a pointed follow-up on whatever you managed to say.
- **Delivery grading.** Spoken answers get a fourth rubric dimension: answer-first framing, fillers, hedging, pace (measured WPM), and composure after being cut off.

Wear headphones (echo cancellation keeps the mic hot for barge-in). Rapid-fire stays typed — silence detection would fight the countdown. Voice costs roughly $0.70 per 30-minute session on the OpenAI side.

`npm run smoke:voice` verifies the OpenAI edge with a real key (token mint, TTS round trip, and a transcription loop that feeds the TTS audio back through speech-to-text). To develop the voice UI offline, set `VOICE_FAKE=1` with `LLM_MOCK=1`.

**Manual voice checklist** (after changing voice code, with real keys): mic permission + voice check captions echo what you say · silence auto-submits at the persona's window · talking over the interviewer stops the audio · rambling number-less at the trader gets you cut off, with the duck-in feeling natural · persona voices clearly distinct · killing the network mid-session degrades to typing without losing the session.

## Learning mode — actually fixing what you miss

Getting a question wrong isn't a dead end. Every meaningful miss (below 70 overall, or accuracy ≤ 5) lands in the dashboard's **Fix-it queue** with the exact concept the grader says you need to relearn.

- **Socratic coach**: open a fix-it and a private coach — anchored to the exact question, *your* exact answer, and the grader's corrections — teaches it properly: quotes what you said, starts from what you got right, and makes you do the reasoning one step at a time. Ask it anything.
- **Prove it to close**: no credit for nodding along. When you (or the coach) think you've got it, you must beat **two fresh questions of the same archetype in a row**, graded cold by the normal grader (they feed your mastery too). Fail one and you're back in the lesson — the coach knows exactly what you missed.
- **Spaced spot-checks**: resolved concepts resurface for a one-question spot-check 2 days later, then 7 days later. Pass both and it's cleared for good; miss one and it reopens with your newest miss as the starting point.
- **Talk it through**: with voice available, the "🎙 Talk it through" toggle turns the lesson into a spoken conversation — the coach speaks (warm tutor voice, relaxed pacing, never interrupts) and you reason out loud; spoken proof answers get delivery grading too.

## The Booklet — 400 questions, drilled cold

The **Booklet** tab is a second training system for the "400 Investment Banking Interview Questions" guide: not generated questions, but the guide's own canon, memorized to the standard of *cold*. It's built on the study methods with the strongest evidence behind them:

- **Retrieval only.** Every touch of a question is a recall attempt from memory — typed, then graded. Re-reading is never on the schedule; the full canon lives on the reference page for lookups.
- **Learn to criterion, then re-prove it.** A question leaves the queue only after a fully right recall (misses come back the same session until it lands), and goes **cold** only after three more right recalls on separate, spreading days (3 → 7 → 16 days). Miss one and it drops back and starts over.
- **A deadline that actually schedules.** Set the superday date and the intervals compress to fit, the daily intake of new questions is paced to cover everything in time, and the last two days re-run the entire deck as a final sweep. The overview always shows the honest math: on pace or not, and what daily budget would fix it.
- **Interleaved, graded against the canon.** Sessions mix sections instead of blocking one topic. Claude grades each recall against the guide's canonical answer — substance over wording, modern figures accepted where the 2009 guide is dated — with a right / partial / wrong verdict, what you missed, and the canonical answer every time.

Only the 277 technical + restructuring questions are drilled. The 121 fit and transaction-experience questions are reference-only, flagged "personalize, don't memorize" — sample answers to those need *your* stories (that's what the coach is for).

**Loading the guide** (one-time, per machine): the guide is copyrighted, so it is never committed to this repo — the app reads a local `data/booklet.json` produced from your own copy:

```bash
npm run booklet:ingest -- /path/to/400QuestionIBBible.docx
```

Until that file exists, the Booklet tab shows setup instructions instead of a queue. Back up `data/booklet.json` alongside the database if you don't want to re-run the ingest.

## How it stays hard and fresh

Every question is generated from a checked-in **archetype** (what to test, what to vary, the difficulty bar, sample superday questions) plus your recent question history, so questions don't repeat. Difficulty adapts per subtopic: two strong answers in a row step you up, a miss steps you down — with difficulty 5 defined as genuinely superday-hard: multi-part, adversarial twist, the "why" behind every step.

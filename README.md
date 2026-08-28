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

## Setup

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # then put your Anthropic API key in it
npm run dev
```

Open http://localhost:3000. The SQLite database self-creates at `data/natalie.db` on first use.

Questions, interviewing, and grading run on the Claude API (`claude-opus-5`), so `ANTHROPIC_API_KEY` is required for real sessions. To try the app without a key (canned questions and grades), set `LLM_MOCK=1` in `.env.local`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app |
| `npm run test` | Unit + route tests (offline, mock LLM) |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
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

## How it stays hard and fresh

Every question is generated from a checked-in **archetype** (what to test, what to vary, the difficulty bar, sample superday questions) plus your recent question history, so questions don't repeat. Difficulty adapts per subtopic: two strong answers in a row step you up, a miss steps you down — with difficulty 5 defined as genuinely superday-hard: multi-part, adversarial twist, the "why" behind every step.

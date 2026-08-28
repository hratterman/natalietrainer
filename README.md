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
| `npm run smoke:llm` | One real API round trip — run after SDK/prompt changes |

## How it stays hard and fresh

Every question is generated from a checked-in **archetype** (what to test, what to vary, the difficulty bar, sample superday questions) plus your recent question history, so questions don't repeat. Difficulty adapts per subtopic: two strong answers in a row step you up, a miss steps you down — with difficulty 5 defined as genuinely superday-hard: multi-part, adversarial twist, the "why" behind every step.

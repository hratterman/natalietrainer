@AGENTS.md

# NatalieTrainer

Single-user IB technical-interview trainer: Next.js App Router + TypeScript strict + Tailwind v4, SQLite (better-sqlite3 + Drizzle), Anthropic SDK server-side only.

## Architecture map

- `src/content/` — the question canon. `types.ts` defines Area/Subtopic/Archetype (+ difficulty ladder semantics); `taxonomy/*.ts` is one file per area (12 areas, tier 1 = core superday material). Archetype `description` fields are LLM generation seeds — treat their wording as product content.
- `src/lib/db/` — `schema.ts` (Drizzle tables), `index.ts` (WAL, migrate-on-boot, `globalThis` singleton, `DATABASE_PATH` override for tests), `repo.ts` (all queries; routes never touch Drizzle directly). Migrations in `drizzle/` are generated via `npx drizzle-kit generate` — never hand-edit.
- `src/lib/booklet/` — the Booklet memorization system (the "400 questions" guide). `types.ts` (client-safe), `canon.ts` (loads local gitignored `data/booklet.json`; `BOOKLET_PATH` override, `BOOKLET_FIXTURE=1` serves the checked-in original fixture), `scheduler.ts` (pure: successive-relearning state machine, deadline-compressed ladder, interleaved queue, pacing projection), `engine.ts` (server glue), `fixture.ts`. Ingest: `npm run booklet:ingest -- <docx>` (`scripts/booklet-ingest.mjs`). The guide is copyrighted and this repo is public: its text must NEVER be committed — canon lives only in the local JSON; tests/e2e use the fixture.
- `src/lib/mastery.ts` — pure functions: EWMA mastery, difficulty stepping, weakness ranking, seeded selection. Incremental mastery updates replay the full grade history per subtopic so they always equal `rebuildMastery()`.
- `src/lib/llm/` — `client.ts` owns ALL SDK policy (model `claude-opus-5`, adaptive thinking, `betas: ["server-side-fallback-2026-07-01"]` + `fallbacks: "default"`, structured outputs via `betaZodOutputFormat`); no other module passes raw SDK params. `prompts.ts` must stay compile-time-constant (cache-stable prefixes — no timestamps/ids in system prompts). `controlLine.ts` is the interviewer's first-line JSON protocol. `mock.ts` backs `LLM_MOCK=1`.
- `src/lib/session/engine.ts` — session lifecycle: question selection (adaptive by mastery × area weight), superday round chaining, grading, debrief. `learn.ts` beside it owns learn-mode orchestration (lesson anchor, proofs, spot-check closure); `src/lib/fixit.ts` is the pure fix-it policy (miss qualification, spaced schedule).
- Learn-mode invariants: the lesson's anchor question (askedIndex 0) is never graded (marked `skipped` when proofs begin); learn sessions never run `completeSession`; fixits are created only from non-learn grades (learn grades feed the closure hook instead); `PLAYABLE_MODES` gates the public create-session route — learn sessions exist only via `/api/fixits/*` routes.
- Booklet invariants: only `deck === "technical"` items are schedulable/gradable (fit/experience are reference-only, the answer route 404s them); a wrong or revealed answer requeues in-session until a fully right recall; cold = 3 spaced right recalls; all scheduling math stays in the pure `scheduler.ts` (engine/routes never compute intervals).
- `src/lib/voice/` — voice mode. Server: `openai.ts` (the ONLY place OPENAI_API_KEY is read; ephemeral Realtime transcription tokens + TTS streaming). Client: `transport.ts` interface with `openaiTransport.ts` (WebRTC + `oai-events` + PCM playback via `player.ts`) and `fakeTransport.ts` (tests/`VOICE_FAKE=1`, driven via `window.__voiceFakeController`); `useVoiceSession.ts` orchestrates. Pure logic (`sentenceChunker`, `deliveryMetrics`, `interruption`) is unit-tested and framework-free. Claude stays the only brain — OpenAI is strictly the audio edge.
- `src/app/api/` — thin Zod-validated handlers; `answer`/`open` stream SSE; `interject` persists interviewer barge-ins without an LLM call. `src/components/SessionRunner.tsx` is the client state machine for all four modes, typed and spoken.

## Rules

- `npm run test && npm run typecheck && npm run lint` must pass before any commit. Tests run offline (`LLM_MOCK=1` is set by vitest config).
- `npm run e2e` is the offline browser suite (Playwright; boots its own server with `LLM_MOCK=1 VOICE_FAKE=1` and a throwaway DB; scenarios fail on any unallowed console error). Run it after changing SessionRunner/LearnRunner, routes, or voice client code; `-- --prod` verifies the production build.
- After changing prompts or SDK usage, run `npm run smoke:llm` with a real key — it verifies structured parsing, the fallbacks param, and that the prompt-cache architecture actually hits (`cache_read_input_tokens > 0`). After changing voice code, run `npm run smoke:voice` (real OPENAI_API_KEY) and the manual checklist in README.md.
- Interviewer follow-up budgets exclude spoken question openings (turnIndex 0) and canned interjections — keep `engine.followUpsUsed` and the mock in `interviewer.ts` consistent.
- `src/lib/llm/*` and `src/lib/db/*` are server-only (`import "server-only"`); never import them from client components. Taxonomy and personas are client-safe data.
- Schema changes: edit `src/lib/db/schema.ts`, then `npx drizzle-kit generate --name <change>`; the app migrates itself on boot.
- New taxonomy content: add archetypes/subtopics to an area file (ids must be prefixed: `area.subtopic.archetype`); the integrity test in `src/content/taxonomy.test.ts` enforces the invariants.

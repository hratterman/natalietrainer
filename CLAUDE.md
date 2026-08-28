@AGENTS.md

# NatalieTrainer

Single-user IB technical-interview trainer: Next.js App Router + TypeScript strict + Tailwind v4, SQLite (better-sqlite3 + Drizzle), Anthropic SDK server-side only.

## Architecture map

- `src/content/` — the question canon. `types.ts` defines Area/Subtopic/Archetype (+ difficulty ladder semantics); `taxonomy/*.ts` is one file per area (12 areas, tier 1 = core superday material). Archetype `description` fields are LLM generation seeds — treat their wording as product content.
- `src/lib/db/` — `schema.ts` (Drizzle tables), `index.ts` (WAL, migrate-on-boot, `globalThis` singleton, `DATABASE_PATH` override for tests), `repo.ts` (all queries; routes never touch Drizzle directly). Migrations in `drizzle/` are generated via `npx drizzle-kit generate` — never hand-edit.
- `src/lib/mastery.ts` — pure functions: EWMA mastery, difficulty stepping, weakness ranking, seeded selection. Incremental mastery updates replay the full grade history per subtopic so they always equal `rebuildMastery()`.
- `src/lib/llm/` — `client.ts` owns ALL SDK policy (model `claude-opus-5`, adaptive thinking, `betas: ["server-side-fallback-2026-07-01"]` + `fallbacks: "default"`, structured outputs via `betaZodOutputFormat`); no other module passes raw SDK params. `prompts.ts` must stay compile-time-constant (cache-stable prefixes — no timestamps/ids in system prompts). `controlLine.ts` is the interviewer's first-line JSON protocol. `mock.ts` backs `LLM_MOCK=1`.
- `src/lib/session/engine.ts` — session lifecycle: question selection (adaptive by mastery × area weight), superday round chaining, grading, debrief.
- `src/app/api/` — thin Zod-validated handlers; `answer` streams SSE. `src/components/SessionRunner.tsx` is the client state machine for all four modes.

## Rules

- `npm run test && npm run typecheck && npm run lint` must pass before any commit. Tests run offline (`LLM_MOCK=1` is set by vitest config).
- After changing prompts or SDK usage, run `npm run smoke:llm` with a real key — it verifies structured parsing, the fallbacks param, and that the prompt-cache architecture actually hits (`cache_read_input_tokens > 0`).
- `src/lib/llm/*` and `src/lib/db/*` are server-only (`import "server-only"`); never import them from client components. Taxonomy and personas are client-safe data.
- Schema changes: edit `src/lib/db/schema.ts`, then `npx drizzle-kit generate --name <change>`; the app migrates itself on boot.
- New taxonomy content: add archetypes/subtopics to an area file (ids must be prefixed: `area.subtopic.archetype`); the integrity test in `src/content/taxonomy.test.ts` enforces the invariants.

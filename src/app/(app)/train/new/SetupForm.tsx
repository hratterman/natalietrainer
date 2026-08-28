"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircleIcon, MicIcon } from "@/components/ui/icons";

export type SetupTaxonomy = {
  areas: {
    id: string;
    name: string;
    tier: 1 | 2;
    subtopics: { id: string; name: string }[];
  }[];
  personas: { id: string; name: string; blurb: string }[];
};

type Mode = "drill" | "mock" | "rapid" | "superday";

const MODE_CARDS: { mode: Mode; title: string; blurb: string }[] = [
  {
    mode: "drill",
    title: "Topic drill",
    blurb: "Focused reps on chosen subtopics with graded review after every question.",
  },
  {
    mode: "mock",
    title: "Mock interview",
    blurb: "Open-ended questions with adaptive follow-ups and a scored debrief at the end.",
  },
  {
    mode: "rapid",
    title: "Rapid fire",
    blurb: "Countdown-timed short answers and mental math, back to back.",
  },
  {
    mode: "superday",
    title: "Superday simulation",
    blurb: "Multiple rounds, different interviewers, one overall debrief. The full gauntlet.",
  },
];

const DEFAULT_SUPERDAY_ROUNDS = [
  { personaId: "friendly-vp", focusAreaId: "acct", questionCount: 3 },
  { personaId: "quant", focusAreaId: "dcf", questionCount: 3 },
  { personaId: "skeptic", focusAreaId: "mna", questionCount: 3 },
  { personaId: "grinder", focusAreaId: "lbo", questionCount: 3 },
];

/** Sample 4 distinct interviewers from the full roster for a fresh panel. */
function shuffledPanel(personaIds: string[]): typeof DEFAULT_SUPERDAY_ROUNDS {
  const pool = [...personaIds];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return DEFAULT_SUPERDAY_ROUNDS.map((round, i) => ({
    ...round,
    personaId: pool[i % pool.length] ?? round.personaId,
  }));
}

export function SetupForm({
  taxonomy,
  voiceAvailable,
}: {
  taxonomy: SetupTaxonomy;
  voiceAvailable: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const prefillSubtopic = search.get("subtopicId");
  const prefillDifficulty = search.get("difficulty");
  const prefillMode = search.get("mode");

  const [mode, setMode] = useState<Mode>(() => {
    if (prefillMode === "drill" || prefillMode === "mock" || prefillMode === "rapid" || prefillMode === "superday") {
      return prefillMode;
    }
    return prefillSubtopic ? "drill" : "mock";
  });
  // URL prefills are untrusted: an unknown subtopic or out-of-range difficulty
  // must not preselect anything the form can't represent (or the server rejects).
  const [subtopicIds, setSubtopicIds] = useState<string[]>(() =>
    prefillSubtopic &&
    taxonomy.areas.some((a) => a.subtopics.some((s) => s.id === prefillSubtopic))
      ? [prefillSubtopic]
      : [],
  );
  const [areaIds, setAreaIds] = useState<string[]>(["acct", "ev", "val", "dcf", "mna", "lbo"]);
  const [difficulty, setDifficulty] = useState<number | "adaptive">(() => {
    const n = Number(prefillDifficulty);
    return prefillDifficulty && Number.isInteger(n) && n >= 1 && n <= 5 ? n : "adaptive";
  });
  // Number inputs are kept as strings and clamped at submit — a cleared or
  // garbage field must never send NaN to the server.
  const [questionCount, setQuestionCount] = useState(String(mode === "rapid" ? 10 : 5));
  const [personaId, setPersonaId] = useState("quant");
  const [secondsPerQuestion, setSecondsPerQuestion] = useState("45");
  const [voiceMode, setVoiceMode] = useState(voiceAvailable);
  const [superdayRounds, setSuperdayRounds] = useState(DEFAULT_SUPERDAY_ROUNDS);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expandedAreas = useMemo(
    () => new Set(subtopicIds.map((s) => s.split(".")[0] ?? "")),
    [subtopicIds],
  );

  const clampInt = (raw: string, min: number, max: number, fallback: number) => {
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  const start = async () => {
    setStarting(true);
    setError(null);
    const config = {
      subtopicIds: mode === "drill" ? subtopicIds : [],
      areaIds: mode === "drill" ? [] : areaIds,
      difficulty,
      questionCount:
        mode === "superday" ? 12 : clampInt(questionCount, 1, 30, mode === "rapid" ? 10 : 5),
      personaId: mode === "mock" || mode === "superday" || mode === "drill" ? personaId : null,
      secondsPerQuestion: mode === "rapid" ? clampInt(secondsPerQuestion, 10, 600, 45) : null,
      rounds: mode === "superday" ? superdayRounds : null,
      // Rapid-fire stays typed: silence detection fights the hard countdown.
      voiceMode: mode !== "rapid" && voiceAvailable && voiceMode,
    };
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, config }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to start session");
      const { sessionId } = (await res.json()) as { sessionId: string };
      router.push(`/train/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
      setStarting(false);
    }
  };

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const canStart =
    !starting &&
    (mode === "drill" ? subtopicIds.length > 0 : mode === "superday" ? true : areaIds.length > 0);

  const modeTitle = MODE_CARDS.find((c) => c.mode === mode)?.title ?? mode;
  const voiceOn = mode !== "rapid" && voiceAvailable && voiceMode;
  const summaryLine =
    mode === "superday"
      ? `${modeTitle} · 4 rounds · 12 questions${voiceOn ? " · voice on" : ""}`
      : [
          modeTitle,
          mode === "drill"
            ? `${subtopicIds.length} subtopic${subtopicIds.length === 1 ? "" : "s"}`
            : `${areaIds.length} area${areaIds.length === 1 ? "" : "s"}`,
          `${clampInt(questionCount, 1, 30, mode === "rapid" ? 10 : 5)} questions`,
          difficulty === "adaptive" ? "adaptive difficulty" : `difficulty ${difficulty}`,
          ...(mode === "rapid" ? [`${clampInt(secondsPerQuestion, 10, 600, 45)}s each`] : []),
          ...(voiceOn ? ["voice on"] : []),
        ].join(" · ");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-ink-900">New session</h1>

      {/* Mode cards */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODE_CARDS.map((card) => (
          <button
            key={card.mode}
            onClick={() => setMode(card.mode)}
            className={`rounded-lg border p-4 text-left transition ${
              mode === card.mode
                ? "border-primary bg-primary-tint"
                : "border-line bg-surface-1 hover:border-line-strong"
            }`}
          >
            <div className="flex items-center justify-between font-semibold text-ink-900">
              {card.title}
              {mode === card.mode && <CheckCircleIcon className="h-4 w-4 text-primary" />}
            </div>
            <div className="mt-1 text-sm text-ink-600">{card.blurb}</div>
          </button>
        ))}
      </div>

      {/* Voice toggle */}
      {mode !== "rapid" && (
        <button
          onClick={() => voiceAvailable && setVoiceMode((v) => !v)}
          disabled={!voiceAvailable}
          role="switch"
          aria-checked={voiceMode && voiceAvailable}
          data-voice-on={voiceMode && voiceAvailable ? "true" : "false"}
          className={`mt-4 flex w-full items-center justify-between rounded-lg border p-4 text-left transition ${
            voiceMode && voiceAvailable
              ? "border-primary bg-primary-tint"
              : "border-line bg-surface-1"
          } ${voiceAvailable ? "hover:border-line-strong" : "cursor-not-allowed opacity-60"}`}
        >
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-ink-900">
              <MicIcon className="h-4 w-4 text-primary" /> Voice interview
            </div>
            <div className="mt-1 text-sm text-ink-600">
              {voiceAvailable
                ? "Speak your answers out loud to an interviewer with a real voice. Silence ends your turn — no editing, like the real thing."
                : "Requires OPENAI_API_KEY in .env.local — voice powers the mic transcription and the interviewer's voice."}
            </div>
          </div>
          <span
            className={`ml-4 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
              voiceMode && voiceAvailable ? "bg-primary" : "bg-line-strong"
            }`}
          >
            <span
              className={`h-5 w-5 rounded-full bg-white transition ${
                voiceMode && voiceAvailable ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
      )}

      {/* Mode-specific options */}
      <div className="mt-6 space-y-6 card card-pad">
        {mode === "drill" && (
          <section>
            <h3 className="text-sm font-semibold text-ink-900">Subtopics to drill</h3>
            <div className="mt-3 space-y-4">
              {taxonomy.areas.map((area) => (
                <details key={area.id} open={expandedAreas.has(area.id)}>
                  <summary className="cursor-pointer text-sm text-ink-900">
                    {area.name}
                    {area.tier === 1 && (
                      <span className="ml-2 rounded bg-primary-tint px-1.5 py-0.5 text-[10px] uppercase text-primary">
                        core
                      </span>
                    )}
                  </summary>
                  <div className="mt-2 grid grid-cols-1 gap-1.5 pl-4 sm:grid-cols-2">
                    {area.subtopics.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm text-ink-600">
                        <input
                          type="checkbox"
                          checked={subtopicIds.includes(s.id)}
                          onChange={() => toggle(subtopicIds, setSubtopicIds, s.id)}
                          className="accent-primary"
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {(mode === "mock" || mode === "rapid") && (
          <section>
            <h3 className="text-sm font-semibold text-ink-900">Areas in scope</h3>
            <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {taxonomy.areas.map((area) => (
                <label key={area.id} className="flex items-center gap-2 text-sm text-ink-600">
                  <input
                    type="checkbox"
                    checked={areaIds.includes(area.id)}
                    onChange={() => toggle(areaIds, setAreaIds, area.id)}
                    className="accent-primary"
                  />
                  {area.name}
                  {area.tier === 1 && (
                    <span className="rounded bg-primary-tint px-1.5 py-0.5 text-[10px] uppercase text-primary">
                      core
                    </span>
                  )}
                </label>
              ))}
            </div>
          </section>
        )}

        {mode === "superday" && (
          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">Round plan</h3>
              <button
                onClick={() => setSuperdayRounds(shuffledPanel(taxonomy.personas.map((p) => p.id)))}
                className="btn btn-secondary btn-sm"
              >
                Shuffle panel
              </button>
            </div>
            <ol className="mt-3 space-y-2 text-sm text-ink-900">
              {superdayRounds.map((round, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs">
                    {i + 1}
                  </span>
                  <span>
                    {taxonomy.areas.find((a) => a.id === round.focusAreaId)?.name ??
                      round.focusAreaId}{" "}
                    — {round.questionCount} questions with{" "}
                    <span className="text-ink-900">
                      {taxonomy.personas.find((p) => p.id === round.personaId)?.name ??
                        round.personaId}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-ink-400">
              Four back-to-back rounds, ~12 questions, one overall debrief. Difficulty adapts to
              your mastery.
            </p>
          </section>
        )}

        {mode !== "superday" && (
          <section className="flex flex-wrap items-end gap-6">
            <div>
              <label className="block text-sm font-semibold text-ink-900">Difficulty</label>
              <select
                value={String(difficulty)}
                onChange={(e) =>
                  setDifficulty(e.target.value === "adaptive" ? "adaptive" : Number(e.target.value))
                }
                className="mt-2 rounded border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-ink-900"
              >
                <option value="adaptive">Adaptive (recommended)</option>
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>
                    {d} — {["definition", "single-step", "multi-step", "edge case", "superday-hard"][d - 1]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-900">Questions</label>
              <input
                type="number"
                min={1}
                max={30}
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
                className="input mt-2 w-24 px-3 py-1.5"
              />
            </div>
            {(mode === "mock" || (mode === "drill" && voiceMode && voiceAvailable)) && (
              <div>
                <label className="block text-sm font-semibold text-ink-900">Interviewer</label>
                <select
                  value={personaId}
                  onChange={(e) => setPersonaId(e.target.value)}
                  className="mt-2 rounded border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-ink-900"
                >
                  {taxonomy.personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.blurb}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {mode === "rapid" && (
              <div>
                <label className="block text-sm font-semibold text-ink-900">
                  Seconds per question
                </label>
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={secondsPerQuestion}
                  onChange={(e) => setSecondsPerQuestion(e.target.value)}
                  className="input mt-2 w-24 px-3 py-1.5"
                />
              </div>
            )}
          </section>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-bad">{error}</p>}

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-ink-600">{summaryLine}</p>
        {!canStart && !starting && (
          <p className="text-sm font-medium text-warn">
            {mode === "drill" ? "Pick at least one subtopic first" : "Pick at least one area first"}
          </p>
        )}
      </div>
      <button
        onClick={() => void start()}
        disabled={!canStart}
        className="btn btn-primary mt-3 w-full py-3"
      >
        {starting ? "Writing your first question…" : "Start session"}
      </button>
    </div>
  );
}

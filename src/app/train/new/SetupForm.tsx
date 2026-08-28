"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

export function SetupForm({ taxonomy }: { taxonomy: SetupTaxonomy }) {
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
  const [subtopicIds, setSubtopicIds] = useState<string[]>(
    prefillSubtopic ? [prefillSubtopic] : [],
  );
  const [areaIds, setAreaIds] = useState<string[]>(["acct", "ev", "val", "dcf", "mna", "lbo"]);
  const [difficulty, setDifficulty] = useState<number | "adaptive">(
    prefillDifficulty ? Number(prefillDifficulty) : "adaptive",
  );
  const [questionCount, setQuestionCount] = useState(mode === "rapid" ? 10 : 5);
  const [personaId, setPersonaId] = useState("quant");
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(45);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expandedAreas = useMemo(
    () => new Set(subtopicIds.map((s) => s.split(".")[0] ?? "")),
    [subtopicIds],
  );

  const start = async () => {
    setStarting(true);
    setError(null);
    const config = {
      subtopicIds: mode === "drill" ? subtopicIds : [],
      areaIds: mode === "drill" ? [] : areaIds,
      difficulty,
      questionCount: mode === "superday" ? 12 : questionCount,
      personaId: mode === "mock" || mode === "superday" ? personaId : null,
      secondsPerQuestion: mode === "rapid" ? secondsPerQuestion : null,
      rounds: mode === "superday" ? DEFAULT_SUPERDAY_ROUNDS : null,
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

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-100">New session</h1>

      {/* Mode cards */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODE_CARDS.map((card) => (
          <button
            key={card.mode}
            onClick={() => setMode(card.mode)}
            className={`rounded-lg border p-4 text-left transition ${
              mode === card.mode
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-slate-800 bg-slate-900 hover:border-slate-600"
            }`}
          >
            <div className="font-semibold text-slate-100">{card.title}</div>
            <div className="mt-1 text-sm text-slate-400">{card.blurb}</div>
          </button>
        ))}
      </div>

      {/* Mode-specific options */}
      <div className="mt-6 space-y-6 rounded-lg border border-slate-800 bg-slate-900 p-5">
        {mode === "drill" && (
          <section>
            <h3 className="text-sm font-semibold text-slate-200">Subtopics to drill</h3>
            <div className="mt-3 space-y-4">
              {taxonomy.areas.map((area) => (
                <details key={area.id} open={expandedAreas.has(area.id)}>
                  <summary className="cursor-pointer text-sm text-slate-300">
                    {area.name}
                    {area.tier === 1 && (
                      <span className="ml-2 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] uppercase text-indigo-300">
                        core
                      </span>
                    )}
                  </summary>
                  <div className="mt-2 grid grid-cols-1 gap-1.5 pl-4 sm:grid-cols-2">
                    {area.subtopics.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm text-slate-400">
                        <input
                          type="checkbox"
                          checked={subtopicIds.includes(s.id)}
                          onChange={() => toggle(subtopicIds, setSubtopicIds, s.id)}
                          className="accent-indigo-500"
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
            <h3 className="text-sm font-semibold text-slate-200">Areas in scope</h3>
            <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {taxonomy.areas.map((area) => (
                <label key={area.id} className="flex items-center gap-2 text-sm text-slate-400">
                  <input
                    type="checkbox"
                    checked={areaIds.includes(area.id)}
                    onChange={() => toggle(areaIds, setAreaIds, area.id)}
                    className="accent-indigo-500"
                  />
                  {area.name}
                  {area.tier === 1 && (
                    <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] uppercase text-indigo-300">
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
            <h3 className="text-sm font-semibold text-slate-200">Round plan</h3>
            <ol className="mt-3 space-y-2 text-sm text-slate-300">
              {DEFAULT_SUPERDAY_ROUNDS.map((round, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs">
                    {i + 1}
                  </span>
                  <span>
                    {taxonomy.areas.find((a) => a.id === round.focusAreaId)?.name ??
                      round.focusAreaId}{" "}
                    — {round.questionCount} questions with{" "}
                    <span className="text-slate-100">
                      {taxonomy.personas.find((p) => p.id === round.personaId)?.name ??
                        round.personaId}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-slate-500">
              Four back-to-back rounds, ~12 questions, one overall debrief. Difficulty adapts to
              your mastery.
            </p>
          </section>
        )}

        {mode !== "superday" && (
          <section className="flex flex-wrap items-end gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-200">Difficulty</label>
              <select
                value={String(difficulty)}
                onChange={(e) =>
                  setDifficulty(e.target.value === "adaptive" ? "adaptive" : Number(e.target.value))
                }
                className="mt-2 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200"
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
              <label className="block text-sm font-semibold text-slate-200">Questions</label>
              <input
                type="number"
                min={1}
                max={30}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="mt-2 w-24 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200"
              />
            </div>
            {mode === "mock" && (
              <div>
                <label className="block text-sm font-semibold text-slate-200">Interviewer</label>
                <select
                  value={personaId}
                  onChange={(e) => setPersonaId(e.target.value)}
                  className="mt-2 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200"
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
                <label className="block text-sm font-semibold text-slate-200">
                  Seconds per question
                </label>
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={secondsPerQuestion}
                  onChange={(e) => setSecondsPerQuestion(Number(e.target.value))}
                  className="mt-2 w-24 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200"
                />
              </div>
            )}
          </section>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

      <button
        onClick={() => void start()}
        disabled={!canStart}
        className="mt-6 w-full rounded bg-indigo-600 px-4 py-3 text-sm font-semibold hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {starting ? "Writing your first question…" : "Start session"}
      </button>
    </div>
  );
}

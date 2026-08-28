import type { Metadata } from "next";
import Link from "next/link";
import * as repo from "@/lib/db/repo";
import { ScoreBadge } from "@/components/ScoreBadge";
import type { Debrief } from "@/lib/llm/schemas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Session history" };

export default function HistoryPage() {
  // Learn sessions (lessons/spot-checks) live in the fix-it queue, not here.
  const sessions = repo.listSessions(100).filter((s) => s.mode !== "learn");
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-ink-900">Session history</h1>
      {sessions.length === 0 ? (
        <div className="card mx-auto mt-10 max-w-md p-6 text-center">
          <p className="text-sm font-semibold text-ink-900">Nothing yet</p>
          <p className="mt-1 text-sm text-ink-600">
            Every finished session lands here with its debrief and score.
          </p>
          <Link href="/train/new" className="btn btn-primary mt-4">
            Start your first session
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {sessions.map((s) => {
            const debrief = s.debriefJson as Debrief | null;
            return (
              <Link
                key={s.id}
                href={s.status === "active" ? `/train/${s.id}` : `/history/${s.id}`}
                className="card flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:border-primary"
              >
                <div>
                  {/* Friendly casing is CSS-only: the DOM text stays lowercase. */}
                  <div className="text-sm font-semibold capitalize text-ink-900">{s.mode}</div>
                  <div className="text-xs text-ink-400">
                    {new Date(s.startedAt).toLocaleString()} ·{" "}
                    <span className="uppercase">{s.status}</span>
                  </div>
                </div>
                {debrief && <ScoreBadge overall={debrief.overallScore} />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

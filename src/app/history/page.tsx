import Link from "next/link";
import * as repo from "@/lib/db/repo";
import { ScoreBadge } from "@/components/ScoreBadge";
import type { Debrief } from "@/lib/llm/schemas";

export const dynamic = "force-dynamic";

export default function HistoryPage() {
  const sessions = repo.listSessions(100);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-100">Session history</h1>
      {sessions.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          Nothing yet.{" "}
          <Link href="/train/new" className="text-indigo-400 hover:text-indigo-300">
            Start your first session →
          </Link>
        </p>
      ) : (
        <div className="mt-6 space-y-2">
          {sessions.map((s) => {
            const debrief = s.debriefJson as Debrief | null;
            return (
              <Link
                key={s.id}
                href={s.status === "active" ? `/train/${s.id}` : `/history/${s.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/50 px-5 py-3 hover:border-slate-600"
              >
                <div>
                  <div className="text-sm font-semibold capitalize text-slate-200">{s.mode}</div>
                  <div className="text-xs text-slate-500">
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

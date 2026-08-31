"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MINUTE_CHOICES = [30, 45, 60, 90, 120, 150, 180] as const;

function minuteLabel(m: number): string {
  if (m < 60) return `${m} minutes`;
  if (m % 60 === 0) return m === 60 ? "1 hour" : `${m / 60} hours`;
  return `${Math.floor(m / 60)}½ hours`;
}

/** Superday date + daily time budget; both drive the queue and pacing. */
export function BookletSettings({
  initial,
}: {
  initial: { superdayDate: string | null; dailyMinutes: number };
}) {
  const router = useRouter();
  const [superdayDate, setSuperdayDate] = useState(initial.superdayDate ?? "");
  const [dailyMinutes, setDailyMinutes] = useState(initial.dailyMinutes);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const dirty = (superdayDate || null) !== initial.superdayDate || dailyMinutes !== initial.dailyMinutes;

  async function save() {
    if (status === "saving") return;
    setStatus("saving");
    try {
      const res = await fetch("/api/booklet/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ superdayDate: superdayDate || null, dailyMinutes }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="card card-pad">
      <h2 className="section-label mb-3">Pacing</h2>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-ink-600">Superday date</span>
        <input
          type="date"
          className="input"
          value={superdayDate}
          onChange={(e) => {
            setSuperdayDate(e.target.value);
            setStatus("idle");
          }}
          data-testid="superday-date"
        />
      </label>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-xs font-medium text-ink-600">Daily time budget</span>
        <select
          className="input"
          value={dailyMinutes}
          onChange={(e) => {
            setDailyMinutes(Number(e.target.value));
            setStatus("idle");
          }}
        >
          {MINUTE_CHOICES.map((m) => (
            <option key={m} value={m}>
              {minuteLabel(m)}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="btn btn-secondary btn-sm" onClick={save} disabled={!dirty || status === "saving"}>
          {status === "saving" ? "Saving…" : "Save pacing"}
        </button>
        <span aria-live="polite" className="text-xs text-ink-400">
          {status === "saved" ? "Saved" : status === "error" ? "Couldn't save — try again." : ""}
        </span>
      </div>
    </div>
  );
}

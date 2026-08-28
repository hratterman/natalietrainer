"use client";

import { useEffect, useRef, useState } from "react";

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Count-up timer. Remount (via `key`) to reset. Reports elapsed ms on each
 * tick while `running`.
 */
export function CountUpTimer({
  running,
  onTick,
}: {
  running: boolean;
  onTick?: (elapsedMs: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    if (startRef.current === null) startRef.current = Date.now();
    const start = startRef.current;
    const iv = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(ms);
      onTick?.(ms);
    }, 250);
    return () => clearInterval(iv);
  }, [running, onTick]);

  return (
    <span className="font-mono text-sm text-slate-400" suppressHydrationWarning>
      {fmt(Math.floor(elapsed / 1000))}
    </span>
  );
}

/**
 * Hard countdown. Remount (via `key`) to reset. Fires onExpire once at zero.
 */
export function CountdownTimer({
  seconds,
  running,
  onExpire,
}: {
  seconds: number;
  running: boolean;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const deadlineRef = useRef<number | null>(null);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!running) return;
    if (deadlineRef.current === null) deadlineRef.current = Date.now() + seconds * 1000;
    const deadline = deadlineRef.current;
    const iv = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    }, 200);
    return () => clearInterval(iv);
  }, [running, seconds]);

  const urgent = remaining <= 10;
  return (
    <span
      className={`font-mono text-lg font-semibold ${urgent ? "text-rose-400" : "text-slate-200"}`}
      suppressHydrationWarning
    >
      {fmt(remaining)}
    </span>
  );
}

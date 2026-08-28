"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const PIN_LENGTH = 4;

export function PinPad({ from }: { from?: string }) {
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Only same-origin paths — never an off-site redirect target.
  const target = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";

  async function submit(pin: string) {
    setStatus("busy");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) throw new Error("wrong pin");
      router.replace(target);
      router.refresh();
    } catch {
      setDigits("");
      setStatus("error");
      // Scheduled here in the submit path (not an effect): clear the error
      // state after the shake has registered.
      setTimeout(() => {
        setStatus((s) => (s === "error" ? "idle" : s));
      }, 1600);
    }
  }

  function acceptDigits(next: string) {
    if (status === "busy") return;
    const clean = next.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setDigits(clean);
    if (status === "error" && clean.length > 0) setStatus("idle");
    if (clean.length === PIN_LENGTH) void submit(clean);
  }

  function pressKey(key: string) {
    inputRef.current?.focus();
    if (key === "back") acceptDigits(digits.slice(0, -1));
    else acceptDigits(digits + key);
  }

  return (
    <div>
      {/* Hidden input keeps hardware/mobile keyboards working. */}
      <input
        ref={inputRef}
        autoFocus
        inputMode="numeric"
        autoComplete="off"
        aria-label="PIN"
        value={digits}
        onChange={(e) => acceptDigits(e.target.value)}
        className="sr-only"
      />

      {/* Dots */}
      <div
        className={`flex justify-center gap-3 ${status === "error" ? "animate-pin-shake" : ""}`}
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border transition-colors ${
              i < digits.length
                ? "border-primary bg-primary"
                : "border-line-strong bg-surface-2"
            }`}
          />
        ))}
      </div>

      {/* Fixed-height slot so the layout doesn't jump when the error appears. */}
      <div className="mt-3 h-5" aria-live="polite">
        {status === "error" && (
          <p className="text-sm font-medium text-bad">Wrong PIN — try again</p>
        )}
      </div>

      {/* Keypad */}
      <div className="mx-auto mt-2 grid max-w-[220px] grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <KeypadButton key={d} label={d} onPress={() => pressKey(d)} disabled={status === "busy"} />
        ))}
        <span />
        <KeypadButton label="0" onPress={() => pressKey("0")} disabled={status === "busy"} />
        <KeypadButton label="⌫" ariaLabel="Delete" onPress={() => pressKey("back")} disabled={status === "busy"} />
      </div>

      <p className="mt-6 text-xs text-ink-400">
        {status === "busy" ? "Checking…" : "Four digits. Ask Henry if you've forgotten it."}
      </p>
    </div>
  );
}

function KeypadButton({
  label,
  onPress,
  disabled,
  ariaLabel,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      data-key={label === "⌫" ? "back" : label}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      // Keep focus on the hidden input so keyboard entry keeps working.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      className="h-12 rounded-control border border-line bg-surface-1 text-lg font-semibold text-ink-900 transition-colors hover:border-primary hover:bg-primary-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/50 disabled:opacity-45"
    >
      {label}
    </button>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { TOUR_COOKIE } from "@/lib/auth";
import { TOUR_STEPS, type TourStep } from "./steps";
import { TourOverlay, type SpotRect, type TooltipPos } from "./TourOverlay";
import { SparkIcon } from "../ui/icons";

const CARD_W = 320; // matches the overlay's w-80
const GAP = 14;
const MARGIN = 12;

type TourState = {
  view: "hidden" | "welcome" | "tour";
  steps: TourStep[];
  index: number;
  rect: SpotRect;
  pos: TooltipPos;
};

const HIDDEN: TourState = {
  view: "hidden",
  steps: [],
  index: 0,
  rect: { top: 0, left: 0, width: 0, height: 0 },
  pos: { top: 0, left: 0 },
};

/** Measure a step's anchor and compute the tooltip position — handlers only. */
function measureStep(step: TourStep): { rect: SpotRect; pos: TooltipPos } | null {
  const el = document.querySelector(`[data-tour="${step.anchor}"]`);
  if (!el) return null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "instant" });
  const r = el.getBoundingClientRect();
  const rect: SpotRect = { top: r.top, left: r.left, width: r.width, height: r.height };

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(x, MARGIN), vw - CARD_W - MARGIN);
  const centerX = clampX(r.left + r.width / 2 - CARD_W / 2);
  let pos: TooltipPos;
  switch (step.placement) {
    case "bottom":
      pos = { top: r.bottom + GAP, left: centerX };
      break;
    case "top":
      pos = { top: r.top - GAP, left: centerX, transform: "translateY(-100%)" };
      break;
    case "right":
      pos = { top: Math.min(Math.max(r.top, MARGIN), vh - 200), left: clampX(r.right + GAP) };
      break;
    case "left":
      pos = {
        top: Math.min(Math.max(r.top, MARGIN), vh - 200),
        left: clampX(r.left - GAP - CARD_W),
      };
      break;
  }
  // If the tooltip would fall off the bottom, flip above the anchor.
  if (step.placement === "bottom" && r.bottom + GAP + 260 > vh && r.top > 300) {
    pos = { top: r.top - GAP, left: centerX, transform: "translateY(-100%)" };
  }
  // Final guarantee: the whole card stays reachable even when the anchor is
  // taller than the viewport (e.g. a long fix-it queue).
  const CARD_H = 300;
  if (pos.transform === "translateY(-100%)") {
    pos.top = Math.min(Math.max(pos.top, CARD_H + MARGIN), vh - MARGIN);
  } else {
    pos.top = Math.min(Math.max(pos.top, MARGIN), vh - CARD_H);
  }
  return { rect, pos };
}

function markTourDone() {
  document.cookie = `${TOUR_COOKIE}=done; path=/; max-age=31536000; samesite=lax`;
}

export function TourLauncher({ autoStart }: { autoStart: boolean }) {
  const [state, setState] = useState<TourState>(() =>
    autoStart ? { ...HIDDEN, view: "welcome" } : HIDDEN,
  );
  // Handlers assign the ref directly (post-paint sync effects are too late for
  // the resize listener); see the setProofNow pattern in LearnRunner.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  function setStateNow(next: TourState) {
    stateRef.current = next;
    setState(next);
  }

  function showStep(steps: TourStep[], index: number) {
    const step = steps[index];
    if (!step) return finish();
    const measured = measureStep(step);
    if (!measured) return finish();
    setStateNow({ view: "tour", steps, index, ...measured });
  }

  function startTour() {
    const steps = TOUR_STEPS.filter((s) => document.querySelector(`[data-tour="${s.anchor}"]`));
    if (steps.length === 0) return finish();
    showStep(steps, 0);
  }

  function finish() {
    markTourDone();
    setStateNow(HIDDEN);
  }

  function remeasure() {
    const s = stateRef.current;
    if (s.view !== "tour") return;
    const step = s.steps[s.index];
    if (!step) return;
    const measured = measureStep(step);
    if (measured) setStateNow({ ...s, ...measured });
  }

  // Subscribe-only effect: keep the spotlight glued to its anchor.
  useEffect(() => {
    if (state.view !== "tour") return;
    const onMove = () => remeasure();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("resize", onMove, { passive: true });
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.view]);

  const step = state.steps[state.index];

  return (
    <>
      <button
        type="button"
        onClick={startTour}
        className="btn btn-ghost btn-sm mt-2 -ml-2 text-ink-400"
      >
        <SparkIcon />
        Tour
      </button>

      {state.view === "welcome" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/55 px-6">
          <div className="card w-full max-w-md p-7 text-center">
            <h2 className="text-xl font-bold tracking-tight text-ink-900">Welcome, Natalie</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-600">
              Hard technical questions, a real interviewer across the table, and honest scoring —
              and every session you run makes this dashboard smarter about what to train next.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button onClick={startTour} className="btn btn-primary">
                Show me around
              </button>
              <button onClick={finish} className="btn btn-ghost">
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {state.view === "tour" && step && (
        <TourOverlay
          rect={state.rect}
          pos={state.pos}
          title={step.title}
          body={step.body}
          index={state.index}
          count={state.steps.length}
          onBack={() => showStep(state.steps, state.index - 1)}
          onNext={() =>
            state.index >= state.steps.length - 1 ? finish() : showStep(state.steps, state.index + 1)
          }
          onSkip={finish}
        />
      )}
    </>
  );
}

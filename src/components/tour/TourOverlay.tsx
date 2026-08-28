"use client";

/**
 * Purely presentational spotlight: the launcher owns all measurement and
 * state; this renders a scrim with a cutout at `rect` and a tooltip at `pos`.
 */

export type SpotRect = { top: number; left: number; width: number; height: number };
export type TooltipPos = { top: number; left: number; transform?: string };

export function TourOverlay({
  rect,
  pos,
  title,
  body,
  index,
  count,
  onBack,
  onNext,
  onSkip,
}: {
  rect: SpotRect;
  pos: TooltipPos;
  title: string;
  body: string;
  index: number;
  count: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const last = index === count - 1;
  return (
    <div className="fixed inset-0 z-50">
      {/* Click-catcher over the dimmed page. */}
      <div className="absolute inset-0" onClick={onSkip} aria-hidden />
      {/* Spotlight cutout: one element, scrim via a huge box-shadow. */}
      <div
        className="pointer-events-none absolute rounded-card transition-all duration-200 motion-reduce:transition-none"
        style={{
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
          boxShadow: "0 0 0 9999px rgb(26 35 51 / 0.55)",
        }}
      />
      {/* Tooltip */}
      <div
        role="dialog"
        aria-label={title}
        className="card absolute w-80 p-5"
        style={{ top: pos.top, left: pos.left, transform: pos.transform }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-label">
          Step {index + 1} of {count}
        </div>
        <h3 className="mt-1 text-base font-bold text-ink-900">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{body}</p>
        <div className="mt-4 flex items-center gap-2">
          {index > 0 && (
            <button onClick={onBack} className="btn btn-ghost btn-sm">
              Back
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {!last && (
              <button onClick={onSkip} className="btn btn-ghost btn-sm">
                Skip
              </button>
            )}
            <button onClick={onNext} className="btn btn-primary btn-sm">
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

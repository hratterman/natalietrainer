export type TourStep = {
  id: string;
  /** Matches a data-tour attribute on the dashboard. */
  anchor: string;
  title: string;
  body: string;
  placement: "top" | "bottom" | "left" | "right";
};

/** Steps whose anchor is missing (e.g. no fix-its yet) are skipped at launch. */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "modes",
    anchor: "modes",
    title: "Four ways to train",
    body: "Topic drills for focused reps, mock interviews with follow-ups, rapid fire against the clock, and the full superday simulation — four rounds, four interviewers.",
    placement: "bottom",
  },
  {
    id: "mastery",
    anchor: "mastery",
    title: "Your mastery map",
    body: "Every subtopic in the IB canon, tinted by how you've been scoring. Green is solid, red needs work. Click any chip to drill exactly that.",
    placement: "right",
  },
  {
    id: "attack",
    anchor: "attack",
    title: "Attack next",
    body: "The topics most worth your next hour — weak, stale, or never tried. When in doubt, start at the top of this list.",
    placement: "left",
  },
  {
    id: "fixits",
    anchor: "fixits",
    title: "The fix-it queue",
    body: "Anything you get meaningfully wrong lands here. A coach reteaches it from your exact answer, then you prove it on fresh questions to clear it.",
    placement: "bottom",
  },
  {
    id: "nav",
    anchor: "nav",
    title: "Everything else",
    body: "History keeps every debrief. The lock signs you out. And when you start a session, look for the voice toggle — the interviewer can talk.",
    placement: "bottom",
  },
];

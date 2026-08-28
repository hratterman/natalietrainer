"use client";

import { useState } from "react";
import Link from "next/link";
import { RubricBars } from "./RubricBars";
import { ScoreBadge } from "./ScoreBadge";
import type { Tier } from "@/lib/score";

export type GradeView = {
  accuracy: number;
  completeness: number;
  structure: number;
  delivery?: number | null;
  overall: number;
  modelAnswer: string;
  strengths: string[];
  gaps: string[];
  corrections: string[];
  deliveryFeedback?: string[];
};

export function GradeCard({
  grade,
  defaultOpen = false,
  learnHref,
}: {
  grade: GradeView;
  defaultOpen?: boolean;
  /** When this graded miss has a fixit, links into the coach. */
  learnHref?: string | null;
}) {
  const [showModel, setShowModel] = useState(defaultOpen);
  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        <ScoreBadge overall={grade.overall} size="lg" />
        <div className="flex-1">
          <RubricBars
            accuracy={grade.accuracy}
            completeness={grade.completeness}
            structure={grade.structure}
            delivery={grade.delivery}
          />
        </div>
      </div>

      {learnHref && (
        <Link href={learnHref} className="btn btn-primary mt-4 w-full">
          Learn this properly with the coach →
        </Link>
      )}

      {grade.strengths.length > 0 && (
        <FeedbackList title="Strengths" items={grade.strengths} tier="good" />
      )}
      {grade.gaps.length > 0 && <FeedbackList title="Gaps" items={grade.gaps} tier="warn" />}
      {grade.corrections.length > 0 && (
        <FeedbackList title="Corrections" items={grade.corrections} tier="bad" />
      )}
      {grade.deliveryFeedback && grade.deliveryFeedback.length > 0 && (
        <FeedbackList title="Delivery" items={grade.deliveryFeedback} tier="ok" />
      )}

      <button
        onClick={() => setShowModel((v) => !v)}
        className="mt-4 text-sm font-medium text-primary hover:text-primary-strong"
      >
        {showModel ? "Hide model answer" : "Show model answer"}
      </button>
      {showModel && (
        <div className="mt-2 whitespace-pre-wrap rounded-control border border-line bg-surface-2 p-3 text-sm leading-relaxed text-ink-900">
          {grade.modelAnswer}
        </div>
      )}
    </div>
  );
}

const RULE: Record<Tier, string> = {
  good: "border-good/40",
  ok: "border-primary/40",
  warn: "border-warn/40",
  bad: "border-bad/40",
};
const TITLE: Record<Tier, string> = {
  good: "text-good",
  ok: "text-primary",
  warn: "text-warn",
  bad: "text-bad",
};

function FeedbackList({ title, items, tier }: { title: string; items: string[]; tier: Tier }) {
  return (
    <div className={`mt-4 border-l-2 pl-3 ${RULE[tier]}`}>
      <h4 className={`text-xs font-semibold uppercase tracking-wide ${TITLE[tier]}`}>{title}</h4>
      <ul className="mt-1 space-y-1 text-sm text-ink-900">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

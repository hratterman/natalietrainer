"use client";

import { useState } from "react";
import Link from "next/link";
import { RubricBars } from "./RubricBars";
import { ScoreBadge } from "./ScoreBadge";

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
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
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
        <Link
          href={learnHref}
          className="mt-4 block rounded border border-indigo-500/40 bg-indigo-500/10 px-4 py-2.5 text-center text-sm font-semibold text-indigo-300 hover:bg-indigo-500/20"
        >
          Learn this properly with the coach →
        </Link>
      )}

      {grade.strengths.length > 0 && (
        <FeedbackList title="Strengths" items={grade.strengths} tone="text-emerald-400" />
      )}
      {grade.gaps.length > 0 && (
        <FeedbackList title="Gaps" items={grade.gaps} tone="text-amber-400" />
      )}
      {grade.corrections.length > 0 && (
        <FeedbackList title="Corrections" items={grade.corrections} tone="text-rose-400" />
      )}
      {grade.deliveryFeedback && grade.deliveryFeedback.length > 0 && (
        <FeedbackList title="Delivery" items={grade.deliveryFeedback} tone="text-sky-400" />
      )}

      <button
        onClick={() => setShowModel((v) => !v)}
        className="mt-4 text-sm text-indigo-400 hover:text-indigo-300"
      >
        {showModel ? "Hide model answer" : "Show model answer"}
      </button>
      {showModel && (
        <div className="mt-2 whitespace-pre-wrap rounded border border-slate-800 bg-slate-950 p-3 text-sm leading-relaxed text-slate-300">
          {grade.modelAnswer}
        </div>
      )}
    </div>
  );
}

function FeedbackList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: string;
}) {
  return (
    <div className="mt-4">
      <h4 className={`text-xs font-semibold uppercase tracking-wide ${tone}`}>{title}</h4>
      <ul className="mt-1 space-y-1 text-sm text-slate-300">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-slate-600">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

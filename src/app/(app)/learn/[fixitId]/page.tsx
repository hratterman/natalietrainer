import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as repo from "@/lib/db/repo";
import { fixitView } from "@/lib/api/fixitView";
import { PROOF_PASSES_REQUIRED, proofPassed } from "@/lib/fixit";
import { voiceAvailable } from "@/lib/voice/openai";
import {
  LearnRunner,
  type LearnChatTurn,
  type LearnInitialState,
} from "@/components/LearnRunner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Coach" };

export default async function LearnPage({ params, searchParams }: PageProps<"/learn/[fixitId]">) {
  const { fixitId } = await params;
  const { early } = await searchParams;
  const fixit = repo.getFixit(fixitId);
  if (!fixit) notFound();

  const view = fixitView(fixit);
  const source = repo.getQuestion(fixit.sourceQuestionId);
  const checkEarly = early === "1" && fixit.status === "resolved" && fixit.nextCheckAt !== null;

  // Cleared or waiting states render simple status cards.
  if (fixit.status === "resolved" && fixit.nextCheckAt === null) {
    return (
      <StatusCard title={view.concept} subtitle={`${view.subtopicName} · cleared`}>
        <p className="text-sm text-good">
          Cleared for good — you proved this across spaced checks.
        </p>
        <BackLink />
      </StatusCard>
    );
  }
  if (fixit.status === "resolved" && !view.dueForCheck && !checkEarly) {
    return (
      <StatusCard title={view.concept} subtitle={`${view.subtopicName} · resolved`}>
        <p className="text-sm text-ink-900">
          Proven. A quick spot-check resurfaces{" "}
          {fixit.nextCheckAt ? `on ${fixit.nextCheckAt.toLocaleDateString()}` : "soon"} to make sure
          it stuck.
        </p>
        <Link
          href={`/learn/${fixit.id}?early=1`}
          className="btn btn-secondary mt-3"
        >
          Spot-check me now
        </Link>
        <BackLink />
      </StatusCard>
    );
  }

  const kind: LearnInitialState["kind"] = fixit.status === "resolved" ? "spotcheck" : "lesson";

  // Resumable lesson transcript + any in-flight proof question.
  let resume: LearnInitialState["resume"] = null;
  if (kind === "lesson" && fixit.lessonSessionId) {
    const session = repo.getSession(fixit.lessonSessionId);
    if (session && session.status === "active" && session.configJson.spotCheck !== true) {
      const anchor = repo.getSessionQuestions(session.id).find((q) => q.askedIndex === 0);
      if (anchor) {
        const turns: LearnChatTurn[] = repo.getTurns(anchor.id).map((t) => ({
          id: t.id,
          role: t.content.startsWith("[check result]")
            ? "system"
            : t.role === "interviewer"
              ? "coach"
              : "you",
          content: t.content.startsWith("[check result]")
            ? "Check missed — the coach knows what happened."
            : t.content,
        }));
        const active = repo.getActiveQuestion(session.id);
        // Rebuild proving progress so a refresh doesn't forget a pass (or
        // wrongly return to proving after a fail sent her back to the lesson).
        const gradedProofs = repo
          .getSessionQuestions(session.id)
          .filter((q) => q.askedIndex > 0)
          .map((q) => repo.getGrade(q.id))
          .filter((g) => g !== undefined);
        let passes = 0;
        for (let i = gradedProofs.length - 1; i >= 0; i--) {
          if (proofPassed(gradedProofs[i]!.overall)) passes++;
          else break;
        }
        const lastFailed =
          gradedProofs.length > 0 && !proofPassed(gradedProofs[gradedProofs.length - 1]!.overall);
        resume = {
          sessionId: session.id,
          anchorQuestionId: anchor.id,
          turns,
          activeProof:
            active && active.askedIndex > 0
              ? {
                  id: active.id,
                  promptText: active.promptText,
                  setupFactsJson: active.setupFactsJson,
                  difficulty: active.difficulty,
                }
              : null,
          passes,
          continueProving:
            (!active || active.askedIndex === 0) && gradedProofs.length > 0 && !lastFailed,
        };
      }
    }
  }

  const initial: LearnInitialState = {
    fixit: view,
    sourceQuestion: source
      ? { promptText: source.promptText, setupFacts: source.setupFactsJson }
      : null,
    kind,
    resume,
    proofTarget: PROOF_PASSES_REQUIRED,
    voiceAvailable: voiceAvailable(),
    voiceFake: process.env.VOICE_FAKE === "1",
  };

  return <LearnRunner initial={initial} />;
}

function StatusCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto mt-12 max-w-md card p-6">
      <h1 className="text-lg font-semibold text-ink-900">{title}</h1>
      <p className="mb-4 text-sm text-ink-400">{subtitle}</p>
      {children}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/" className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary-strong">
      ← Back to dashboard
    </Link>
  );
}


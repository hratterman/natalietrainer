import "server-only";
import * as repo from "@/lib/db/repo";
import { generateQuestion } from "@/lib/llm/generateQuestion";
import type { Grade } from "@/lib/llm/schemas";
import {
  afterSpotCheck,
  conceptFrom,
  firstCheckAt,
  PROOF_PASSES_REQUIRED,
  proofPassed,
} from "@/lib/fixit";
import { getSubtopic } from "@/content/taxonomy";
import type { NextQuestionResult } from "./engine";

/**
 * Learn-session orchestration: the Socratic lesson hangs off an ungraded
 * "anchor" question (a copy of the missed question at askedIndex 0); proof
 * questions are ordinary rows flowing through the normal answer/grade
 * pipeline. Learn sessions never run completeSession.
 */

/**
 * Repoint a fixit's lesson session, abandoning any still-active predecessor so
 * a stranded session can never hijack resume flows later.
 */
function repointLessonSession(fixit: repo.FixitRow, newSessionId: string): void {
  if (fixit.lessonSessionId && fixit.lessonSessionId !== newSessionId) {
    const prior = repo.getSession(fixit.lessonSessionId);
    if (prior && prior.status === "active") {
      repo.updateSessionStatus(prior.id, "abandoned");
    }
  }
  repo.setFixitLessonSession(fixit.id, newSessionId);
}

/**
 * Create the lesson session + anchor question for a fixit (idempotent per fixit).
 * `voiceMode` undefined means "don't touch" — a bare resume never resets an
 * existing lesson's voice setting.
 */
export function startLesson(
  fixit: repo.FixitRow,
  voiceMode?: boolean,
): { session: repo.SessionRow; anchor: repo.QuestionRow } {
  // Resume an active lesson if one exists.
  if (fixit.lessonSessionId) {
    const existing = repo.getSession(fixit.lessonSessionId);
    if (existing && existing.status === "active" && existing.configJson.spotCheck !== true) {
      const anchor = repo
        .getSessionQuestions(existing.id)
        .find((q) => q.askedIndex === 0);
      if (anchor) {
        if (voiceMode !== undefined && (existing.configJson.voiceMode === true) !== voiceMode) {
          repo.setSessionVoiceMode(existing.id, voiceMode);
          existing.configJson.voiceMode = voiceMode;
        }
        return { session: existing, anchor };
      }
    }
  }

  const source = repo.getQuestion(fixit.sourceQuestionId);
  if (!source) throw new Error(`fixit source question ${fixit.sourceQuestionId} not found`);

  const session = repo.createSession({
    mode: "learn",
    config: {
      subtopicIds: [fixit.subtopicId],
      areaIds: [],
      difficulty: fixit.difficulty,
      questionCount: PROOF_PASSES_REQUIRED,
      personaId: null,
      secondsPerQuestion: null,
      rounds: null,
      fixitId: fixit.id,
      voiceMode: voiceMode === true,
    },
  });
  // Anchor: a verbatim copy of the missed question. Never graded; the coach
  // chat's turns hang off it.
  const anchor = repo.createQuestion({
    sessionId: session.id,
    askedIndex: 0,
    subtopicId: source.subtopicId,
    archetypeId: source.archetypeId,
    difficulty: source.difficulty,
    promptText: source.promptText,
    setupFacts: source.setupFactsJson,
    summary: source.summary,
    expectedKeyPoints: source.expectedKeyPointsJson,
    answerFormat: source.answerFormat,
  });
  repointLessonSession(fixit, session.id);
  return { session, anchor };
}

/**
 * Create a 1-question spot-check session for a resolved fixit. `early` marks a
 * check taken ahead of its scheduled date: a pass then leaves the spaced
 * schedule untouched (a fail always reopens).
 */
export async function startSpotCheck(
  fixit: repo.FixitRow,
  opts: { early?: boolean } = {},
): Promise<{ session: repo.SessionRow; question: repo.QuestionRow }> {
  const session = repo.createSession({
    mode: "learn",
    config: {
      subtopicIds: [fixit.subtopicId],
      areaIds: [],
      difficulty: fixit.difficulty,
      questionCount: 1,
      personaId: null,
      secondsPerQuestion: null,
      rounds: null,
      fixitId: fixit.id,
      spotCheck: true,
      early: opts.early === true,
    },
  });
  repointLessonSession(fixit, session.id);
  const question = await generateProofQuestion(session, fixit, 0);
  return { session, question };
}

async function generateProofQuestion(
  session: repo.SessionRow,
  fixit: repo.FixitRow,
  askedIndex: number,
): Promise<repo.QuestionRow> {
  const source = repo.getQuestion(fixit.sourceQuestionId);
  const recentSummaries = [
    ...repo.getRecentQuestionSummaries(fixit.subtopicId),
    ...(source ? [source.summary] : []),
  ];
  const spec = await generateQuestion({
    subtopicId: fixit.subtopicId,
    archetypeId: fixit.archetypeId,
    difficulty: fixit.difficulty,
    recentSummaries,
  });
  return repo.createQuestion({
    sessionId: session.id,
    askedIndex,
    subtopicId: spec.subtopicId,
    archetypeId: spec.archetypeId,
    difficulty: spec.difficulty,
    promptText: spec.question.questionText,
    setupFacts: spec.question.setupFacts,
    summary: spec.question.summary,
    expectedKeyPoints: spec.question.expectedKeyPoints,
    answerFormat: spec.answerFormat,
  });
}

/** Trailing consecutive proof passes (most recent grades first, stop at a fail). */
function trailingPasses(sessionId: string, isSpotCheck: boolean): number {
  const graded = repo.getGradesForSession(sessionId).filter((g) => g.question.askedIndex > 0 || isSpotCheck);
  let passes = 0;
  for (let i = graded.length - 1; i >= 0; i--) {
    if (proofPassed(graded[i]!.overall)) passes++;
    else break;
  }
  return passes;
}

/** Learn-mode branch of engine.nextQuestion. */
export async function nextLearnQuestion(session: repo.SessionRow): Promise<NextQuestionResult> {
  const fixitId = session.configJson.fixitId;
  const fixit = fixitId ? repo.getFixit(fixitId) : undefined;
  if (!fixit) throw new Error(`learn session ${session.id} has no fixit`);
  const isSpotCheck = session.configJson.spotCheck === true;

  const active = repo.getActiveQuestion(session.id);
  if (active) {
    // The anchor going active means the lesson just ended: skip it (never graded)
    // and fall through to generate the first proof.
    if (!isSpotCheck && active.askedIndex === 0) {
      repo.updateQuestionStatus(active.id, "skipped");
    } else {
      return { done: false, question: active, roundIndex: null };
    }
  }

  if (isSpotCheck) {
    // One graded question decides a spot-check.
    const anyGraded = repo.getGradesForSession(session.id).length > 0;
    if (anyGraded) return { done: true };
  } else if (trailingPasses(session.id, isSpotCheck) >= PROOF_PASSES_REQUIRED) {
    return { done: true };
  }

  const askedIndex = repo.getSessionQuestions(session.id).length;
  const question = await generateProofQuestion(session, fixit, askedIndex);
  return { done: false, question, roundIndex: null };
}

/**
 * Closure hook, called from gradeAndRecord for learn-session grades.
 * Returns the fixit's id so the grade response can reference it.
 */
export function onLearnQuestionGraded(
  session: repo.SessionRow,
  question: repo.QuestionRow,
  grade: Grade,
): string | null {
  const fixitId = session.configJson.fixitId;
  const fixit = fixitId ? repo.getFixit(fixitId) : undefined;
  if (!fixit) return null;
  const isSpotCheck = session.configJson.spotCheck === true;
  const now = Date.now();
  const passed = proofPassed(grade.overall);

  if (isSpotCheck) {
    if (passed) {
      // An early check that passes proves nothing new about retention over
      // time — keep the existing spaced schedule instead of advancing it.
      if (session.configJson.early !== true) {
        const transition = afterSpotCheck(fixit.checkStage, true, now);
        if (transition.kind === "cleared") {
          repo.advanceFixitCheck(fixit.id, fixit.checkStage + 1, null);
        } else if (transition.kind === "advance") {
          repo.advanceFixitCheck(fixit.id, transition.checkStage, transition.nextCheckAt);
        }
      }
    } else {
      const subtopicName = getSubtopic(question.subtopicId)?.subtopic.name ?? question.subtopicId;
      repo.reopenFixit(fixit.id, {
        sourceQuestionId: question.id,
        concept: conceptFrom(grade, subtopicName),
        detail: { gaps: grade.gaps, corrections: grade.corrections },
      });
    }
    repo.updateSessionStatus(session.id, "completed");
    return fixit.id;
  }

  // Lesson proofs
  if (!passed) {
    repo.bumpFixitAttempts(fixit.id);
    // Tell the coach what happened so the lesson can resume with context.
    const anchor = repo.getSessionQuestions(session.id).find((q) => q.askedIndex === 0);
    if (anchor) {
      const summary = [
        `[check result] I scored ${Math.round(grade.overall)} on the check question.`,
        grade.gaps.length > 0 ? `What I missed: ${grade.gaps.join("; ")}` : "",
        grade.corrections.length > 0 ? grade.corrections.join(" ") : "",
      ]
        .filter(Boolean)
        .join(" ");
      repo.appendTurn({ questionId: anchor.id, role: "candidate", content: summary });
    }
    return fixit.id;
  }

  if (trailingPasses(session.id, false) >= PROOF_PASSES_REQUIRED) {
    repo.resolveFixit(fixit.id, firstCheckAt(now));
    repo.updateSessionStatus(session.id, "completed");
  }
  return fixit.id;
}

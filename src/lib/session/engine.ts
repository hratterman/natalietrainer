import "server-only";
import { AREAS, getSubtopic } from "@/content/taxonomy";
import * as repo from "@/lib/db/repo";
import type { Mode, SessionConfig } from "@/lib/db/schema";
import {
  clampDifficulty,
  pickSubtopic,
  rankWeaknesses,
  type SelectionCandidate,
} from "@/lib/mastery";
import { generateQuestion, generateRapidBatch } from "@/lib/llm/generateQuestion";
import { gradeQuestion } from "@/lib/llm/grade";
import { generateDebrief } from "@/lib/llm/debrief";
import type { Debrief, Grade } from "@/lib/llm/schemas";
import { conceptFrom, qualifiesAsMiss } from "@/lib/fixit";

/** Hard caps on interviewer follow-ups per question, by mode. */
export const FOLLOW_UP_CAPS: Record<Mode, number> = {
  mock: 3,
  drill: 1,
  rapid: 0,
  superday: 3,
  learn: 1,
};

/** Subtopics in scope for a session config. */
export function subtopicsInScope(config: SessionConfig): string[] {
  if (config.subtopicIds.length > 0) return config.subtopicIds;
  const areas =
    config.areaIds.length > 0 ? AREAS.filter((a) => config.areaIds.includes(a.id)) : AREAS;
  return areas.flatMap((a) => a.subtopics.map((s) => s.id));
}

/** Choose the next subtopic + difficulty for a session (adaptive or fixed). */
export function chooseTarget(
  config: SessionConfig,
  scopeSubtopicIds: string[],
  rand: () => number = Math.random,
): { subtopicId: string; difficulty: number } {
  const masteryRows = repo.getMasteryOverview();
  const byId = new Map(masteryRows.map((m) => [m.subtopicId, m]));
  const now = Date.now();

  const ranked = rankWeaknesses(
    scopeSubtopicIds.map((subtopicId) => {
      const m = byId.get(subtopicId);
      return {
        subtopicId,
        score: m ? m.score : null,
        lastAttemptAt: m ? m.lastAttemptAt.getTime() : null,
      };
    }),
    now,
  );
  const priorities = new Map(ranked.map((r) => [r.subtopicId, r.priority]));

  const candidates: SelectionCandidate[] = scopeSubtopicIds.flatMap((subtopicId) => {
    const ref = getSubtopic(subtopicId);
    if (!ref) return [];
    const m = byId.get(subtopicId);
    return [
      {
        subtopicId,
        priority: priorities.get(subtopicId) ?? 1,
        areaWeight: ref.area.weight,
        score: m ? m.score : null,
      },
    ];
  });

  const subtopicId = pickSubtopic(candidates, rand) ?? scopeSubtopicIds[0];
  if (!subtopicId) throw new Error("session has no subtopics in scope");

  const difficulty =
    config.difficulty === "adaptive"
      ? clampDifficulty(byId.get(subtopicId)?.currentDifficulty ?? 2)
      : clampDifficulty(config.difficulty);

  return { subtopicId, difficulty: Math.round(difficulty) };
}

/** Which superday round a given asked-index falls into. */
export function roundForIndex(
  roundPlan: NonNullable<SessionConfig["rounds"]>,
  askedIndex: number,
): { roundIndex: number; withinRound: number } | null {
  let cumulative = 0;
  for (let i = 0; i < roundPlan.length; i++) {
    const count = roundPlan[i]!.questionCount;
    if (askedIndex < cumulative + count) {
      return { roundIndex: i, withinRound: askedIndex - cumulative };
    }
    cumulative += count;
  }
  return null;
}

export type NextQuestionResult =
  | { done: true }
  | { done: false; question: repo.QuestionRow; roundIndex: number | null };

/**
 * In-flight de-duplication: concurrent nextQuestion/completeSession calls for
 * the same session (double-click, two tabs) share one promise instead of
 * interleaving at LLM awaits and creating duplicate questions/debriefs.
 */
const inFlight = new Map<string, Promise<unknown>>();

function dedupeInFlight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = run().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

/**
 * Generate and persist the next question for a session, or report the session
 * is out of questions. No-op if a question is already active. Concurrent
 * calls for one session coalesce.
 */
export function nextQuestion(sessionId: string): Promise<NextQuestionResult> {
  return dedupeInFlight(`next:${sessionId}`, () => nextQuestionInner(sessionId));
}

async function nextQuestionInner(sessionId: string): Promise<NextQuestionResult> {
  const session = repo.getSession(sessionId);
  if (!session) throw new Error(`session ${sessionId} not found`);
  if (session.mode === "learn") {
    const { nextLearnQuestion } = await import("./learn");
    return nextLearnQuestion(session);
  }
  const config = session.configJson;

  const existing = repo.getActiveQuestion(sessionId);
  if (existing) {
    const round = existing.roundId
      ? repo.getRounds(sessionId).find((r) => r.id === existing.roundId)
      : undefined;
    return { done: false, question: existing, roundIndex: round?.roundIndex ?? null };
  }

  const asked = repo.getSessionQuestions(sessionId);
  const askedIndex = asked.length;

  const totalPlanned =
    session.mode === "superday" && config.rounds
      ? config.rounds.reduce((n, r) => n + r.questionCount, 0)
      : config.questionCount;
  if (askedIndex >= totalPlanned) return { done: true };

  let roundId: string | null = null;
  let roundIndex: number | null = null;
  let scope = subtopicsInScope(config);

  if (session.mode === "superday" && config.rounds) {
    const at = roundForIndex(config.rounds, askedIndex);
    if (!at) return { done: true };
    const round = repo.getRounds(sessionId)[at.roundIndex];
    roundId = round?.id ?? null;
    roundIndex = at.roundIndex;
    const focusAreaId = config.rounds[at.roundIndex]!.focusAreaId;
    const area = AREAS.find((a) => a.id === focusAreaId);
    scope = area ? area.subtopics.map((s) => s.id) : scope;
  }

  const target = chooseTarget(config, scope);
  const spec = await generateQuestion({
    subtopicId: target.subtopicId,
    difficulty: target.difficulty,
    recentSummaries: repo.getRecentQuestionSummaries(target.subtopicId),
  });

  // Re-check after the LLM await: another request may have raced past the
  // in-flight lock boundary (e.g. an older deploy) or a question landed some
  // other way — never leave two active questions.
  const nowActive = repo.getActiveQuestion(sessionId);
  if (nowActive) {
    const round = nowActive.roundId
      ? repo.getRounds(sessionId).find((r) => r.id === nowActive.roundId)
      : undefined;
    return { done: false, question: nowActive, roundIndex: round?.roundIndex ?? null };
  }

  const question = repo.createQuestion({
    sessionId,
    roundId,
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
  return { done: false, question, roundIndex };
}

/**
 * Create a session and seed its first question (or full rapid batch). If
 * seeding fails, the session is marked abandoned so it can never surface as
 * an unfinishable "resume me" ghost.
 */
export async function startSession(mode: Mode, config: SessionConfig): Promise<repo.SessionRow> {
  const session = repo.createSession({ mode, config });
  try {
    await seedSession(session.id, mode, config);
  } catch (err) {
    repo.updateSessionStatus(session.id, "abandoned");
    throw err;
  }
  return repo.getSession(session.id)!;
}

async function seedSession(sessionId: string, mode: Mode, config: SessionConfig): Promise<void> {
  if (mode === "rapid") {
    const scope = subtopicsInScope(config);
    const recent = scope.flatMap((s) => repo.getRecentQuestionSummaries(s, 5));
    const difficulty =
      config.difficulty === "adaptive" ? 3 : clampDifficulty(config.difficulty);
    const specs = await generateRapidBatch({
      subtopicIds: scope,
      count: config.questionCount,
      difficulty,
      recentSummaries: recent,
    });
    specs.forEach((spec, i) => {
      repo.createQuestion({
        sessionId,
        askedIndex: i,
        subtopicId: spec.subtopicId,
        archetypeId: spec.archetypeId,
        difficulty: spec.difficulty,
        promptText: spec.question.questionText,
        setupFacts: spec.question.setupFacts,
        summary: spec.question.summary,
        expectedKeyPoints: spec.question.expectedKeyPoints,
        answerFormat: spec.answerFormat,
      });
    });
  } else {
    const first = await nextQuestion(sessionId);
    if (first.done) throw new Error("session could not seed a first question");
  }
}

/** The persona actually interviewing this question (superday rounds override the session default). */
export function personaIdForQuestion(
  session: repo.SessionRow,
  question: repo.QuestionRow,
): string | null {
  if (question.roundId) {
    const round = repo.getRounds(session.id).find((r) => r.id === question.roundId);
    if (round) return round.personaId;
  }
  return session.configJson.personaId;
}

/**
 * Count real interviewer follow-ups on a question. Canned interjections and
 * the spoken question opening don't consume the follow-up budget.
 */
export function followUpsUsed(questionId: string): number {
  return repo
    .getTurns(questionId)
    .filter(
      (t) => t.role === "interviewer" && t.interruption !== "interjection" && t.turnIndex > 0,
    ).length;
}

export type GradeResult = Grade & { alreadyGraded: boolean; fixitId: string | null };

/**
 * Grade an answered question, persist the grade + mastery update, and — for
 * qualifying misses in playable modes — record a fixit in the learn queue.
 */
export async function gradeAndRecord(questionId: string): Promise<GradeResult> {
  const existing = repo.getGrade(questionId);
  if (existing) {
    return {
      accuracy: existing.accuracy,
      completeness: existing.completeness,
      structure: existing.structure,
      delivery: existing.delivery,
      overall: existing.overall,
      modelAnswer: existing.modelAnswer,
      strengths: existing.feedbackJson.strengths,
      gaps: existing.feedbackJson.gaps,
      corrections: existing.feedbackJson.corrections,
      deliveryFeedback: existing.feedbackJson.delivery ?? [],
      missedConcept: null,
      alreadyGraded: true,
      fixitId: repo.getFixitBySourceQuestion(questionId)?.id ?? null,
    };
  }
  const question = repo.getQuestion(questionId);
  if (!question) throw new Error(`question ${questionId} not found`);
  const session = repo.getSession(question.sessionId);
  const turns = repo.getTurns(questionId);
  // Spoken vs typed is decided per-transcript, not from session config: voice
  // can drop mid-session, and typed answers must never be delivery-graded.
  const voice = turns.some((t) => t.role === "candidate" && t.deliveryMetricsJson != null);
  const grade = await gradeQuestion(question, turns, voice);
  try {
    repo.recordGrade({
      questionId,
      accuracy: grade.accuracy,
      completeness: grade.completeness,
      structure: grade.structure,
      delivery: voice ? grade.delivery : null,
      overall: grade.overall,
      modelAnswer: grade.modelAnswer,
      feedback: {
        strengths: grade.strengths,
        gaps: grade.gaps,
        corrections: grade.corrections,
        ...(voice && grade.deliveryFeedback.length > 0 ? { delivery: grade.deliveryFeedback } : {}),
      },
    });
  } catch (err) {
    // Concurrent grade of the same question: the UNIQUE(questionId) constraint
    // makes the second insert lose — return the winner's grade instead.
    const raced = repo.getGrade(questionId);
    if (!raced) throw err;
    return gradeAndRecord(questionId);
  }

  let fixitId: string | null = null;
  if (session?.mode === "learn") {
    const { onLearnQuestionGraded } = await import("./learn");
    fixitId = onLearnQuestionGraded(session, question, grade);
  } else if (qualifiesAsMiss(grade)) {
    const subtopicName = getSubtopic(question.subtopicId)?.subtopic.name ?? question.subtopicId;
    const fixit = repo.upsertFixitForMiss({
      sourceQuestionId: question.id,
      subtopicId: question.subtopicId,
      archetypeId: question.archetypeId,
      difficulty: question.difficulty,
      concept: conceptFrom(grade, subtopicName),
      detail: { gaps: grade.gaps, corrections: grade.corrections },
    });
    fixitId = fixit.id;
  }
  return { ...grade, alreadyGraded: false, fixitId };
}

/**
 * Complete a session: grade any answered-but-ungraded questions (rapid-fire
 * batch grading), mark stragglers skipped, produce and store the debrief.
 */
export function completeSession(sessionId: string): Promise<Debrief> {
  return dedupeInFlight(`complete:${sessionId}`, () => completeSessionInner(sessionId));
}

const EMPTY_DEBRIEF: Debrief = {
  overallScore: 0,
  byArea: [],
  topStrengths: [],
  topWeaknesses: [],
  drillPlan: [],
};

async function completeSessionInner(sessionId: string): Promise<Debrief> {
  const session = repo.getSession(sessionId);
  if (!session) throw new Error(`session ${sessionId} not found`);
  if (session.mode === "learn") {
    // Learn sessions close via the fixit lifecycle — grading the lesson's
    // anchor (the coach chat) would poison mastery.
    throw new Error("learn sessions are completed by the fixit lifecycle, not /complete");
  }

  for (const q of repo.getSessionQuestions(sessionId)) {
    if (q.status === "answered") {
      await gradeAndRecord(q.id);
    } else if (q.status === "active") {
      const turns = repo.getTurns(q.id);
      if (turns.some((t) => t.role === "candidate")) {
        await gradeAndRecord(q.id);
      } else {
        repo.updateQuestionStatus(q.id, "skipped");
      }
    }
  }

  const graded = repo.getGradesForSession(sessionId);
  // Nothing answered: don't ask the LLM to hallucinate a debrief from nothing.
  const debrief = graded.length === 0 ? EMPTY_DEBRIEF : await generateDebrief(graded);
  repo.saveSessionDebrief(sessionId, debrief);
  return debrief;
}

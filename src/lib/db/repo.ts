import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import {
  grades,
  mastery,
  questions,
  rounds,
  sessions,
  turns,
  type GradeFeedback,
  type Mode,
  type QuestionStatus,
  type SessionConfig,
  type SessionStatus,
} from "./schema";
import { applyGrade, initialMasteryState, type MasteryState } from "@/lib/mastery";

export type SessionRow = typeof sessions.$inferSelect;
export type RoundRow = typeof rounds.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;
export type TurnRow = typeof turns.$inferSelect;
export type GradeRow = typeof grades.$inferSelect;
export type MasteryRow = typeof mastery.$inferSelect;

const id = () => crypto.randomUUID();

export function createSession(input: {
  mode: Mode;
  config: SessionConfig;
}): SessionRow {
  const db = getDb();
  const row: typeof sessions.$inferInsert = {
    id: id(),
    mode: input.mode,
    status: "active",
    configJson: input.config,
    startedAt: new Date(),
  };
  db.insert(sessions).values(row).run();
  if (input.mode === "superday" && input.config.rounds) {
    input.config.rounds.forEach((round, i) => {
      db.insert(rounds)
        .values({
          id: id(),
          sessionId: row.id,
          roundIndex: i,
          personaId: round.personaId,
          focusAreaId: round.focusAreaId,
        })
        .run();
    });
  }
  return getSession(row.id)!;
}

export function getSession(sessionId: string): SessionRow | undefined {
  return getDb().select().from(sessions).where(eq(sessions.id, sessionId)).get();
}

export function updateSessionStatus(sessionId: string, status: SessionStatus): void {
  getDb()
    .update(sessions)
    .set({ status, completedAt: status === "completed" ? new Date() : null })
    .where(eq(sessions.id, sessionId))
    .run();
}

export function saveSessionDebrief(sessionId: string, debrief: unknown): void {
  getDb()
    .update(sessions)
    .set({ debriefJson: debrief, status: "completed", completedAt: new Date() })
    .where(eq(sessions.id, sessionId))
    .run();
}

export function listSessions(limit = 50): SessionRow[] {
  return getDb().select().from(sessions).orderBy(desc(sessions.startedAt)).limit(limit).all();
}

export function getRounds(sessionId: string): RoundRow[] {
  return getDb()
    .select()
    .from(rounds)
    .where(eq(rounds.sessionId, sessionId))
    .orderBy(asc(rounds.roundIndex))
    .all();
}

export function saveRoundDebrief(roundId: string, debrief: unknown): void {
  getDb().update(rounds).set({ debriefJson: debrief }).where(eq(rounds.id, roundId)).run();
}

export function createQuestion(input: {
  sessionId: string;
  roundId?: string | null;
  askedIndex: number;
  subtopicId: string;
  archetypeId: string;
  difficulty: number;
  promptText: string;
  setupFacts: string[];
  summary: string;
  expectedKeyPoints: string[];
  answerFormat: string;
}): QuestionRow {
  const db = getDb();
  const row: typeof questions.$inferInsert = {
    id: id(),
    sessionId: input.sessionId,
    roundId: input.roundId ?? null,
    askedIndex: input.askedIndex,
    subtopicId: input.subtopicId,
    archetypeId: input.archetypeId,
    difficulty: input.difficulty,
    promptText: input.promptText,
    setupFactsJson: input.setupFacts,
    summary: input.summary,
    expectedKeyPointsJson: input.expectedKeyPoints,
    answerFormat: input.answerFormat,
    status: "active",
    createdAt: new Date(),
  };
  db.insert(questions).values(row).run();
  return db.select().from(questions).where(eq(questions.id, row.id)).get()!;
}

export function getQuestion(questionId: string): QuestionRow | undefined {
  return getDb().select().from(questions).where(eq(questions.id, questionId)).get();
}

export function getSessionQuestions(sessionId: string): QuestionRow[] {
  return getDb()
    .select()
    .from(questions)
    .where(eq(questions.sessionId, sessionId))
    .orderBy(asc(questions.askedIndex))
    .all();
}

export function updateQuestionStatus(questionId: string, status: QuestionStatus): void {
  getDb().update(questions).set({ status }).where(eq(questions.id, questionId)).run();
}

/** Recent question fingerprints for a subtopic — the anti-repetition seed. */
export function getRecentQuestionSummaries(subtopicId: string, limit = 15): string[] {
  return getDb()
    .select({ summary: questions.summary })
    .from(questions)
    .where(eq(questions.subtopicId, subtopicId))
    .orderBy(desc(questions.createdAt))
    .limit(limit)
    .all()
    .map((r) => r.summary);
}

export function appendTurn(input: {
  questionId: string;
  role: "interviewer" | "candidate";
  content: string;
  scratchpad?: string | null;
  elapsedMs?: number | null;
}): TurnRow {
  const db = getDb();
  const existing = db
    .select({ turnIndex: turns.turnIndex })
    .from(turns)
    .where(eq(turns.questionId, input.questionId))
    .orderBy(desc(turns.turnIndex))
    .limit(1)
    .get();
  const row: typeof turns.$inferInsert = {
    id: id(),
    questionId: input.questionId,
    turnIndex: (existing?.turnIndex ?? -1) + 1,
    role: input.role,
    content: input.content,
    scratchpad: input.scratchpad ?? null,
    elapsedMs: input.elapsedMs ?? null,
    createdAt: new Date(),
  };
  db.insert(turns).values(row).run();
  return db.select().from(turns).where(eq(turns.id, row.id)).get()!;
}

export function getTurns(questionId: string): TurnRow[] {
  return getDb()
    .select()
    .from(turns)
    .where(eq(turns.questionId, questionId))
    .orderBy(asc(turns.turnIndex))
    .all();
}

export function recordGrade(input: {
  questionId: string;
  accuracy: number;
  completeness: number;
  structure: number;
  overall: number;
  modelAnswer: string;
  feedback: GradeFeedback;
}): GradeRow {
  const db = getDb();
  const question = getQuestion(input.questionId);
  if (!question) throw new Error(`question ${input.questionId} not found`);

  const row: typeof grades.$inferInsert = {
    id: id(),
    questionId: input.questionId,
    accuracy: input.accuracy,
    completeness: input.completeness,
    structure: input.structure,
    overall: input.overall,
    modelAnswer: input.modelAnswer,
    feedbackJson: input.feedback,
    gradedAt: new Date(),
  };
  db.insert(grades).values(row).run();
  updateQuestionStatus(input.questionId, "graded");
  refreshMasteryForSubtopic(question.subtopicId);
  return db.select().from(grades).where(eq(grades.id, row.id)).get()!;
}

export function getGrade(questionId: string): GradeRow | undefined {
  return getDb().select().from(grades).where(eq(grades.questionId, questionId)).get();
}

export function getGradesForSession(sessionId: string): (GradeRow & { question: QuestionRow })[] {
  const db = getDb();
  const qs = getSessionQuestions(sessionId);
  if (qs.length === 0) return [];
  const gs = db
    .select()
    .from(grades)
    .where(
      inArray(
        grades.questionId,
        qs.map((q) => q.id),
      ),
    )
    .all();
  return gs
    .map((g) => ({ ...g, question: qs.find((q) => q.id === g.questionId)! }))
    .sort((a, b) => a.question.askedIndex - b.question.askedIndex);
}

/**
 * Recompute one subtopic's mastery state by replaying its full grade history
 * (already including the just-recorded grade). Grade counts per subtopic are
 * tiny for a single user, and replaying guarantees the incremental path always
 * matches rebuildMastery().
 */
function refreshMasteryForSubtopic(subtopicId: string): void {
  const db = getDb();
  const history = db
    .select({ overall: grades.overall, difficulty: questions.difficulty, gradedAt: grades.gradedAt })
    .from(grades)
    .innerJoin(questions, eq(grades.questionId, questions.id))
    .where(eq(questions.subtopicId, subtopicId))
    .orderBy(asc(grades.gradedAt))
    .all();
  if (history.length === 0) return;
  let state: MasteryState = initialMasteryState(history[0]!.gradedAt.getTime());
  for (const g of history) {
    state = applyGrade(state, g.overall, g.difficulty, g.gradedAt.getTime());
  }
  const values = {
    subtopicId,
    score: state.score,
    attempts: state.attempts,
    currentDifficulty: state.currentDifficulty,
    lastAttemptAt: new Date(state.lastAttemptAt),
  };
  const existing = db.select().from(mastery).where(eq(mastery.subtopicId, subtopicId)).get();
  if (existing) {
    db.update(mastery).set(values).where(eq(mastery.subtopicId, subtopicId)).run();
  } else {
    db.insert(mastery).values(values).run();
  }
}

export function getMasteryOverview(): MasteryRow[] {
  return getDb().select().from(mastery).all();
}

export function getMasteryForSubtopic(subtopicId: string): MasteryRow | undefined {
  return getDb().select().from(mastery).where(eq(mastery.subtopicId, subtopicId)).get();
}

/**
 * Recompute the whole mastery table from grades+questions from scratch.
 * Used by tests and as a repair tool.
 */
export function rebuildMastery(): void {
  const db = getDb();
  db.delete(mastery).run();
  const all = db
    .select({
      subtopicId: questions.subtopicId,
      difficulty: questions.difficulty,
      overall: grades.overall,
      gradedAt: grades.gradedAt,
    })
    .from(grades)
    .innerJoin(questions, eq(grades.questionId, questions.id))
    .orderBy(asc(grades.gradedAt))
    .all();
  const states = new Map<string, MasteryState>();
  for (const g of all) {
    const now = g.gradedAt.getTime();
    const state = states.get(g.subtopicId) ?? initialMasteryState(now);
    states.set(g.subtopicId, applyGrade(state, g.overall, g.difficulty, now));
  }
  for (const [subtopicId, state] of states) {
    db.insert(mastery)
      .values({
        subtopicId,
        score: state.score,
        attempts: state.attempts,
        currentDifficulty: state.currentDifficulty,
        lastAttemptAt: new Date(state.lastAttemptAt),
      })
      .run();
  }
}

export type SessionWithTranscript = {
  session: SessionRow;
  rounds: RoundRow[];
  questions: (QuestionRow & { turns: TurnRow[]; grade: GradeRow | undefined })[];
};

export function getSessionWithTranscript(sessionId: string): SessionWithTranscript | undefined {
  const session = getSession(sessionId);
  if (!session) return undefined;
  const qs = getSessionQuestions(sessionId);
  return {
    session,
    rounds: getRounds(sessionId),
    questions: qs.map((q) => ({
      ...q,
      turns: getTurns(q.id),
      grade: getGrade(q.id),
    })),
  };
}

/**
 * The current question of a session: the lowest-index question still active.
 * (Rapid-fire creates its whole batch upfront, so "current" is the first
 * unanswered one.)
 */
export function getActiveQuestion(sessionId: string): QuestionRow | undefined {
  return getDb()
    .select()
    .from(questions)
    .where(and(eq(questions.sessionId, sessionId), eq(questions.status, "active")))
    .orderBy(asc(questions.askedIndex))
    .get();
}

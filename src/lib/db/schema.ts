import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const MODES = ["drill", "mock", "rapid", "superday"] as const;
export type Mode = (typeof MODES)[number];

export const SESSION_STATUSES = ["active", "completed", "abandoned"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const QUESTION_STATUSES = ["active", "answered", "graded", "skipped"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

/** Per-mode session configuration, stored as JSON on the session row. */
export type SessionConfig = {
  /** Subtopic ids in scope; empty means "adaptive across configured areas". */
  subtopicIds: string[];
  /** Area ids in scope (used when subtopicIds is empty). */
  areaIds: string[];
  /** Fixed difficulty, or "adaptive" to follow per-subtopic mastery. */
  difficulty: number | "adaptive";
  questionCount: number;
  personaId: string | null;
  /** Rapid-fire only: hard per-question countdown. */
  secondsPerQuestion: number | null;
  /** Superday only: the round plan. */
  rounds:
    | {
        personaId: string;
        focusAreaId: string;
        questionCount: number;
      }[]
    | null;
};

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  mode: text("mode").$type<Mode>().notNull(),
  status: text("status").$type<SessionStatus>().notNull().default("active"),
  configJson: text("config_json", { mode: "json" }).$type<SessionConfig>().notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  debriefJson: text("debrief_json", { mode: "json" }),
});

export const rounds = sqliteTable("rounds", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  roundIndex: integer("round_index").notNull(),
  personaId: text("persona_id").notNull(),
  focusAreaId: text("focus_area_id").notNull(),
  debriefJson: text("debrief_json", { mode: "json" }),
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  roundId: text("round_id").references(() => rounds.id),
  askedIndex: integer("asked_index").notNull(),
  subtopicId: text("subtopic_id").notNull(),
  archetypeId: text("archetype_id").notNull(),
  difficulty: integer("difficulty").notNull(),
  promptText: text("prompt_text").notNull(),
  setupFactsJson: text("setup_facts_json", { mode: "json" }).$type<string[]>().notNull(),
  /** One-line fingerprint used as the anti-repetition seed for future generation. */
  summary: text("summary").notNull(),
  expectedKeyPointsJson: text("expected_key_points_json", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  answerFormat: text("answer_format").notNull(),
  status: text("status").$type<QuestionStatus>().notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const turns = sqliteTable("turns", {
  id: text("id").primaryKey(),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id),
  turnIndex: integer("turn_index").notNull(),
  role: text("role").$type<"interviewer" | "candidate">().notNull(),
  content: text("content").notNull(),
  /** Candidate turns only: the math scratchpad contents at submit time. */
  scratchpad: text("scratchpad"),
  elapsedMs: integer("elapsed_ms"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export type GradeFeedback = {
  strengths: string[];
  gaps: string[];
  corrections: string[];
};

export const grades = sqliteTable("grades", {
  id: text("id").primaryKey(),
  questionId: text("question_id")
    .notNull()
    .unique()
    .references(() => questions.id),
  accuracy: real("accuracy").notNull(),
  completeness: real("completeness").notNull(),
  structure: real("structure").notNull(),
  overall: real("overall").notNull(),
  modelAnswer: text("model_answer").notNull(),
  feedbackJson: text("feedback_json", { mode: "json" }).$type<GradeFeedback>().notNull(),
  gradedAt: integer("graded_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Rollup cache of per-subtopic mastery. Rebuildable from grades + questions
 * via repo.rebuildMastery().
 */
export const mastery = sqliteTable("mastery", {
  subtopicId: text("subtopic_id").primaryKey(),
  /** 0–1 EWMA of difficulty-weighted grade scores. */
  score: real("score").notNull(),
  attempts: integer("attempts").notNull(),
  currentDifficulty: real("current_difficulty").notNull(),
  lastAttemptAt: integer("last_attempt_at", { mode: "timestamp_ms" }).notNull(),
});

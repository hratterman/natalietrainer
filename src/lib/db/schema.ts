import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const MODES = ["drill", "mock", "rapid", "superday", "learn"] as const;
export type Mode = (typeof MODES)[number];

/** Modes a user can start from the setup screen. Learn sessions are created only via fixit routes. */
export const PLAYABLE_MODES = ["drill", "mock", "rapid", "superday"] as const;

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
  /** Spoken interview (mic in, interviewer voice out). Absent on old rows = false. */
  voiceMode?: boolean;
  /** Learn sessions only: the fixit this lesson/check belongs to. */
  fixitId?: string;
  /** Learn sessions only: a 1-question spaced spot-check (no lesson/anchor). */
  spotCheck?: boolean;
  /** Spot-checks only: taken ahead of schedule — a pass keeps the existing spacing. */
  early?: boolean;
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

/** How a spoken turn related to an interruption, if at all. */
export const INTERRUPTIONS = ["cut_off", "barge_in", "interjection"] as const;
export type Interruption = (typeof INTERRUPTIONS)[number];

export type DeliveryMetricsStored = {
  wordCount: number;
  wpm: number | null;
  fillerCount: number;
  hedgeCount: number;
  pauseCount: number;
  longestPauseMs: number;
};

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
  /**
   * cut_off = candidate turn ended by an interviewer interjection;
   * barge_in = candidate turn began by talking over the interviewer;
   * interjection = interviewer canned cut-off line.
   */
  interruption: text("interruption").$type<Interruption>(),
  /** Spoken turns: total speaking time from VAD segments. */
  audioDurationMs: integer("audio_duration_ms"),
  /** Spoken candidate turns: server-computed delivery signals. */
  deliveryMetricsJson: text("delivery_metrics_json", { mode: "json" }).$type<DeliveryMetricsStored>(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export type GradeFeedback = {
  strengths: string[];
  gaps: string[];
  corrections: string[];
  /** Spoken answers only: feedback on framing, fillers, pace, composure. */
  delivery?: string[];
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
  /** Spoken answers only (0–10); null for typed answers. */
  delivery: real("delivery"),
  overall: real("overall").notNull(),
  modelAnswer: text("model_answer").notNull(),
  feedbackJson: text("feedback_json", { mode: "json" }).$type<GradeFeedback>().notNull(),
  gradedAt: integer("graded_at", { mode: "timestamp_ms" }).notNull(),
});

export const FIXIT_STATUSES = ["open", "resolved"] as const;
export type FixitStatus = (typeof FIXIT_STATUSES)[number];

/**
 * A missed concept in the fix-it queue. Lifecycle:
 * open → (lesson + 2 consecutive proof passes) → resolved with nextCheckAt=+2d
 * → spot-check pass → +7d → spot-check pass → cleared (nextCheckAt=null)
 * Any spot-check fail reopens it and re-anchors to the failed question.
 */
export const fixits = sqliteTable("fixits", {
  id: text("id").primaryKey(),
  sourceQuestionId: text("source_question_id")
    .notNull()
    .unique()
    .references(() => questions.id),
  subtopicId: text("subtopic_id").notNull(),
  archetypeId: text("archetype_id").notNull(),
  /** Proofs and spot-checks regenerate at this difficulty. */
  difficulty: integer("difficulty").notNull(),
  /** Short label of the concept to relearn. */
  concept: text("concept").notNull(),
  detailJson: text("detail_json", { mode: "json" })
    .$type<{ gaps: string[]; corrections: string[] }>()
    .notNull(),
  status: text("status").$type<FixitStatus>().notNull().default("open"),
  /** Failed proof/spot-check cycles. */
  attempts: integer("attempts").notNull().default(0),
  /** 0 = next check is +2d after resolve, 1 = +7d, 2 = cleared. */
  checkStage: integer("check_stage").notNull().default(0),
  /** Active/most-recent learn session, for resume + dedupe. */
  lessonSessionId: text("lesson_session_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  /** When a resolved fixit is due for a spot-check; null when open or cleared. */
  nextCheckAt: integer("next_check_at", { mode: "timestamp_ms" }),
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

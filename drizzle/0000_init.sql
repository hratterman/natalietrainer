CREATE TABLE `grades` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`accuracy` real NOT NULL,
	`completeness` real NOT NULL,
	`structure` real NOT NULL,
	`overall` real NOT NULL,
	`model_answer` text NOT NULL,
	`feedback_json` text NOT NULL,
	`graded_at` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grades_question_id_unique` ON `grades` (`question_id`);--> statement-breakpoint
CREATE TABLE `mastery` (
	`subtopic_id` text PRIMARY KEY NOT NULL,
	`score` real NOT NULL,
	`attempts` integer NOT NULL,
	`current_difficulty` real NOT NULL,
	`last_attempt_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`round_id` text,
	`asked_index` integer NOT NULL,
	`subtopic_id` text NOT NULL,
	`archetype_id` text NOT NULL,
	`difficulty` integer NOT NULL,
	`prompt_text` text NOT NULL,
	`setup_facts_json` text NOT NULL,
	`summary` text NOT NULL,
	`expected_key_points_json` text NOT NULL,
	`answer_format` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`round_index` integer NOT NULL,
	`persona_id` text NOT NULL,
	`focus_area_id` text NOT NULL,
	`debrief_json` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`config_json` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`debrief_json` text
);
--> statement-breakpoint
CREATE TABLE `turns` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`turn_index` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`scratchpad` text,
	`elapsed_ms` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);

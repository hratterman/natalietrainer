CREATE TABLE `fixits` (
	`id` text PRIMARY KEY NOT NULL,
	`source_question_id` text NOT NULL,
	`subtopic_id` text NOT NULL,
	`archetype_id` text NOT NULL,
	`difficulty` integer NOT NULL,
	`concept` text NOT NULL,
	`detail_json` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`check_stage` integer DEFAULT 0 NOT NULL,
	`lesson_session_id` text,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	`next_check_at` integer,
	FOREIGN KEY (`source_question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fixits_source_question_id_unique` ON `fixits` (`source_question_id`);
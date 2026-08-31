CREATE TABLE `booklet_reps` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`verdict` text NOT NULL,
	`gave_up` integer DEFAULT false NOT NULL,
	`ms_spent` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `booklet_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`superday_date` text,
	`daily_minutes` integer DEFAULT 90 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `booklet_state` (
	`item_id` text PRIMARY KEY NOT NULL,
	`phase` text NOT NULL,
	`step` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`due_at` integer NOT NULL,
	`last_success_at` integer,
	`introduced_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

ALTER TABLE `grades` ADD `delivery` real;--> statement-breakpoint
ALTER TABLE `turns` ADD `interruption` text;--> statement-breakpoint
ALTER TABLE `turns` ADD `audio_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `turns` ADD `delivery_metrics_json` text;
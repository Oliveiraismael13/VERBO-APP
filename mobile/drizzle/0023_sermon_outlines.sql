CREATE TABLE `sermon_outlines` (
	`study_id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`theme` text NOT NULL DEFAULT '',
	`base_reference` text NOT NULL DEFAULT '',
	`category` text NOT NULL DEFAULT 'Geral',
	`favorite` integer NOT NULL DEFAULT 0,
	`planned_minutes` integer NOT NULL DEFAULT 30,
	`alert_marks_json` text NOT NULL DEFAULT '[50,75,90,100]',
	`sermon_date` text,
	`location` text NOT NULL DEFAULT '',
	`event_name` text NOT NULL DEFAULT '',
	`actual_minutes` integer,
	`post_notes` text NOT NULL DEFAULT '',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`study_id`) REFERENCES `personal_studies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sermon_outlines_user_updated` ON `sermon_outlines` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_sermon_outlines_user_favorite` ON `sermon_outlines` (`user_id`,`favorite`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `sermon_outline_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`study_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL CHECK(`kind` IN ('introduction','topic','subtopic','application','illustration','verse','prayer','observation','conclusion','divider')),
	`position` integer NOT NULL,
	`title` text NOT NULL DEFAULT '',
	`body` text NOT NULL DEFAULT '',
	`planned_minutes` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`study_id`) REFERENCES `personal_studies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sermon_outline_blocks_study_position` ON `sermon_outline_blocks` (`study_id`,`position`);
--> statement-breakpoint
CREATE TABLE `sermon_outline_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`study_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`study_id`) REFERENCES `personal_studies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sermon_outline_revisions_study_created` ON `sermon_outline_revisions` (`study_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `sermon_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`study_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`planned_seconds` integer NOT NULL,
	`actual_seconds` integer NOT NULL,
	`location` text NOT NULL DEFAULT '',
	`event_name` text NOT NULL DEFAULT '',
	`notes` text NOT NULL DEFAULT '',
	FOREIGN KEY (`study_id`) REFERENCES `personal_studies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sermon_sessions_study_started` ON `sermon_sessions` (`study_id`,`started_at`);
--> statement-breakpoint
PRAGMA optimize;

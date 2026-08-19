CREATE TABLE `completed_chapters` (
	`user_id` text NOT NULL,
	`book_slug` text NOT NULL,
	`chapter` integer NOT NULL,
	`completed_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `book_slug`, `chapter`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_completed_chapters_user_date` ON `completed_chapters` (`user_id`,`completed_at`);--> statement-breakpoint
CREATE TABLE `user_achievements` (
	`user_id` text NOT NULL,
	`code` text NOT NULL,
	`unlocked_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `code`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_progress` (
	`user_id` text PRIMARY KEY NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`coins` integer DEFAULT 0 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`last_read_date` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA optimize;

CREATE TABLE `books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`testament` text NOT NULL,
	`canonical_order` integer NOT NULL,
	`name` text NOT NULL,
	`abbreviation` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_books_canonical_order` ON `books` (`canonical_order`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`book_id` integer NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_favorites_user_reference` ON `favorites` (`user_id`,`book_id`,`chapter`,`verse`);--> statement-breakpoint
CREATE TABLE `highlights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`book_id` integer NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	`color` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_highlights_user_reference` ON `highlights` (`user_id`,`book_id`,`chapter`,`verse`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`book_id` integer NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	`body` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notes_user_reference` ON `notes` (`user_id`,`book_id`,`chapter`,`verse`);--> statement-breakpoint
CREATE TABLE `reading_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`book_id` integer NOT NULL,
	`chapter` integer NOT NULL,
	`read_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_history_user_read_at` ON `reading_history` (`user_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `reading_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`duration_days` integer NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reading_plans_slug` ON `reading_plans` (`slug`);--> statement-breakpoint
CREATE TABLE `studies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`source` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_studies_slug` ON `studies` (`slug`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_topics_slug` ON `topics` (`slug`);--> statement-breakpoint
CREATE TABLE `translations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`license_name` text NOT NULL,
	`offline_allowed` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_translations_code` ON `translations` (`code`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verse_topics` (
	`topic_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	PRIMARY KEY(`topic_id`, `book_id`, `chapter`, `verse`),
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `verses` (
	`translation_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	`text` text NOT NULL,
	PRIMARY KEY(`translation_id`, `book_id`, `chapter`, `verse`),
	FOREIGN KEY (`translation_id`) REFERENCES `translations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_verses_reference` ON `verses` (`book_id`,`chapter`,`verse`);
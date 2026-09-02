CREATE TABLE `personal_studies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`color` text NOT NULL DEFAULT 'gold',
	`icon` text NOT NULL DEFAULT '✦',
	`body` text NOT NULL DEFAULT '',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_personal_studies_user_updated` ON `personal_studies` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `personal_study_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`study_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL DEFAULT 'verse' CHECK(`kind` IN ('verse', 'heading', 'note')),
	`position` integer NOT NULL,
	`book_slug` text,
	`chapter` integer,
	`verse` integer,
	`body` text NOT NULL DEFAULT '',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`study_id`) REFERENCES `personal_studies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_personal_study_items_unique_verse` ON `personal_study_items` (`study_id`,`book_slug`,`chapter`,`verse`);
--> statement-breakpoint
CREATE INDEX `idx_personal_study_items_study_position` ON `personal_study_items` (`study_id`,`position`);
--> statement-breakpoint
CREATE INDEX `idx_personal_study_items_user_reference` ON `personal_study_items` (`user_id`,`book_slug`,`chapter`,`verse`);
--> statement-breakpoint
PRAGMA optimize;

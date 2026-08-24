ALTER TABLE `social_privacy_settings` ADD `show_notes` integer DEFAULT 0 NOT NULL CHECK(`show_notes` IN (0, 1));
--> statement-breakpoint
CREATE TABLE `social_shared_notes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `activity_id` integer NOT NULL UNIQUE,
  `reference` text NOT NULL,
  `note_text` text NOT NULL,
  `created_at` integer NOT NULL,
  `note_created_at` integer DEFAULT 0 NOT NULL,
  UNIQUE(`user_id`, `reference`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`activity_id`) REFERENCES `social_activities`(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_social_shared_notes_user_created` ON `social_shared_notes` (`user_id`, `created_at`);
--> statement-breakpoint
PRAGMA optimize;

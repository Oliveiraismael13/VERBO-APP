CREATE TABLE `social_notifications_next` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `actor_id` text NOT NULL,
  `kind` text NOT NULL CHECK(`kind` IN ('friend_request', 'friend_accepted', 'reaction', 'social_activity')),
  `activity_id` integer,
  `read_at` integer,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`activity_id`) REFERENCES `social_activities`(`id`)
);
--> statement-breakpoint
INSERT INTO `social_notifications_next` (`id`, `user_id`, `actor_id`, `kind`, `activity_id`, `read_at`, `created_at`)
SELECT `id`, `user_id`, `actor_id`, `kind`, `activity_id`, `read_at`, `created_at` FROM `social_notifications`;
--> statement-breakpoint
DROP TABLE `social_notifications`;
--> statement-breakpoint
ALTER TABLE `social_notifications_next` RENAME TO `social_notifications`;
--> statement-breakpoint
CREATE INDEX `idx_social_notifications_user_read_created` ON `social_notifications` (`user_id`, `read_at`, `created_at`);
--> statement-breakpoint
PRAGMA optimize;

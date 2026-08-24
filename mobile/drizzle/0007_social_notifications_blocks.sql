CREATE TABLE `social_notifications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `actor_id` text NOT NULL,
  `kind` text NOT NULL CHECK(`kind` IN ('friend_request', 'friend_accepted', 'reaction')),
  `activity_id` integer,
  `read_at` integer,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`activity_id`) REFERENCES `social_activities`(`id`)
);
CREATE INDEX `idx_social_notifications_user_read_created` ON `social_notifications` (`user_id`, `read_at`, `created_at`);

CREATE TABLE `user_blocks` (
  `blocker_id` text NOT NULL,
  `blocked_id` text NOT NULL,
  `created_at` integer NOT NULL,
  PRIMARY KEY(`blocker_id`, `blocked_id`),
  FOREIGN KEY (`blocker_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`),
  CHECK(`blocker_id` <> `blocked_id`)
);
CREATE INDEX `idx_user_blocks_blocked` ON `user_blocks` (`blocked_id`);

PRAGMA optimize;

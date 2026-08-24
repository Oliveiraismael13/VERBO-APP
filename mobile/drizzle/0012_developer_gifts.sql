CREATE TABLE `developer_gifts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `amount` integer NOT NULL,
  `message` text NOT NULL,
  `created_at` integer NOT NULL,
  `claimed_at` integer,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_developer_gifts_user_claimed_created` ON `developer_gifts` (`user_id`, `claimed_at`, `created_at`);

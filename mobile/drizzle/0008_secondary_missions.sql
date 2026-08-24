CREATE TABLE `user_secondary_missions` (
  `user_id` text NOT NULL,
  `mission_id` text NOT NULL,
  `unlocked_at` integer NOT NULL,
  `active` integer DEFAULT 0 NOT NULL CHECK(`active` IN (0, 1)),
  `completed_at` integer,
  PRIMARY KEY(`user_id`, `mission_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_secondary_missions_active` ON `user_secondary_missions` (`user_id`, `active`);

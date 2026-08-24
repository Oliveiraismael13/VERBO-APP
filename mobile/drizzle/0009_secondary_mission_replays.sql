CREATE TABLE `user_secondary_mission_replays` (
  `user_id` text NOT NULL,
  `mission_id` text NOT NULL,
  `book_slug` text NOT NULL,
  `chapter` integer NOT NULL,
  `read_at` integer NOT NULL,
  PRIMARY KEY(`user_id`, `mission_id`, `book_slug`, `chapter`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_secondary_mission_replays_lookup` ON `user_secondary_mission_replays` (`user_id`, `mission_id`);

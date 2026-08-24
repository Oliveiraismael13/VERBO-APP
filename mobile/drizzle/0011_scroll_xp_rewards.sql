CREATE TABLE `user_scroll_rewards` (
  `user_id` text NOT NULL,
  `scroll_key` text NOT NULL,
  `found_at` integer NOT NULL,
  PRIMARY KEY(`user_id`, `scroll_key`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);

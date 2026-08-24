ALTER TABLE `user_library` ADD `shared_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_library` ADD `found_scrolls_json` text DEFAULT '[]' NOT NULL;

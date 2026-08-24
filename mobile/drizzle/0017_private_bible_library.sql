CREATE TABLE `private_bible_translations` (
  `code` text PRIMARY KEY NOT NULL,
  `label` text NOT NULL,
  `manifest_json` text NOT NULL,
  `imported_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `private_bible_book_chunks` (
  `translation_code` text NOT NULL,
  `book_slug` text NOT NULL,
  `chunk_index` integer NOT NULL,
  `content_chunk` text NOT NULL,
  PRIMARY KEY(`translation_code`, `book_slug`, `chunk_index`),
  FOREIGN KEY (`translation_code`) REFERENCES `private_bible_translations`(`code`)
);
--> statement-breakpoint
PRAGMA optimize;

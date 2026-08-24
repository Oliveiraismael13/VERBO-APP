import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const translations = sqliteTable("translations", {
  id: integer("id").primaryKey({ autoIncrement: true }), code: text("code").notNull(), name: text("name").notNull(),
  licenseName: text("license_name").notNull(), offlineAllowed: integer("offline_allowed", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
}, (t) => [uniqueIndex("idx_translations_code").on(t.code)]);

export const books = sqliteTable("books", {
  id: integer("id").primaryKey({ autoIncrement: true }), testament: text("testament", { enum: ["old", "new"] }).notNull(),
  canonicalOrder: integer("canonical_order").notNull(), name: text("name").notNull(), abbreviation: text("abbreviation").notNull(),
}, (t) => [uniqueIndex("idx_books_canonical_order").on(t.canonicalOrder)]);

export const verses = sqliteTable("verses", {
  translationId: integer("translation_id").notNull().references(() => translations.id), bookId: integer("book_id").notNull().references(() => books.id),
  chapter: integer("chapter").notNull(), verse: integer("verse").notNull(), text: text("text").notNull(),
}, (t) => [primaryKey({ columns: [t.translationId, t.bookId, t.chapter, t.verse] }), index("idx_verses_reference").on(t.bookId, t.chapter, t.verse)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), displayName: text("display_name"), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const favorites = sqliteTable("favorites", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull().references(() => users.id),
  bookId: integer("book_id").notNull().references(() => books.id), chapter: integer("chapter").notNull(), verse: integer("verse").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (t) => [uniqueIndex("idx_favorites_user_reference").on(t.userId, t.bookId, t.chapter, t.verse)]);

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull().references(() => users.id),
  bookId: integer("book_id").notNull().references(() => books.id), chapter: integer("chapter").notNull(), verse: integer("verse").notNull(),
  body: text("body").notNull(), updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (t) => [index("idx_notes_user_reference").on(t.userId, t.bookId, t.chapter, t.verse)]);

export const highlights = sqliteTable("highlights", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull().references(() => users.id),
  bookId: integer("book_id").notNull().references(() => books.id), chapter: integer("chapter").notNull(), verse: integer("verse").notNull(), color: text("color").notNull(),
}, (t) => [uniqueIndex("idx_highlights_user_reference").on(t.userId, t.bookId, t.chapter, t.verse)]);

export const topics = sqliteTable("topics", {
  id: integer("id").primaryKey({ autoIncrement: true }), slug: text("slug").notNull(), name: text("name").notNull(), description: text("description"),
}, (t) => [uniqueIndex("idx_topics_slug").on(t.slug)]);

export const verseTopics = sqliteTable("verse_topics", {
  topicId: integer("topic_id").notNull().references(() => topics.id), bookId: integer("book_id").notNull().references(() => books.id),
  chapter: integer("chapter").notNull(), verse: integer("verse").notNull(),
}, (t) => [primaryKey({ columns: [t.topicId, t.bookId, t.chapter, t.verse] })]);

export const studies = sqliteTable("studies", {
  id: integer("id").primaryKey({ autoIncrement: true }), slug: text("slug").notNull(), title: text("title").notNull(),
  kind: text("kind").notNull(), body: text("body").notNull(), source: text("source"),
}, (t) => [uniqueIndex("idx_studies_slug").on(t.slug)]);

export const readingHistory = sqliteTable("reading_history", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull().references(() => users.id),
  bookId: integer("book_id").notNull().references(() => books.id), chapter: integer("chapter").notNull(), readAt: integer("read_at", { mode: "timestamp" }).notNull(),
}, (t) => [index("idx_history_user_read_at").on(t.userId, t.readAt)]);

export const userProgress = sqliteTable("user_progress", {
  userId: text("user_id").primaryKey().references(() => users.id),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  coins: integer("coins").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  lastReadDate: text("last_read_date"),
  lastLoginDate: text("last_login_date"),
  lastNoteDate: text("last_note_date"),
  streakBeforeBreak: integer("streak_before_break").notNull().default(0),
  missedStreakDays: integer("missed_streak_days").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const completedChapters = sqliteTable("completed_chapters", {
  userId: text("user_id").notNull().references(() => users.id),
  bookSlug: text("book_slug").notNull(),
  chapter: integer("chapter").notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.bookSlug, t.chapter] }),
  index("idx_completed_chapters_user_date").on(t.userId, t.completedAt),
]);

export const userAchievements = sqliteTable("user_achievements", {
  userId: text("user_id").notNull().references(() => users.id),
  code: text("code").notNull(),
  unlockedAt: integer("unlocked_at", { mode: "timestamp" }).notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.code] })]);

export const readingPlans = sqliteTable("reading_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }), slug: text("slug").notNull(), title: text("title").notNull(),
  durationDays: integer("duration_days").notNull(), description: text("description"),
}, (t) => [uniqueIndex("idx_reading_plans_slug").on(t.slug)]);

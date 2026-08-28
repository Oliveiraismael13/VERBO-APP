import { env } from "cloudflare:workers";

export const PRIVATE_BIBLE_TESTER_EMAILS = new Set([
  "marcioismael12@gmail.com",
  "vitoraugustodias@gmail.com",
]);

type TranslationRow = { code: string; label: string };
type ChunkRow = { content_chunk: string };
type IndexedChunkRow = ChunkRow & { book_slug: string };

export function canAccessPrivateBibles(email: string | null | undefined) {
  return PRIVATE_BIBLE_TESTER_EMAILS.has(String(email || "").trim().toLowerCase());
}

export async function ensurePrivateBibleSchema() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS private_bible_translations (code TEXT PRIMARY KEY NOT NULL, label TEXT NOT NULL, manifest_json TEXT NOT NULL, imported_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS private_bible_book_chunks (translation_code TEXT NOT NULL, book_slug TEXT NOT NULL, chunk_index INTEGER NOT NULL, content_chunk TEXT NOT NULL, PRIMARY KEY (translation_code, book_slug, chunk_index), FOREIGN KEY (translation_code) REFERENCES private_bible_translations(code))"),
  ]);
}

export async function listPrivateBibleTranslations() {
  await ensurePrivateBibleSchema();
  const result = await env.DB.prepare("SELECT code, label FROM private_bible_translations ORDER BY label").all<TranslationRow>();
  return result.results;
}

export async function privateBibleResource(code: string, resource: string) {
  await ensurePrivateBibleSchema();
  const translationCode = code.trim().toUpperCase();
  if (!/^[A-Z0-9]+$/.test(translationCode) || !/^[a-z0-9]+$/.test(resource)) return null;

  if (resource === "manifest") {
    const translation = await env.DB.prepare("SELECT manifest_json FROM private_bible_translations WHERE code = ?").bind(translationCode).first<{ manifest_json: string }>();
    return translation?.manifest_json || null;
  }

  if (resource === "ocrindex") {
    const chunks = await env.DB.prepare("SELECT book_slug, content_chunk FROM private_bible_book_chunks WHERE translation_code = ? ORDER BY book_slug, chunk_index").bind(translationCode).all<IndexedChunkRow>();
    if (!chunks.results.length) return null;
    const books = new Map<string, string[]>();
    for (const chunk of chunks.results) books.set(chunk.book_slug, [...(books.get(chunk.book_slug) || []), chunk.content_chunk]);
    const entries: [string, number, number, string][] = [];
    for (const [bookSlug, content] of books) {
      const book = JSON.parse(content.join("")) as { chapters?: Array<Array<{ number: number; text: string }>> };
      book.chapters?.forEach((chapter, chapterIndex) => chapter.forEach((verse) => entries.push([bookSlug, chapterIndex + 1, verse.number, verse.text])));
    }
    return JSON.stringify({ version: 1, entries });
  }

  const chunks = await env.DB.prepare("SELECT content_chunk FROM private_bible_book_chunks WHERE translation_code = ? AND book_slug = ? ORDER BY chunk_index").bind(translationCode, resource).all<ChunkRow>();
  if (!chunks.results.length) return null;
  return chunks.results.map((chunk) => chunk.content_chunk).join("");
}

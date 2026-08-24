import { env } from "cloudflare:workers";

export const PRIVATE_BIBLE_OWNER_EMAIL = "marcioismael12@gmail.com";

type TranslationRow = { code: string; label: string };
type ChunkRow = { content_chunk: string };

export function canAccessPrivateBibles(email: string | null | undefined) {
  return String(email || "").trim().toLowerCase() === PRIVATE_BIBLE_OWNER_EMAIL;
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

  const chunks = await env.DB.prepare("SELECT content_chunk FROM private_bible_book_chunks WHERE translation_code = ? AND book_slug = ? ORDER BY chunk_index").bind(translationCode, resource).all<ChunkRow>();
  if (!chunks.results.length) return null;
  return chunks.results.map((chunk) => chunk.content_chunk).join("");
}

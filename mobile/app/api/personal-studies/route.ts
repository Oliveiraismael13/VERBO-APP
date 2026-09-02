import { env } from "cloudflare:workers";
import { currentUser } from "../../../lib/auth";
import { corsOptions, withCors } from "../../../lib/cors";

export const dynamic = "force-dynamic";

const colors = new Set(["gold", "violet", "teal", "rose", "blue", "green"]);
const icons = new Set(["✦", "♡", "✎", "⌁", "☀", "⚑"]);
type Verse = { bookSlug: string; chapter: number; verse: number };

function text(value: unknown, maximum: number) { return typeof value === "string" ? value.trim().slice(0, maximum) : ""; }
function verse(value: unknown): Verse | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<Verse>;
  return typeof candidate.bookSlug === "string" && /^[a-z0-9]+$/.test(candidate.bookSlug) && Number.isInteger(candidate.chapter) && candidate.chapter! >= 1 && candidate.chapter! <= 150 && Number.isInteger(candidate.verse) && candidate.verse! >= 1 && candidate.verse! <= 200
    ? { bookSlug: candidate.bookSlug, chapter: candidate.chapter, verse: candidate.verse }
    : null;
}
function verses(value: unknown) {
  if (!Array.isArray(value)) return [] as Verse[];
  const unique = new Map<string, Verse>();
  value.slice(0, 50).forEach((item) => { const parsed = verse(item); if (parsed) unique.set(`${parsed.bookSlug}:${parsed.chapter}:${parsed.verse}`, parsed); });
  return [...unique.values()];
}

export function OPTIONS() { return corsOptions(); }

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  const url = new URL(request.url);
  const query = text(url.searchParams.get("query"), 80).replace(/[%_]/g, "");
  const reference = verse({
    bookSlug: url.searchParams.get("bookSlug"),
    chapter: Number(url.searchParams.get("chapter")),
    verse: Number(url.searchParams.get("verse")),
  });
  const summary = "SELECT personal_studies.id, personal_studies.title, personal_studies.color, personal_studies.icon, personal_studies.body, personal_studies.updated_at AS updatedAt, COUNT(personal_study_items.id) AS itemCount FROM personal_studies LEFT JOIN personal_study_items ON personal_study_items.study_id = personal_studies.id";
  const filter = " WHERE personal_studies.user_id = ? AND (? = '' OR personal_studies.title LIKE '%' || ? || '%')";
  const statement = reference
    ? env.DB.prepare(`${summary}${filter} AND EXISTS (SELECT 1 FROM personal_study_items AS reference_items WHERE reference_items.study_id = personal_studies.id AND reference_items.user_id = ? AND reference_items.kind = 'verse' AND reference_items.book_slug = ? AND reference_items.chapter = ? AND reference_items.verse = ?) GROUP BY personal_studies.id ORDER BY personal_studies.updated_at DESC LIMIT 100`).bind(user.id, query, query, user.id, reference.bookSlug, reference.chapter, reference.verse)
    : env.DB.prepare(`${summary}${filter} GROUP BY personal_studies.id ORDER BY personal_studies.updated_at DESC LIMIT 100`).bind(user.id, query, query);
  const rows = await statement.all();
  return withCors(Response.json({ studies: rows.results }));
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  const payload = await request.json() as { title?: unknown; color?: unknown; icon?: unknown; verses?: unknown };
  const title = text(payload.title, 80);
  if (title.length < 2) return withCors(Response.json({ error: "Dê um nome de pelo menos 2 caracteres ao estudo." }, { status: 400 }));
  const color = typeof payload.color === "string" && colors.has(payload.color) ? payload.color : "gold";
  const icon = typeof payload.icon === "string" && icons.has(payload.icon) ? payload.icon : "✦";
  const now = Date.now();
  const created = await env.DB.prepare("INSERT INTO personal_studies (user_id, title, color, icon, body, created_at, updated_at) VALUES (?, ?, ?, ?, '', ?, ?)").bind(user.id, title, color, icon, now, now).run();
  const studyId = Number(created.meta.last_row_id);
  const selected = verses(payload.verses);
  if (selected.length) await env.DB.batch(selected.map((item, index) => env.DB.prepare("INSERT INTO personal_study_items (study_id, user_id, kind, position, book_slug, chapter, verse, body, created_at, updated_at) VALUES (?, ?, 'verse', ?, ?, ?, ?, '', ?, ?)").bind(studyId, user.id, index + 1, item.bookSlug, item.chapter, item.verse, now, now)));
  return withCors(Response.json({ study: { id: studyId, title, color, icon, body: "", updatedAt: now, itemCount: selected.length } }, { status: 201 }));
}

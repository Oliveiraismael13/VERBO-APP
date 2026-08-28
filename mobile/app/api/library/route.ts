import { env } from "cloudflare:workers";
import { currentUser } from "../../../lib/auth";
import { corsOptions, withCors } from "../../../lib/cors";
import { recordSocialActivity } from "../../../lib/social";

export const dynamic = "force-dynamic";
type LastReading = { bookSlug: string; chapter: number };
type LibraryRow = { favorites_json: string; highlights_json: string; notes_json: string; note_dates_json?: string; plans_json: string; shared_json?: string; found_scrolls_json?: string; last_reading_json?: string; selected_translation?: string };
const empty = { favorites: [] as string[], highlights: {} as Record<string, string>, notes: {} as Record<string, string>, noteDates: {} as Record<string, number>, plans: [] as string[], shared: [] as string[], foundScrolls: [] as string[], lastReading: null as LastReading | null, selectedTranslation: null as string | null };
const translationCodes = new Set(["BLIVRE", "ALMEIDA1819", "CHAMADAFE", "ACF", "ALM1911", "ARA", "ARC", "AS21", "JFAA", "KJA", "KJF", "MENS", "NAA", "NBV", "NTLH", "NVI", "NVT", "OL", "TB", "VFL"]);

async function ensureSchema() {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS user_library (user_id TEXT PRIMARY KEY NOT NULL, favorites_json TEXT NOT NULL DEFAULT '[]', highlights_json TEXT NOT NULL DEFAULT '{}', notes_json TEXT NOT NULL DEFAULT '{}', plans_json TEXT NOT NULL DEFAULT '[]', last_reading_json TEXT, updated_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))").run();
  const columns = await env.DB.prepare("PRAGMA table_info(user_library)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "last_reading_json")) await env.DB.prepare("ALTER TABLE user_library ADD COLUMN last_reading_json TEXT").run();
  if (!columns.results.some((column) => column.name === "shared_json")) await env.DB.prepare("ALTER TABLE user_library ADD COLUMN shared_json TEXT NOT NULL DEFAULT '[]'").run();
  if (!columns.results.some((column) => column.name === "found_scrolls_json")) await env.DB.prepare("ALTER TABLE user_library ADD COLUMN found_scrolls_json TEXT NOT NULL DEFAULT '[]'").run();
  if (!columns.results.some((column) => column.name === "note_dates_json")) await env.DB.prepare("ALTER TABLE user_library ADD COLUMN note_dates_json TEXT NOT NULL DEFAULT '{}'").run();
  if (!columns.results.some((column) => column.name === "selected_translation")) await env.DB.prepare("ALTER TABLE user_library ADD COLUMN selected_translation TEXT").run();
}
function parse(value: string | null | undefined, fallback: unknown) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function parseSelectedTranslation(value: unknown) { return typeof value === "string" && translationCodes.has(value) ? value : null; }
function parseLastReading(value: unknown): LastReading | null {
  if (!value || typeof value !== "object") return null;
  const reading = value as Partial<LastReading>;
  return typeof reading.bookSlug === "string" && /^[a-z0-9]+$/.test(reading.bookSlug) && Number.isInteger(reading.chapter) && reading.chapter! >= 1 && reading.chapter! <= 150 ? { bookSlug: reading.bookSlug, chapter: reading.chapter } : null;
}
function verseReference(value: string) { return /^[a-z0-9]+:\d{1,3}:\d{1,3}$/.test(value) ? value : undefined; }

export function OPTIONS() { return corsOptions(); }

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  await ensureSchema();
  const row = await env.DB.prepare("SELECT favorites_json, highlights_json, notes_json, note_dates_json, plans_json, shared_json, found_scrolls_json, last_reading_json, selected_translation FROM user_library WHERE user_id = ?").bind(user.id).first<LibraryRow>();
  return withCors(Response.json(row ? { favorites: parse(row.favorites_json, []), highlights: parse(row.highlights_json, {}), notes: parse(row.notes_json, {}), noteDates: parse(row.note_dates_json, {}), plans: parse(row.plans_json, []), shared: parse(row.shared_json, []), foundScrolls: parse(row.found_scrolls_json, []), lastReading: parseLastReading(parse(row.last_reading_json, null)), selectedTranslation: parseSelectedTranslation(row.selected_translation) } : empty));
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  const body = await request.json() as Partial<typeof empty>;
  const favorites = Array.isArray(body.favorites) ? body.favorites.filter((item): item is string => typeof item === "string").slice(0, 500) : empty.favorites;
  const highlights = body.highlights && typeof body.highlights === "object" ? body.highlights : empty.highlights;
  const notes = body.notes && typeof body.notes === "object" ? body.notes : empty.notes;
  const noteDates = body.noteDates && typeof body.noteDates === "object" ? body.noteDates : empty.noteDates;
  const plans = Array.isArray(body.plans) ? body.plans.filter((item): item is string => typeof item === "string").slice(0, 100) : empty.plans;
  const shared = Array.isArray(body.shared) ? body.shared.filter((item): item is string => typeof item === "string").slice(0, 1500) : empty.shared;
  const foundScrolls = Array.isArray(body.foundScrolls) ? body.foundScrolls.filter((item): item is string => typeof item === "string").slice(0, 1500) : empty.foundScrolls;
  const lastReading = parseLastReading(body.lastReading);
  const selectedTranslation = parseSelectedTranslation(body.selectedTranslation);
  await ensureSchema();
  const previous = await env.DB.prepare("SELECT favorites_json, highlights_json, found_scrolls_json FROM user_library WHERE user_id = ?").bind(user.id).first<Pick<LibraryRow, "favorites_json" | "highlights_json" | "found_scrolls_json">>();
  const previousFavorites = parse(previous?.favorites_json, []) as string[];
  const previousHighlights = parse(previous?.highlights_json, {}) as Record<string, string>;
  const previousScrolls = parse(previous?.found_scrolls_json, []) as string[];
  await env.DB.prepare("INSERT INTO user_library (user_id, favorites_json, highlights_json, notes_json, note_dates_json, plans_json, shared_json, found_scrolls_json, last_reading_json, selected_translation, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET favorites_json = excluded.favorites_json, highlights_json = excluded.highlights_json, notes_json = excluded.notes_json, note_dates_json = excluded.note_dates_json, plans_json = excluded.plans_json, shared_json = excluded.shared_json, found_scrolls_json = excluded.found_scrolls_json, last_reading_json = excluded.last_reading_json, selected_translation = excluded.selected_translation, updated_at = excluded.updated_at").bind(user.id, JSON.stringify(favorites), JSON.stringify(highlights), JSON.stringify(notes), JSON.stringify(noteDates), JSON.stringify(plans), JSON.stringify(shared), JSON.stringify(foundScrolls), JSON.stringify(lastReading), selectedTranslation, Date.now()).run();
  try {
    const newlyFavorited = favorites.find((reference) => !previousFavorites.includes(reference));
    const newlyMarked = Object.keys(highlights).find((reference) => !(reference in previousHighlights));
    const newlyFoundScroll = foundScrolls.find((scroll) => !previousScrolls.includes(scroll));
    if (newlyFavorited) await recordSocialActivity(user.id, "achievement_unlocked", { title: "Guardou um versículo no coração", detail: "Adicionou um versículo aos favoritos.", ...(verseReference(newlyFavorited) ? { reference: verseReference(newlyFavorited) } : {}), category: "verse_favorited", notifyFriends: true });
    if (newlyMarked) await recordSocialActivity(user.id, "achievement_unlocked", { title: "Marcou um versículo", detail: "Destacou uma passagem para revisitar.", ...(verseReference(newlyMarked) ? { reference: verseReference(newlyMarked) } : {}), category: "verse_marked", notifyFriends: true });
    if (newlyFoundScroll) await recordSocialActivity(user.id, "achievement_unlocked", { title: "Encontrou um pergaminho", detail: "Uma descoberta foi adicionada à jornada.", category: "scroll_found", notifyFriends: true });
  } catch (error) {
    console.error("Falha ao registrar atividade social da biblioteca", error);
  }
  return withCors(Response.json({ favorites, highlights, notes, noteDates, plans, shared, foundScrolls, lastReading, selectedTranslation }));
}

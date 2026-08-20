import { env } from "cloudflare:workers";
import { currentUser } from "../../../lib/auth";
import { corsOptions, withCors } from "../../../lib/cors";

export const dynamic = "force-dynamic";
type LibraryRow = { favorites_json: string; highlights_json: string; notes_json: string; plans_json: string };
const empty = { favorites: [] as string[], highlights: {} as Record<string, string>, notes: {} as Record<string, string>, plans: [] as string[] };

async function ensureSchema() {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS user_library (user_id TEXT PRIMARY KEY NOT NULL, favorites_json TEXT NOT NULL DEFAULT '[]', highlights_json TEXT NOT NULL DEFAULT '{}', notes_json TEXT NOT NULL DEFAULT '{}', plans_json TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))").run();
}
function parse(value: string | null | undefined, fallback: unknown) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }

export function OPTIONS() { return corsOptions(); }

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  await ensureSchema();
  const row = await env.DB.prepare("SELECT favorites_json, highlights_json, notes_json, plans_json FROM user_library WHERE user_id = ?").bind(user.id).first<LibraryRow>();
  return withCors(Response.json(row ? { favorites: parse(row.favorites_json, []), highlights: parse(row.highlights_json, {}), notes: parse(row.notes_json, {}), plans: parse(row.plans_json, []) } : empty));
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  const body = await request.json() as Partial<typeof empty>;
  const favorites = Array.isArray(body.favorites) ? body.favorites.filter((item): item is string => typeof item === "string").slice(0, 500) : empty.favorites;
  const highlights = body.highlights && typeof body.highlights === "object" ? body.highlights : empty.highlights;
  const notes = body.notes && typeof body.notes === "object" ? body.notes : empty.notes;
  const plans = Array.isArray(body.plans) ? body.plans.filter((item): item is string => typeof item === "string").slice(0, 100) : empty.plans;
  await ensureSchema();
  await env.DB.prepare("INSERT INTO user_library (user_id, favorites_json, highlights_json, notes_json, plans_json, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET favorites_json = excluded.favorites_json, highlights_json = excluded.highlights_json, notes_json = excluded.notes_json, plans_json = excluded.plans_json, updated_at = excluded.updated_at").bind(user.id, JSON.stringify(favorites), JSON.stringify(highlights), JSON.stringify(notes), JSON.stringify(plans), Date.now()).run();
  return withCors(Response.json({ favorites, highlights, notes, plans }));
}

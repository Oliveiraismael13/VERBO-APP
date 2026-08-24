import { env } from "cloudflare:workers";
import { currentUser } from "../../../lib/auth";
import { corsOptions, withCors } from "../../../lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

async function ensureGiftSchema() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS developer_gifts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0), message TEXT NOT NULL, created_at INTEGER NOT NULL, claimed_at INTEGER, FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_developer_gifts_user_claimed_created ON developer_gifts(user_id, claimed_at, created_at)"),
  ]);
}

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    await ensureGiftSchema();
    const gift = await env.DB.prepare("SELECT id, amount, message FROM developer_gifts WHERE user_id = ? AND claimed_at IS NULL ORDER BY created_at ASC LIMIT 1").bind(user.id).first<{ id: number; amount: number; message: string }>();
    return withCors(Response.json({ gift: gift || null }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível carregar o presente" }, { status: 500 }));
  }
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const body = await request.json() as { id?: unknown; action?: unknown };
    if (body.action !== "claim" || !Number.isInteger(body.id)) return withCors(Response.json({ error: "Ação inválida" }, { status: 400 }));
    await ensureGiftSchema();
    await env.DB.prepare("UPDATE developer_gifts SET claimed_at = ? WHERE id = ? AND user_id = ? AND claimed_at IS NULL").bind(Date.now(), body.id, user.id).run();
    return withCors(Response.json({ ok: true }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível registrar o presente" }, { status: 500 }));
  }
}

import { env } from "cloudflare:workers";
import { currentUser } from "../../../lib/auth";
import { corsOptions, withCors } from "../../../lib/cors";

export const dynamic = "force-dynamic";

type ProfileRow = { id: string; email: string; display_name: string; profile_photo: string | null };

async function ensureSchema() {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, display_name TEXT, email TEXT, profile_photo TEXT, created_at INTEGER NOT NULL)").run();
  const columns = await env.DB.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "profile_photo")) await env.DB.prepare("ALTER TABLE users ADD COLUMN profile_photo TEXT").run();
}

export function OPTIONS() { return corsOptions(); }

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    await ensureSchema();
    const profile = await env.DB.prepare("SELECT id, email, display_name, profile_photo FROM users WHERE id = ?").bind(user.id).first<ProfileRow>();
    return withCors(Response.json({ displayName: profile?.display_name ?? user.displayName, email: profile?.email ?? user.email, profilePhoto: profile?.profile_photo ?? "" }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível carregar o perfil" }, { status: 500 }));
  }
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const body = await request.json() as { displayName?: string; profilePhoto?: string };
    const displayName = String(body.displayName ?? "").trim();
    const profilePhoto = String(body.profilePhoto ?? "");
    if (displayName.length < 2 || displayName.length > 24) return withCors(Response.json({ error: "O nome deve ter entre 2 e 24 caracteres." }, { status: 400 }));
    if (profilePhoto && (!profilePhoto.startsWith("data:image/") || profilePhoto.length > 3_000_000)) return withCors(Response.json({ error: "A foto é inválida ou muito grande." }, { status: 400 }));
    await ensureSchema();
    await env.DB.prepare("UPDATE users SET display_name = ?, profile_photo = ? WHERE id = ?").bind(displayName, profilePhoto, user.id).run();
    return withCors(Response.json({ displayName, email: user.email, profilePhoto }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível salvar o perfil" }, { status: 500 }));
  }
}

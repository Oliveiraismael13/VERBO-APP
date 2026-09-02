import { env } from "cloudflare:workers";
import { currentUser } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  const url = new URL(request.url);
  const bookSlug = url.searchParams.get("bookSlug") || "";
  const chapter = Number(url.searchParams.get("chapter"));
  if (!/^[a-z0-9]+$/.test(bookSlug) || !Number.isInteger(chapter) || chapter < 1 || chapter > 150) return withCors(Response.json({ error: "Referência inválida" }, { status: 400 }));
  const rows = await env.DB.prepare("SELECT verse, COUNT(*) AS count FROM personal_study_items WHERE user_id = ? AND kind = 'verse' AND book_slug = ? AND chapter = ? GROUP BY verse").bind(user.id, bookSlug, chapter).all<{ verse: number; count: number }>();
  return withCors(Response.json({ verseCounts: Object.fromEntries(rows.results.map((row) => [row.verse, row.count])) }));
}

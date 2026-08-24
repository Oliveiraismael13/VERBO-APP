import { currentUser } from "../../../../../lib/auth";
import { corsOptions, withCors } from "../../../../../lib/cors";
import { canAccessPrivateBibles, privateBibleResource } from "../../../../../lib/private-bibles";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function GET(_request: Request, context: { params: Promise<{ code: string; resource: string }> }) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  if (!canAccessPrivateBibles(user.email)) return withCors(Response.json({ error: "Recurso não encontrado" }, { status: 404 }));
  try {
    const { code, resource } = await context.params;
    const content = await privateBibleResource(code, resource);
    if (!content) return withCors(Response.json({ error: "Recurso não encontrado" }, { status: 404 }));
    return withCors(new Response(content, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" } }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível carregar esta tradução" }, { status: 500 }));
  }
}

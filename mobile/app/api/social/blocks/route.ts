import { currentUser } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";
import { listBlockedUsers } from "../../../../lib/social";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    return withCors(Response.json({ blocked: await listBlockedUsers(user.id) }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível carregar os perfis bloqueados" }, { status: 500 }));
  }
}

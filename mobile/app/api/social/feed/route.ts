import { currentUser } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";
import { listSocialFeed } from "../../../../lib/social";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    return withCors(Response.json({ activities: await listSocialFeed(user.id) }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível carregar as atividades" }, { status: 500 }));
  }
}

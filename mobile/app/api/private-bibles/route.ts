import { currentUser } from "../../../lib/auth";
import { corsOptions, withCors } from "../../../lib/cors";
import { canAccessPrivateBibles, listPrivateBibleTranslations } from "../../../lib/private-bibles";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  if (!canAccessPrivateBibles(user.email)) return withCors(Response.json({ versions: [] }));
  try {
    const translations = await listPrivateBibleTranslations();
    return withCors(Response.json({ versions: translations.map((translation) => translation.code) }, { headers: { "cache-control": "private, no-store" } }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível carregar sua biblioteca privada" }, { status: 500 }));
  }
}

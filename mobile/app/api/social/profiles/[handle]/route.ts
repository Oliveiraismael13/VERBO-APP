import { currentUser } from "../../../../../lib/auth";
import { corsOptions, withCors } from "../../../../../lib/cors";
import { getSocialProfile, normalizePublicHandle } from "../../../../../lib/social";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function GET(_request: Request, context: { params: Promise<{ handle: string }> }) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const { handle } = await context.params;
    const publicHandle = normalizePublicHandle(handle);
    if (!publicHandle) return withCors(Response.json({ error: "Identificador público inválido" }, { status: 400 }));
    const profile = await getSocialProfile(user.id, publicHandle);
    if (!profile) return withCors(Response.json({ error: "Perfil não encontrado" }, { status: 404 }));
    return withCors(Response.json(profile));
  } catch {
    return withCors(Response.json({ error: "Não foi possível carregar o perfil social" }, { status: 500 }));
  }
}

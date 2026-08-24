import { currentUser } from "../../../../../lib/auth";
import { corsOptions, withCors } from "../../../../../lib/cors";
import { normalizePublicHandle, removeFriend } from "../../../../../lib/social";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function DELETE(_request: Request, context: { params: Promise<{ handle: string }> }) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const { handle } = await context.params;
    const publicHandle = normalizePublicHandle(handle);
    if (!publicHandle) return withCors(Response.json({ error: "Identificador público inválido" }, { status: 400 }));
    const result = await removeFriend(user.id, publicHandle);
    return withCors(Response.json(result.ok ? { ok: true } : { error: result.error }, { status: result.ok ? 200 : result.status }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível remover a amizade" }, { status: 500 }));
  }
}

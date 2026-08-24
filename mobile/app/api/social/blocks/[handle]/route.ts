import { currentUser } from "../../../../../lib/auth";
import { corsOptions, withCors } from "../../../../../lib/cors";
import { blockSocialUser, normalizePublicHandle, unblockSocialUser } from "../../../../../lib/social";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

async function blockAction(context: { params: Promise<{ handle: string }> }, action: "block" | "unblock", userId: string) {
  const { handle } = await context.params;
  const publicHandle = normalizePublicHandle(handle);
  if (!publicHandle) return withCors(Response.json({ error: "Identificador público inválido" }, { status: 400 }));
  const result = action === "block" ? await blockSocialUser(userId, publicHandle) : await unblockSocialUser(userId, publicHandle);
  return withCors(Response.json(result.ok ? { ok: true } : { error: result.error }, { status: result.ok ? 200 : result.status }));
}

export async function POST(_request: Request, context: { params: Promise<{ handle: string }> }) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    return await blockAction(context, "block", user.id);
  } catch {
    return withCors(Response.json({ error: "Não foi possível bloquear este perfil" }, { status: 500 }));
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ handle: string }> }) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    return await blockAction(context, "unblock", user.id);
  } catch {
    return withCors(Response.json({ error: "Não foi possível desbloquear este perfil" }, { status: 500 }));
  }
}

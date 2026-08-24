import { currentUser } from "../../../../../../lib/auth";
import { corsOptions, withCors } from "../../../../../../lib/cors";
import { respondToFriendRequest } from "../../../../../../lib/social";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const { id } = await context.params;
    const requestId = Number(id);
    const body = await request.json() as { action?: unknown };
    if (!Number.isSafeInteger(requestId) || requestId < 1) return withCors(Response.json({ error: "Pedido de amizade inválido" }, { status: 400 }));
    if (body.action !== "accept" && body.action !== "decline" && body.action !== "cancel") return withCors(Response.json({ error: "Ação inválida" }, { status: 400 }));
    const result = await respondToFriendRequest(user.id, requestId, body.action);
    return withCors(Response.json(result.ok ? { status: result.status } : { error: result.error }, { status: result.ok ? 200 : result.status }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível atualizar o pedido de amizade" }, { status: 500 }));
  }
}

import { currentUser } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";
import { createFriendRequest, listFriendRequests, listFriends, normalizePublicHandle } from "../../../../lib/social";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const [friends, requests] = await Promise.all([listFriends(user.id), listFriendRequests(user.id)]);
    return withCors(Response.json({ friends, requests }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível carregar suas amizades" }, { status: 500 }));
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const body = await request.json() as { publicHandle?: unknown };
    const publicHandle = normalizePublicHandle(body.publicHandle);
    if (!publicHandle) return withCors(Response.json({ error: "Informe um identificador público válido" }, { status: 400 }));
    const result = await createFriendRequest(user.id, publicHandle);
    return withCors(Response.json(result.ok ? { requestId: result.requestId, recipient: result.recipient } : { error: result.error }, { status: result.ok ? 201 : result.status }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível enviar o pedido de amizade" }, { status: 500 }));
  }
}

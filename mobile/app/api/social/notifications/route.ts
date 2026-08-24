import { currentUser } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";
import { listSocialNotifications, markSocialNotificationRead, markSocialNotificationsRead } from "../../../../lib/social";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    return withCors(Response.json({ notifications: await listSocialNotifications(user.id) }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível carregar suas notificações" }, { status: 500 }));
  }
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const body = await request.json() as { action?: unknown; notificationId?: unknown };
    if (body.action !== "mark-read") return withCors(Response.json({ error: "Ação inválida" }, { status: 400 }));
    if (body.notificationId !== undefined) {
      if (!Number.isSafeInteger(body.notificationId) || body.notificationId < 1) return withCors(Response.json({ error: "Notificação inválida" }, { status: 400 }));
      await markSocialNotificationRead(user.id, body.notificationId);
    } else await markSocialNotificationsRead(user.id);
    return withCors(Response.json({ ok: true }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível atualizar suas notificações" }, { status: 500 }));
  }
}

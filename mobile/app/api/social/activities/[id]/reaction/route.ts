import { currentUser } from "../../../../../../lib/auth";
import { corsOptions, withCors } from "../../../../../../lib/cors";
import { setSocialReaction } from "../../../../../../lib/social";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const { id } = await context.params;
    const activityId = Number(id);
    const body = await request.json() as { reaction?: unknown };
    if (!Number.isSafeInteger(activityId) || activityId < 1) return withCors(Response.json({ error: "Atividade inválida" }, { status: 400 }));
    if (body.reaction !== "amen" && body.reaction !== "celebrate" && body.reaction !== null) return withCors(Response.json({ error: "Reação inválida" }, { status: 400 }));
    const result = await setSocialReaction(user.id, activityId, body.reaction);
    return withCors(Response.json(result.ok ? { reaction: result.reaction } : { error: result.error }, { status: result.ok ? 200 : result.status }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível registrar a reação" }, { status: 500 }));
  }
}

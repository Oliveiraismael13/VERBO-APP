import { currentUser } from "../../../../../../lib/auth";
import { corsOptions, withCors } from "../../../../../../lib/cors";
import { createSocialComment, listSocialComments } from "../../../../../../lib/social";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

async function activityIdFor(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const activityId = Number(id);
  return Number.isSafeInteger(activityId) && activityId > 0 ? activityId : null;
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  const activityId = await activityIdFor(context);
  if (!activityId) return withCors(Response.json({ error: "Atividade inválida" }, { status: 400 }));
  try {
    const result = await listSocialComments(user.id, activityId);
    return withCors(Response.json(result.ok ? { comments: result.comments } : { error: result.error }, { status: result.ok ? 200 : result.status }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível carregar os comentários" }, { status: 500 }));
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  const activityId = await activityIdFor(context);
  if (!activityId) return withCors(Response.json({ error: "Atividade inválida" }, { status: 400 }));
  try {
    const body = await request.json() as { text?: unknown };
    const result = await createSocialComment(user.id, activityId, body.text);
    return withCors(Response.json(result.ok ? { comment: result.comment } : { error: result.error }, { status: result.ok ? 201 : result.status }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível publicar o comentário" }, { status: 500 }));
  }
}

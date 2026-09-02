import { currentUser } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";
import { createSocialPost } from "../../../../lib/social";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const body = await request.json() as { kind?: unknown; text?: unknown; reference?: unknown };
    const result = await createSocialPost(user.id, body);
    return withCors(Response.json(result.ok ? { activityId: result.activityId } : { error: result.error }, { status: result.ok ? 201 : result.status }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível publicar agora" }, { status: 500 }));
  }
}

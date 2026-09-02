import { currentUser } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";
import { listSocialPeople } from "../../../../lib/social";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const query = new URL(request.url).searchParams.get("q") || "";
    return withCors(Response.json({ people: await listSocialPeople(user.id, query) }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível encontrar pessoas agora" }, { status: 500 }));
  }
}

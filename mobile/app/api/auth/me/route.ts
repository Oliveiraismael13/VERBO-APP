import { currentUser } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function GET() {
  const user = await currentUser();
  return user ? withCors(Response.json({ user })) : withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
}

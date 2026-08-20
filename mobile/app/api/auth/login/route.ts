import { authenticate, startSession } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const user = await authenticate(String(body.email || ""), String(body.password || ""));
    const response = withCors(Response.json({ user }));
    response.headers.append("Set-Cookie", await startSession(user.userId));
    return response;
  } catch (error) {
    return withCors(Response.json({ error: error instanceof Error ? error.message : "E-mail ou senha inválidos." }, { status: 401 }));
  }
}

import { createAccount, startSession } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; displayName?: string; password?: string };
    const email = String(body.email || "").trim();
    const displayName = String(body.displayName || "").trim();
    const password = String(body.password || "");
    if (!/^\S+@\S+\.\S+$/.test(email) || displayName.length < 2 || displayName.length > 24 || password.length < 8) return Response.json({ error: "Informe nome, e-mail válido e senha com pelo menos 8 caracteres." }, { status: 400 });
    const user = await createAccount(email, displayName, password);
    const response = withCors(Response.json({ user }));
    response.headers.append("Set-Cookie", await startSession(user.userId));
    return response;
  } catch (error) {
    return withCors(Response.json({ error: error instanceof Error ? error.message : "Não foi possível criar a conta." }, { status: 400 }));
  }
}

import { authenticate, consumeAuthAttempt, InvalidCredentialsError, startSession } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json() as { email?: string; password?: string };
  } catch {
    return withCors(Response.json({ error: "Não foi possível ler os dados de acesso." }, { status: 400 }));
  }

  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  if (!email || !password) return withCors(Response.json({ error: "Informe e-mail e senha." }, { status: 400 }));
  const attempt = await consumeAuthAttempt(request, "login", email);
  if (!attempt.allowed) return withCors(Response.json({ error: `Muitas tentativas de acesso. Tente novamente em cerca de ${Math.ceil(attempt.retryAfterSeconds / 60)} minuto(s).` }, { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } }));

  try {
    const user = await authenticate(email, password);
    const response = withCors(Response.json({ user }));
    response.headers.append("Set-Cookie", await startSession(user.userId, new URL(request.url).protocol === "https:"));
    return response;
  } catch (error) {
    if (error instanceof InvalidCredentialsError) return withCors(Response.json({ error: error.message }, { status: 401 }));
    console.error("Falha no login", error);
    return withCors(Response.json({ error: "Não foi possível acessar sua conta agora. Tente novamente." }, { status: 500 }));
  }
}

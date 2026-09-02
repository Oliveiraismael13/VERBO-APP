import { consumeAuthAttempt, createAccount, startSession } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function POST(request: Request) {
  let body: { email?: string; displayName?: string; password?: string; profilePhoto?: string };
  try {
    body = await request.json() as { email?: string; displayName?: string; password?: string; profilePhoto?: string };
  } catch {
    return withCors(Response.json({ error: "Não foi possível ler os dados do cadastro." }, { status: 400 }));
  }

  const email = String(body.email || "").trim();
  const displayName = String(body.displayName || "").trim();
  const password = String(body.password || "");
  const profilePhoto = String(body.profilePhoto || "");
  if (!/^\S+@\S+\.\S+$/.test(email) || displayName.length < 2 || displayName.length > 24 || password.length < 8) {
    return withCors(Response.json({ error: "Informe nome, e-mail válido e senha com pelo menos 8 caracteres." }, { status: 400 }));
  }
  if (profilePhoto && (!profilePhoto.startsWith("data:image/") || profilePhoto.length > 3_000_000)) return withCors(Response.json({ error: "A foto é inválida ou muito grande." }, { status: 400 }));
  const attempt = await consumeAuthAttempt(request, "register", email);
  if (!attempt.allowed) return withCors(Response.json({ error: `Muitas tentativas de cadastro. Tente novamente em cerca de ${Math.ceil(attempt.retryAfterSeconds / 60)} minuto(s).` }, { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } }));

  try {
    const user = await createAccount(email, displayName, password, profilePhoto);
    const response = withCors(Response.json({ user }));
    response.headers.append("Set-Cookie", await startSession(user.userId, new URL(request.url).protocol === "https:"));
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "Este e-mail já está cadastrado.") return withCors(Response.json({ error: error.message }, { status: 409 }));
    console.error("Falha ao criar conta", error);
    return withCors(Response.json({ error: "Não foi possível criar sua conta agora. Tente novamente." }, { status: 500 }));
  }
}

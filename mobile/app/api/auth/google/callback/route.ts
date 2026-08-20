import { cookies } from "next/headers";
import { env } from "cloudflare:workers";
import { authenticateGoogle, startSession } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";

function secret(name: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET") {
  return (env as unknown as Record<string, string | undefined>)[name] || process.env[name] || "";
}

function failure(message: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const response = Response.redirect(new URL(`/auth?error=${encodeURIComponent(message)}`, request.url), 302);
  response.headers.append("Set-Cookie", `verbo_google_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return failure("O login Google foi cancelado.", request);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = (await cookies()).get("verbo_google_state")?.value;
  if (!code || !state || !storedState || state !== storedState) return failure("Não foi possível validar o login Google.", request);
  const clientId = secret("GOOGLE_CLIENT_ID");
  const clientSecret = secret("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return failure("Login Google não configurado no servidor.", request);

  try {
    const redirectUri = new URL("/api/auth/google/callback", request.url).toString();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
    if (!tokenResponse.ok) return failure("O Google não autorizou este login.", request);
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) return failure("Resposta inválida do Google.", request);
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!profileResponse.ok) return failure("Não foi possível carregar sua conta Google.", request);
    const profile = await profileResponse.json() as { email?: string; email_verified?: boolean; name?: string };
    if (!profile.email || profile.email_verified !== true) return failure("O Google não confirmou este e-mail.", request);
    const user = await authenticateGoogle(profile.email, profile.name || profile.email.split("@")[0]);
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    const response = Response.redirect(new URL("/", request.url), 302);
    response.headers.append("Set-Cookie", await startSession(user.userId));
    response.headers.append("Set-Cookie", `verbo_google_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    return response;
  } catch (error) {
    console.error("Falha no login Google", error);
    return failure("Não foi possível concluir o login Google.", request);
  }
}
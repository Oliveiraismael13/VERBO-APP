import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

function clientId() {
  return (env as unknown as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
}

export function GET(request: Request) {
  const id = clientId();
  if (!id) return Response.json({ error: "Login Google não configurado no servidor." }, { status: 503 });
  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/auth/google/callback", request.url).toString();
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.search = new URLSearchParams({ client_id: id, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, prompt: "select_account" }).toString();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const response = Response.redirect(authorization, 302);
  response.headers.append("Set-Cookie", `verbo_google_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
  return response;
}
import { clearSessionCookie } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";

export function OPTIONS() { return corsOptions(); }

export async function POST() {
  const response = withCors(Response.json({ ok: true }));
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}

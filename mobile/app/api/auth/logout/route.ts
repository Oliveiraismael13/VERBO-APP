import { clearSessionCookie } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";

export function OPTIONS() { return corsOptions(); }

export async function POST(request: Request) {
  const response = withCors(Response.json({ ok: true }));
  response.headers.append("Set-Cookie", clearSessionCookie(new URL(request.url).protocol === "https:"));
  return response;
}

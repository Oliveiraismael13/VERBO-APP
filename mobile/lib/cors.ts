const allowedOrigin = "http://localhost:4173";

export function withCors(response: Response) {
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Vary", "Origin");
  return response;
}

export function corsOptions() {
  return withCors(new Response(null, { status: 204, headers: { "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } }));
}

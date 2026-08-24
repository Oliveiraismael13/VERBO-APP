import { currentUser } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";
import { listOwnSharedNotes, shareSocialNote, unshareSocialNote } from "../../../../lib/social";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    return withCors(Response.json({ notes: await listOwnSharedNotes(user.id) }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível carregar as anotações compartilhadas" }, { status: 500 }));
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const body = await request.json() as { action?: "share" | "unshare"; reference?: string };
    const result = body.action === "share" ? await shareSocialNote(user.id, body.reference) : body.action === "unshare" ? await unshareSocialNote(user.id, body.reference) : { ok: false as const, status: 400, error: "Ação inválida" };
    if (!result.ok) return withCors(Response.json({ error: result.error }, { status: result.status }));
    return withCors(Response.json({ notes: await listOwnSharedNotes(user.id) }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível atualizar a anotação compartilhada" }, { status: 500 }));
  }
}

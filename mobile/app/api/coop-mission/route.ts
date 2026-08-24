import { currentUser } from "../../../lib/auth";
import { corsOptions, withCors } from "../../../lib/cors";
import { getCoopMissionState, inviteToCoopMission, leaveCoopMission, respondToCoopMission } from "../../../lib/coop-mission";
import { listFriends } from "../../../lib/social";

export const dynamic = "force-dynamic";
export function OPTIONS() { return corsOptions(); }

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const [state, friends] = await Promise.all([getCoopMissionState(user.id), listFriends(user.id)]);
    return withCors(Response.json({ state, friends }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível carregar o modo cooperativo" }, { status: 500 }));
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const body = await request.json() as { action?: string; publicHandle?: unknown; dailyGoal?: unknown; sessionId?: unknown };
    const result = body.action === "invite" ? await inviteToCoopMission(user.id, body.publicHandle, body.dailyGoal)
      : body.action === "accept" ? await respondToCoopMission(user.id, body.sessionId, true)
        : body.action === "decline" ? await respondToCoopMission(user.id, body.sessionId, false)
          : body.action === "leave" ? await leaveCoopMission(user.id, body.sessionId)
            : { ok: false as const, status: 400, error: "Ação cooperativa inválida." };
    if (!result.ok) return withCors(Response.json({ error: result.error }, { status: result.status }));
    return withCors(Response.json({ state: await getCoopMissionState(user.id) }));
  } catch {
    return withCors(Response.json({ error: "Não foi possível atualizar o modo cooperativo" }, { status: 500 }));
  }
}

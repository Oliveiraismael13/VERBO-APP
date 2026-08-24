import { currentUser } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";
import { getSocialPrivacy, saveSocialPrivacy, type SocialPrivacy } from "../../../../lib/social";

export const dynamic = "force-dynamic";

type PrivacyUpdate = Partial<Omit<SocialPrivacy, "publicHandle">>;

export function OPTIONS() { return corsOptions(); }

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    return withCors(Response.json(await getSocialPrivacy(user.id)));
  } catch {
    return withCors(Response.json({ error: "Não foi possível carregar as preferências sociais" }, { status: 500 }));
  }
}

function isBoolean(value: unknown): value is boolean { return typeof value === "boolean"; }

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const body = await request.json() as PrivacyUpdate;
    const current = await getSocialPrivacy(user.id);
    if (body.profileVisibility !== undefined && body.profileVisibility !== "friends" && body.profileVisibility !== "private") {
      return withCors(Response.json({ error: "A visibilidade do perfil é inválida" }, { status: 400 }));
    }
    for (const key of ["showProgress", "showFavorites", "showNotes", "showActivities", "showStats", "allowFriendRequests"] as const) {
      if (body[key] !== undefined && !isBoolean(body[key])) return withCors(Response.json({ error: "As preferências devem ser verdadeiras ou falsas" }, { status: 400 }));
    }
    const next = {
      profileVisibility: body.profileVisibility ?? current.profileVisibility,
      showProgress: body.showProgress ?? current.showProgress,
      showFavorites: body.showFavorites ?? current.showFavorites,
      showNotes: body.showNotes ?? current.showNotes,
      showActivities: body.showActivities ?? current.showActivities,
      showStats: body.showStats ?? current.showStats,
      allowFriendRequests: body.allowFriendRequests ?? current.allowFriendRequests,
    };
    return withCors(Response.json(await saveSocialPrivacy(user.id, next)));
  } catch {
    return withCors(Response.json({ error: "Não foi possível salvar as preferências sociais" }, { status: 500 }));
  }
}

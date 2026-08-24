import { env } from "cloudflare:workers";
import { currentUser } from "../../../lib/auth";
import { corsOptions, withCors } from "../../../lib/cors";
import { secondaryMissionById, secondaryMissions } from "../../../lib/secondary-missions";

export const dynamic = "force-dynamic";

type MissionRow = { mission_id: string; active: number; completed_at: number | null };

export function OPTIONS() { return corsOptions(); }

async function ensureSchema() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS user_progress (user_id TEXT PRIMARY KEY, xp INTEGER NOT NULL DEFAULT 0, level INTEGER NOT NULL DEFAULT 1, coins INTEGER NOT NULL DEFAULT 0, last_active_at INTEGER, streak INTEGER NOT NULL DEFAULT 0, last_streak_at INTEGER, streak_before_break INTEGER NOT NULL DEFAULT 0, missed_streak_days INTEGER NOT NULL DEFAULT 0, restored_streak_days INTEGER NOT NULL DEFAULT 0, achievements_json TEXT NOT NULL DEFAULT '[]', last_reading_json TEXT, updated_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS completed_chapters (user_id TEXT NOT NULL, book_slug TEXT NOT NULL, chapter INTEGER NOT NULL, completed_at INTEGER NOT NULL, PRIMARY KEY(user_id, book_slug, chapter), FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS user_secondary_missions (user_id TEXT NOT NULL, mission_id TEXT NOT NULL, unlocked_at INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0, 1)), completed_at INTEGER, PRIMARY KEY(user_id, mission_id), FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_user_secondary_missions_active ON user_secondary_missions(user_id, active)"),
  ]);
}

async function stateFor(userId: string) {
  const [records, chapters, progress] = await Promise.all([
    env.DB.prepare("SELECT mission_id, active, completed_at FROM user_secondary_missions WHERE user_id = ?").bind(userId).all<MissionRow>(),
    env.DB.prepare("SELECT book_slug, chapter FROM completed_chapters WHERE user_id = ?").bind(userId).all<{ book_slug: string; chapter: number }>().catch(() => ({ results: [] })),
    env.DB.prepare("SELECT coins FROM user_progress WHERE user_id = ?").bind(userId).first<{ coins: number }>(),
  ]);
  const completed = new Set(chapters.results.map((chapter) => `${chapter.book_slug}:${chapter.chapter}`));
  return {
    coins: progress?.coins ?? 0,
    missions: secondaryMissions.map((mission) => {
      const record = records.results.find((item) => item.mission_id === mission.id);
      const total = mission.to - mission.from + 1;
      const done = Array.from({ length: total }, (_, index) => completed.has(`${mission.bookSlug}:${mission.from + index}`)).filter(Boolean).length;
      return { id: mission.id, unlocked: Boolean(record), active: Boolean(record?.active), completed: Boolean(record?.completed_at), replaying: Boolean(record?.active && record?.completed_at), done, total };
    }),
  };
}

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    await ensureSchema();
    return withCors(Response.json(await stateFor(user.id)));
  } catch {
    return withCors(Response.json({ error: "Não foi possível carregar as missões secundárias" }, { status: 500 }));
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    const body = await request.json() as { missionId?: string };
    const mission = secondaryMissionById(String(body.missionId || ""));
    if (!mission) return withCors(Response.json({ error: "Missão secundária inválida" }, { status: 400 }));
    await ensureSchema();
    const existing = await env.DB.prepare("SELECT mission_id FROM user_secondary_missions WHERE user_id = ? AND mission_id = ?").bind(user.id, mission.id).first<MissionRow>();
    if (!existing) {
      const paid = await env.DB.prepare("UPDATE user_progress SET coins = coins - ? WHERE user_id = ? AND coins >= ?").bind(mission.cost, user.id, mission.cost).run();
      if (!paid.meta.changes) return withCors(Response.json({ error: `Você precisa de ${mission.cost} siclos de prata para desbloquear esta missão.` }, { status: 400 }));
      await env.DB.prepare("INSERT INTO user_secondary_missions (user_id, mission_id, unlocked_at, active) VALUES (?, ?, ?, 1)").bind(user.id, mission.id, Date.now()).run();
    } else {
      await env.DB.prepare("UPDATE user_secondary_missions SET active = 1 WHERE user_id = ? AND mission_id = ?").bind(user.id, mission.id).run();
    }
    await env.DB.prepare("UPDATE user_secondary_missions SET active = 0 WHERE user_id = ? AND mission_id <> ?").bind(user.id, mission.id).run();
    return withCors(Response.json(await stateFor(user.id)));
  } catch {
    return withCors(Response.json({ error: "Não foi possível desbloquear a missão" }, { status: 500 }));
  }
}

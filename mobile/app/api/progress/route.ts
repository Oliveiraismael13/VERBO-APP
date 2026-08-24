import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { currentUser as getSessionUser } from "../../../lib/auth";
import { corsOptions, withCors } from "../../../lib/cors";
import { levelForXp } from "../../../lib/xp";
import { campaignActs, missionForChapter as findCampaignMission, type CampaignAct } from "../../../lib/campaign";

export const dynamic = "force-dynamic";

export function OPTIONS() { return corsOptions(); }

type ProgressRow = {
  xp: number;
  level: number;
  coins: number;
  streak: number;
  last_read_date: string | null;
  last_login_date: string | null;
  last_note_date: string | null;
};

const NOTE_XP = 15;
const defaultProgress = { xp: 0, level: 1, coins: 0, streak: 0, completed: [] as string[], achievements: [] as string[], dailyNoteCompleted: false };
function todayInBrazil() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function previousDay(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function missionForChapter(slug: string, chapter: number) {
  return findCampaignMission(slug, chapter);
}

function actForChapter(slug: string, chapter: number) {
  return campaignActs.find((act) => act.ranges.some((range) => range.slug === slug && chapter >= range.from && chapter <= range.to));
}

async function completesAct(userId: string, act: CampaignAct, completingSlug: string, completingChapter: number) {
  for (const range of act.ranges) {
    const completed = (await env.DB.prepare("SELECT COUNT(*) AS total FROM completed_chapters WHERE user_id = ? AND book_slug = ? AND chapter BETWEEN ? AND ?").bind(userId, range.slug, range.from, range.to).first<{ total: number }>())?.total ?? 0;
    const missingCurrentChapter = range.slug === completingSlug && completingChapter >= range.from && completingChapter <= range.to ? 1 : 0;
    if (completed !== range.to - range.from + 1 - missingCurrentChapter) return false;
  }
  return true;
}

async function currentUser() {
  const session = await getSessionUser();
  if (session) return { id: session.id, email: session.email };
  const user = await getChatGPTUser();
  if (user) return { id: user.userId, email: user.email };
  if (process.env.NODE_ENV === "development") return { id: "local-verbo-player", email: "marcioismael12@gmail.com" };
  return null;
}

async function ensureSchema() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, display_name TEXT, created_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS user_progress (user_id TEXT PRIMARY KEY NOT NULL, xp INTEGER DEFAULT 0 NOT NULL, level INTEGER DEFAULT 1 NOT NULL, coins INTEGER DEFAULT 0 NOT NULL, streak INTEGER DEFAULT 0 NOT NULL, last_read_date TEXT, last_login_date TEXT, last_note_date TEXT, updated_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS completed_chapters (user_id TEXT NOT NULL, book_slug TEXT NOT NULL, chapter INTEGER NOT NULL, completed_at INTEGER NOT NULL, PRIMARY KEY (user_id, book_slug, chapter), FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_completed_chapters_user_date ON completed_chapters(user_id, completed_at)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS user_achievements (user_id TEXT NOT NULL, code TEXT NOT NULL, unlocked_at INTEGER NOT NULL, PRIMARY KEY (user_id, code), FOREIGN KEY (user_id) REFERENCES users(id))"),
  ]);
  const columns = await env.DB.prepare("PRAGMA table_info(user_progress)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "last_login_date")) {
    await env.DB.prepare("ALTER TABLE user_progress ADD COLUMN last_login_date TEXT").run();
  }
  if (!columns.results.some((column) => column.name === "last_note_date")) {
    await env.DB.prepare("ALTER TABLE user_progress ADD COLUMN last_note_date TEXT").run();
  }
}

async function ensureUser(user: { id: string; email: string }) {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO users (id, display_name, created_at) VALUES (?, ?, ?)").bind(user.id, user.email.split("@")[0], now),
    env.DB.prepare("INSERT OR IGNORE INTO user_progress (user_id, xp, level, coins, streak, updated_at) VALUES (?, 0, 1, 0, 0, ?)").bind(user.id, now),
  ]);
}

async function loadProgress(userId: string) {
  const [progress, chapters, achievements] = await Promise.all([
    env.DB.prepare("SELECT xp, level, coins, streak, last_read_date, last_note_date FROM user_progress WHERE user_id = ?").bind(userId).first<ProgressRow>(),
    env.DB.prepare("SELECT book_slug, chapter FROM completed_chapters WHERE user_id = ? ORDER BY completed_at DESC").bind(userId).all<{ book_slug: string; chapter: number }>(),
    env.DB.prepare("SELECT code FROM user_achievements WHERE user_id = ? ORDER BY unlocked_at DESC").bind(userId).all<{ code: string }>(),
  ]);
  return {
    xp: progress?.xp ?? 0,
    level: levelForXp(progress?.xp ?? 0),
    coins: progress?.coins ?? 0,
    streak: progress?.streak ?? 0,
    dailyNoteCompleted: progress?.last_note_date === todayInBrazil(),
    completed: chapters.results.map((item) => `${item.book_slug}:${item.chapter}`),
    achievements: achievements.results.map((item) => item.code),
  };
}

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    await ensureSchema();
    await ensureUser(user);
    const current = await env.DB.prepare("SELECT streak, last_read_date, last_login_date FROM user_progress WHERE user_id = ?").bind(user.id).first<ProgressRow>();
    const today = todayInBrazil();
    const lastLogin = current?.last_login_date ?? current?.last_read_date;
    if (lastLogin !== today) {
      if (!lastLogin) {
        await env.DB.prepare("UPDATE user_progress SET streak = 1, last_login_date = ?, updated_at = ? WHERE user_id = ?").bind(today, Date.now(), user.id).run();
      } else if (lastLogin === previousDay(today)) {
        const nextStreak = (current?.streak ?? 0) + 1;
        await env.DB.prepare("UPDATE user_progress SET streak = ?, last_login_date = ?, updated_at = ? WHERE user_id = ?").bind(nextStreak, today, Date.now(), user.id).run();
      } else {
        await env.DB.prepare("UPDATE user_progress SET streak = 0, last_login_date = ?, updated_at = ? WHERE user_id = ?")
          .bind(today, Date.now(), user.id).run();
      }
    }
    return withCors(Response.json(await loadProgress(user.id)));
  } catch (error) {
    console.error("Falha ao carregar progresso", error);
    return withCors(Response.json(defaultProgress));
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  const body = await request.json() as { action?: "note"; bookSlug?: string; chapter?: number };

  try {
    await ensureSchema();
    await ensureUser(user);
    if (body.action === "note") {
      const current = await env.DB.prepare("SELECT xp, level, last_note_date FROM user_progress WHERE user_id = ?").bind(user.id).first<ProgressRow>();
      const today = todayInBrazil();
      if (current?.last_note_date === today) return withCors(Response.json({ ...(await loadProgress(user.id)), reward: null }));
      const nextXp = (current?.xp ?? 0) + NOTE_XP;
      const nextLevel = levelForXp(nextXp);
      await env.DB.prepare("UPDATE user_progress SET xp = ?, level = ?, last_note_date = ?, updated_at = ? WHERE user_id = ?")
        .bind(nextXp, nextLevel, today, Date.now(), user.id).run();
      return withCors(Response.json({ ...(await loadProgress(user.id)), reward: { xp: NOTE_XP, coins: 0, levelUp: nextLevel > (current?.level ?? 1) } }));
    }
    if (!body.bookSlug || !/^[a-z0-9]+$/.test(body.bookSlug) || !Number.isInteger(body.chapter) || body.chapter! < 1 || body.chapter! > 150) {
      return withCors(Response.json({ error: "Capítulo inválido" }, { status: 400 }));
    }
    const existing = await env.DB.prepare("SELECT 1 AS found FROM completed_chapters WHERE user_id = ? AND book_slug = ? AND chapter = ?")
      .bind(user.id, body.bookSlug, body.chapter).first<{ found: number }>();
    if (existing) return withCors(Response.json({ ...(await loadProgress(user.id)), reward: null }));

    const current = await env.DB.prepare("SELECT xp, level, streak, last_read_date FROM user_progress WHERE user_id = ?").bind(user.id).first<ProgressRow>();
    const today = todayInBrazil();
    const nextStreak = current?.streak ?? 0;
    const campaignMission = missionForChapter(body.bookSlug, body.chapter);
    const mission = campaignMission?.mission;
    const completedBefore = mission ? (await env.DB.prepare("SELECT COUNT(*) AS total FROM completed_chapters WHERE user_id = ? AND book_slug = ? AND chapter BETWEEN ? AND ?").bind(user.id, mission.slug, mission.from, mission.to).first<{ total: number }>())?.total ?? 0 : 0;
    const missionCompleted = Boolean(mission && completedBefore === mission.to - mission.from);
    const act = actForChapter(body.bookSlug, body.chapter);
    const actCompleted = Boolean(act && await completesAct(user.id, act, body.bookSlug, body.chapter));
    const xpGain = actCompleted ? 100 : missionCompleted ? 80 : 40;
    const coinGain = actCompleted ? 10 : missionCompleted ? 8 : 4;
    const nextXp = (current?.xp ?? 0) + xpGain;
    const nextLevel = levelForXp(nextXp);
    const now = Date.now();

    await env.DB.batch([
      env.DB.prepare("INSERT INTO completed_chapters (user_id, book_slug, chapter, completed_at) VALUES (?, ?, ?, ?)").bind(user.id, body.bookSlug, body.chapter, now),
      env.DB.prepare("UPDATE user_progress SET xp = ?, level = ?, coins = coins + ?, last_read_date = ?, updated_at = ? WHERE user_id = ?")
        .bind(nextXp, nextLevel, coinGain, today, now, user.id),
    ]);

    const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM completed_chapters WHERE user_id = ?").bind(user.id).first<{ total: number }>();
    const unlocked: string[] = [];
    for (const [threshold, code] of [[1, "first_chapter"], [5, "faithful_reader"], [10, "scroll_keeper"], [25, "word_explorer"]] as const) {
      if ((count?.total ?? 0) >= threshold) {
        const result = await env.DB.prepare("INSERT OR IGNORE INTO user_achievements (user_id, code, unlocked_at) VALUES (?, ?, ?)").bind(user.id, code, now).run();
        if (result.meta.changes) unlocked.push(code);
      }
    }
    for (const [threshold, code] of [[10, "streak_10"], [50, "streak_50"], [100, "streak_100"], [365, "streak_365"]] as const) {
      if (nextStreak >= threshold) {
        const result = await env.DB.prepare("INSERT OR IGNORE INTO user_achievements (user_id, code, unlocked_at) VALUES (?, ?, ?)").bind(user.id, code, now).run();
        if (result.meta.changes) unlocked.push(code);
      }
    }

    return withCors(Response.json({ ...(await loadProgress(user.id)), reward: { xp: xpGain, coins: coinGain, levelUp: nextLevel > (current?.level ?? 1), unlocked, missionCompleted: Boolean(missionCompleted), missionTitle: missionCompleted ? mission?.title : undefined, actCompleted, actTitle: actCompleted ? act?.title : undefined } }));
  } catch (error) {
    console.error("Falha ao concluir capítulo", error);
    return withCors(Response.json({ error: "Não foi possível salvar o progresso" }, { status: 500 }));
  }
}

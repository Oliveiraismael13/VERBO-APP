import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

type ProgressRow = {
  xp: number;
  level: number;
  coins: number;
  streak: number;
  last_read_date: string | null;
};

const defaultProgress = { xp: 0, level: 1, coins: 0, streak: 0, completed: [] as string[], achievements: [] as string[] };

function todayInBrazil() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function previousDay(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

async function currentUser() {
  const user = await getChatGPTUser();
  if (user) return { id: user.userId, email: user.email };
  if (process.env.NODE_ENV === "development") return { id: "local-verbo-player", email: "marcioismael12@gmail.com" };
  return null;
}

async function ensureSchema() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, display_name TEXT, created_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS user_progress (user_id TEXT PRIMARY KEY NOT NULL, xp INTEGER DEFAULT 0 NOT NULL, level INTEGER DEFAULT 1 NOT NULL, coins INTEGER DEFAULT 0 NOT NULL, streak INTEGER DEFAULT 0 NOT NULL, last_read_date TEXT, updated_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS completed_chapters (user_id TEXT NOT NULL, book_slug TEXT NOT NULL, chapter INTEGER NOT NULL, completed_at INTEGER NOT NULL, PRIMARY KEY (user_id, book_slug, chapter), FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_completed_chapters_user_date ON completed_chapters(user_id, completed_at)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS user_achievements (user_id TEXT NOT NULL, code TEXT NOT NULL, unlocked_at INTEGER NOT NULL, PRIMARY KEY (user_id, code), FOREIGN KEY (user_id) REFERENCES users(id))"),
  ]);
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
    env.DB.prepare("SELECT xp, level, coins, streak, last_read_date FROM user_progress WHERE user_id = ?").bind(userId).first<ProgressRow>(),
    env.DB.prepare("SELECT book_slug, chapter FROM completed_chapters WHERE user_id = ? ORDER BY completed_at DESC").bind(userId).all<{ book_slug: string; chapter: number }>(),
    env.DB.prepare("SELECT code FROM user_achievements WHERE user_id = ? ORDER BY unlocked_at DESC").bind(userId).all<{ code: string }>(),
  ]);
  return {
    xp: progress?.xp ?? 0,
    level: progress?.level ?? 1,
    coins: progress?.coins ?? 0,
    streak: progress?.streak ?? 0,
    completed: chapters.results.map((item) => `${item.book_slug}:${item.chapter}`),
    achievements: achievements.results.map((item) => item.code),
  };
}

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  try {
    await ensureSchema();
    await ensureUser(user);
    return Response.json(await loadProgress(user.id));
  } catch (error) {
    console.error("Falha ao carregar progresso", error);
    return Response.json(defaultProgress);
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const body = await request.json() as { bookSlug?: string; chapter?: number };
  if (!body.bookSlug || !/^[a-z0-9]+$/.test(body.bookSlug) || !Number.isInteger(body.chapter) || body.chapter! < 1 || body.chapter! > 150) {
    return Response.json({ error: "Capítulo inválido" }, { status: 400 });
  }

  try {
    await ensureSchema();
    await ensureUser(user);
    const existing = await env.DB.prepare("SELECT 1 AS found FROM completed_chapters WHERE user_id = ? AND book_slug = ? AND chapter = ?")
      .bind(user.id, body.bookSlug, body.chapter).first<{ found: number }>();
    if (existing) return Response.json({ ...(await loadProgress(user.id)), reward: null });

    const current = await env.DB.prepare("SELECT xp, streak, last_read_date FROM user_progress WHERE user_id = ?").bind(user.id).first<ProgressRow>();
    const today = todayInBrazil();
    const firstToday = current?.last_read_date !== today;
    const nextStreak = firstToday ? (current?.last_read_date === previousDay(today) ? (current?.streak ?? 0) + 1 : 1) : (current?.streak ?? 0);
    const xpGain = firstToday ? 60 : 40;
    const coinGain = firstToday ? 13 : 8;
    const nextXp = (current?.xp ?? 0) + xpGain;
    const nextLevel = Math.floor(nextXp / 200) + 1;
    const now = Date.now();

    await env.DB.batch([
      env.DB.prepare("INSERT INTO completed_chapters (user_id, book_slug, chapter, completed_at) VALUES (?, ?, ?, ?)").bind(user.id, body.bookSlug, body.chapter, now),
      env.DB.prepare("UPDATE user_progress SET xp = ?, level = ?, coins = coins + ?, streak = ?, last_read_date = ?, updated_at = ? WHERE user_id = ?")
        .bind(nextXp, nextLevel, coinGain, nextStreak, today, now, user.id),
    ]);

    const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM completed_chapters WHERE user_id = ?").bind(user.id).first<{ total: number }>();
    const unlocked: string[] = [];
    for (const [threshold, code] of [[1, "first_chapter"], [5, "faithful_reader"], [10, "scroll_keeper"], [25, "word_explorer"]] as const) {
      if ((count?.total ?? 0) >= threshold) {
        const result = await env.DB.prepare("INSERT OR IGNORE INTO user_achievements (user_id, code, unlocked_at) VALUES (?, ?, ?)").bind(user.id, code, now).run();
        if (result.meta.changes) unlocked.push(code);
      }
    }

    return Response.json({ ...(await loadProgress(user.id)), reward: { xp: xpGain, coins: coinGain, levelUp: nextLevel > (current?.level ?? 1), unlocked } });
  } catch (error) {
    console.error("Falha ao concluir capítulo", error);
    return Response.json({ error: "Não foi possível salvar o progresso" }, { status: 500 });
  }
}

import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { currentUser as getSessionUser } from "../../../lib/auth";
import { corsOptions, withCors } from "../../../lib/cors";
import { levelForXp } from "../../../lib/xp";
import { campaignActs, missionForChapter as findCampaignMission, type CampaignAct } from "../../../lib/campaign";
import { recordSocialActivity } from "../../../lib/social";
import { secondaryMissionById } from "../../../lib/secondary-missions";
import { CoopMissionChapterError, CoopMissionLockedError, ensureCoopChapterCanBeCompleted, getCoopMissionState, recordCoopChapter } from "../../../lib/coop-mission";

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
  streak_before_break: number;
  missed_streak_days: number;
};

const NOTE_XP = 15;
const SCROLL_XP = 20;
const STREAK_RESTORE_COIN_COST = 100;
const defaultProgress = { xp: 0, level: 1, coins: 0, streak: 0, completed: [] as string[], achievements: [] as string[], dailyNoteCompleted: false };

function secondarySecretRequirement(userId: string, missionId: string) {
  let hash = 2166136261;
  for (const character of `${userId}:${missionId}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) % 2 === 0 ? "favorite" : "notes-two";
}

function parseLibrary(value: string | null | undefined, fallback: unknown) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}
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

function daysBetween(start: string, end: string) {
  return Math.max(0, Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000));
}

function xpBonusPercent(streak: number) {
  return Math.min(30, Math.floor(streak / 10));
}

function xpWithStreakBonus(baseXp: number, streak: number) {
  return Math.ceil(baseXp * (100 + xpBonusPercent(streak)) / 100);
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
    env.DB.prepare("CREATE TABLE IF NOT EXISTS user_progress (user_id TEXT PRIMARY KEY NOT NULL, xp INTEGER DEFAULT 0 NOT NULL, level INTEGER DEFAULT 1 NOT NULL, coins INTEGER DEFAULT 0 NOT NULL, streak INTEGER DEFAULT 0 NOT NULL, last_read_date TEXT, last_login_date TEXT, last_note_date TEXT, streak_before_break INTEGER DEFAULT 0 NOT NULL, missed_streak_days INTEGER DEFAULT 0 NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS completed_chapters (user_id TEXT NOT NULL, book_slug TEXT NOT NULL, chapter INTEGER NOT NULL, completed_at INTEGER NOT NULL, PRIMARY KEY (user_id, book_slug, chapter), FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_completed_chapters_user_date ON completed_chapters(user_id, completed_at)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS user_secondary_missions (user_id TEXT NOT NULL, mission_id TEXT NOT NULL, unlocked_at INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0, 1)), completed_at INTEGER, PRIMARY KEY(user_id, mission_id), FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_user_secondary_missions_active ON user_secondary_missions(user_id, active)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS user_achievements (user_id TEXT NOT NULL, code TEXT NOT NULL, unlocked_at INTEGER NOT NULL, PRIMARY KEY (user_id, code), FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS user_scroll_rewards (user_id TEXT NOT NULL, scroll_key TEXT NOT NULL, found_at INTEGER NOT NULL, PRIMARY KEY(user_id, scroll_key), FOREIGN KEY (user_id) REFERENCES users(id))"),
  ]);
  const columns = await env.DB.prepare("PRAGMA table_info(user_progress)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "last_login_date")) {
    await env.DB.prepare("ALTER TABLE user_progress ADD COLUMN last_login_date TEXT").run();
  }
  if (!columns.results.some((column) => column.name === "last_note_date")) {
    await env.DB.prepare("ALTER TABLE user_progress ADD COLUMN last_note_date TEXT").run();
  }
  if (!columns.results.some((column) => column.name === "streak_before_break")) {
    await env.DB.prepare("ALTER TABLE user_progress ADD COLUMN streak_before_break INTEGER DEFAULT 0 NOT NULL").run();
  }
  if (!columns.results.some((column) => column.name === "missed_streak_days")) {
    await env.DB.prepare("ALTER TABLE user_progress ADD COLUMN missed_streak_days INTEGER DEFAULT 0 NOT NULL").run();
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
  const [progress, chapters, achievements, coop] = await Promise.all([
    env.DB.prepare("SELECT xp, level, coins, streak, last_read_date, last_note_date, streak_before_break, missed_streak_days FROM user_progress WHERE user_id = ?").bind(userId).first<ProgressRow>(),
    env.DB.prepare("SELECT book_slug, chapter FROM completed_chapters WHERE user_id = ? ORDER BY completed_at DESC").bind(userId).all<{ book_slug: string; chapter: number }>(),
    env.DB.prepare("SELECT code FROM user_achievements WHERE user_id = ? ORDER BY unlocked_at DESC").bind(userId).all<{ code: string }>(),
    getCoopMissionState(userId),
  ]);
  return {
    xp: progress?.xp ?? 0,
    level: levelForXp(progress?.xp ?? 0),
    coins: progress?.coins ?? 0,
    streak: progress?.streak ?? 0,
    xpBonusPercent: xpBonusPercent(progress?.streak ?? 0),
    missedStreakDays: progress?.missed_streak_days ?? 0,
    dailyNoteCompleted: progress?.last_note_date === todayInBrazil(),
    completed: chapters.results.map((item) => `${item.book_slug}:${item.chapter}`),
    achievements: achievements.results.map((item) => item.code),
    coop,
  };
}

export async function GET() {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  try {
    await ensureSchema();
    await ensureUser(user);
    return withCors(Response.json(await loadProgress(user.id)));
  } catch (error) {
    console.error("Falha ao carregar progresso", error);
    return withCors(Response.json(defaultProgress));
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  const body = await request.json() as { action?: "note" | "restore-streak" | "scroll"; bookSlug?: string; chapter?: number; coop?: boolean; scrollKeys?: string[] };

  try {
    await ensureSchema();
    await ensureUser(user);
    if (body.action === "scroll") {
      const scrollKeys = Array.isArray(body.scrollKeys) ? body.scrollKeys : [];
      const requestedKeys = Array.from(new Set(scrollKeys.filter((key): key is string => typeof key === "string"))).slice(0, 2);
      if (!requestedKeys.length) return withCors(Response.json({ error: "Pergaminho inválido" }, { status: 400 }));

      for (const key of requestedKeys) {
        const primary = /^primary:([a-z0-9]+):(\d+)$/.exec(key);
        const secondary = /^secondary:([a-z0-9-]+):(\d+):(\d+)$/.exec(key);
        const bookSlug = primary?.[1] || (secondary ? secondaryMissionById(secondary[1])?.bookSlug : undefined);
        const chapter = Number(primary?.[2] || secondary?.[2]);
        if (!bookSlug || !Number.isInteger(chapter) || chapter < 1) return withCors(Response.json({ error: "Pergaminho inválido" }, { status: 400 }));
        if (primary && !missionForChapter(bookSlug, chapter)) return withCors(Response.json({ error: "Pergaminho inválido" }, { status: 400 }));
        if (secondary) {
          const mission = secondaryMissionById(secondary[1]);
          const scrollIndex = Number(secondary[3]);
          const normalScrollCount = mission?.insights[chapter]?.length ?? 0;
          const isHiddenScroll = Boolean(mission?.hiddenInsight?.chapter === chapter && scrollIndex === normalScrollCount);
          if (!mission || chapter < mission.from || chapter > mission.to || (scrollIndex >= normalScrollCount && !isHiddenScroll)) return withCors(Response.json({ error: "Pergaminho inválido" }, { status: 400 }));
          if (isHiddenScroll) {
            const active = await env.DB.prepare("SELECT 1 FROM user_secondary_missions WHERE user_id = ? AND mission_id = ? AND active = 1 AND completed_at IS NULL").bind(user.id, mission.id).first();
            if (!active) return withCors(Response.json({ error: "Este pergaminho só pode ser encontrado durante a missão." }, { status: 400 }));
            const library = await env.DB.prepare("SELECT favorites_json, notes_json FROM user_library WHERE user_id = ?").bind(user.id).first<{ favorites_json: string; notes_json: string }>();
            const prefix = `${bookSlug}:${chapter}:`;
            const favorites = parseLibrary(library?.favorites_json, []) as string[];
            const notes = parseLibrary(library?.notes_json, {}) as Record<string, string>;
            const hasFavorite = favorites.some((key) => typeof key === "string" && key.startsWith(prefix));
            const noteCount = Object.entries(notes).filter(([key, note]) => key.startsWith(prefix) && typeof note === "string" && Boolean(note.trim())).length;
            const requirement = secondarySecretRequirement(user.id, mission.id);
            if ((requirement === "favorite" && !hasFavorite) || (requirement === "notes-two" && noteCount < 2)) return withCors(Response.json({ ...(await loadProgress(user.id)), reward: null }));
          } else {
            const completed = await env.DB.prepare("SELECT 1 FROM completed_chapters WHERE user_id = ? AND book_slug = ? AND chapter = ?").bind(user.id, bookSlug, chapter).first();
            if (!completed) return withCors(Response.json({ error: "Conclua o capítulo para encontrar este pergaminho." }, { status: 400 }));
          }
        }
      }

      const inserts = await env.DB.batch(requestedKeys.map((key) => env.DB.prepare("INSERT OR IGNORE INTO user_scroll_rewards (user_id, scroll_key, found_at) VALUES (?, ?, ?)").bind(user.id, key, Date.now())));
      const awardedCount = inserts.filter((result) => result.meta.changes > 0).length;
      if (!awardedCount) return withCors(Response.json({ ...(await loadProgress(user.id)), reward: null }));
      const current = await env.DB.prepare("SELECT xp, level FROM user_progress WHERE user_id = ?").bind(user.id).first<ProgressRow>();
      const xpGain = SCROLL_XP * awardedCount;
      const nextXp = (current?.xp ?? 0) + xpGain;
      const nextLevel = levelForXp(nextXp);
      await env.DB.prepare("UPDATE user_progress SET xp = ?, level = ?, updated_at = ? WHERE user_id = ?").bind(nextXp, nextLevel, Date.now(), user.id).run();
      return withCors(Response.json({ ...(await loadProgress(user.id)), reward: { xp: xpGain, coins: 0, levelUp: nextLevel > (current?.level ?? 1), scrollsAwarded: awardedCount } }));
    }
    if (body.action === "restore-streak") {
      const current = await env.DB.prepare("SELECT coins, streak_before_break, missed_streak_days FROM user_progress WHERE user_id = ?").bind(user.id).first<ProgressRow>();
      const missedDays = current?.missed_streak_days ?? 0;
      const cost = missedDays * STREAK_RESTORE_COIN_COST;
      if (!missedDays) return withCors(Response.json({ error: "Não há dias perdidos para restaurar." }, { status: 400 }));
      if ((current?.coins ?? 0) < cost) return withCors(Response.json({ error: `Você precisa de ${cost} siclos de prata para restaurar os dias perdidos.` }, { status: 400 }));
      const restoredStreak = current?.streak_before_break ?? 0;
      await env.DB.prepare("UPDATE user_progress SET coins = coins - ?, streak = ?, streak_before_break = 0, missed_streak_days = 0, updated_at = ? WHERE user_id = ?")
        .bind(cost, restoredStreak, Date.now(), user.id).run();
      return withCors(Response.json({ ...(await loadProgress(user.id)), restoration: { cost, nextDay: restoredStreak + 1 } }));
    }
    if (body.action === "note") {
      const current = await env.DB.prepare("SELECT xp, level, streak, last_note_date FROM user_progress WHERE user_id = ?").bind(user.id).first<ProgressRow>();
      const today = todayInBrazil();
      if (current?.last_note_date === today) return withCors(Response.json({ ...(await loadProgress(user.id)), reward: null }));
      const xpGain = xpWithStreakBonus(NOTE_XP, current?.streak ?? 0);
      const nextXp = (current?.xp ?? 0) + xpGain;
      const nextLevel = levelForXp(nextXp);
      await env.DB.prepare("UPDATE user_progress SET xp = ?, level = ?, last_note_date = ?, updated_at = ? WHERE user_id = ?")
        .bind(nextXp, nextLevel, today, Date.now(), user.id).run();
      return withCors(Response.json({ ...(await loadProgress(user.id)), reward: { xp: xpGain, coins: 0, levelUp: nextLevel > (current?.level ?? 1) } }));
    }
    if (!body.bookSlug || !/^[a-z0-9]+$/.test(body.bookSlug) || !Number.isInteger(body.chapter) || body.chapter! < 1 || body.chapter! > 150) {
      return withCors(Response.json({ error: "Capítulo inválido" }, { status: 400 }));
    }
    if (body.coop) {
      const current = await env.DB.prepare("SELECT xp, level, streak, last_read_date, streak_before_break, missed_streak_days FROM user_progress WHERE user_id = ?").bind(user.id).first<ProgressRow>();
      const today = todayInBrazil();
      const lastRead = current?.last_read_date;
      let nextStreak = current?.streak ?? 0;
      let streakBeforeBreak = current?.streak_before_break ?? 0;
      let missedStreakDays = current?.missed_streak_days ?? 0;
      if (lastRead !== today) {
        if (!lastRead) nextStreak = 1;
        else if (lastRead === previousDay(today)) nextStreak += 1;
        else { missedStreakDays += daysBetween(lastRead, today) - 1; streakBeforeBreak = current?.missed_streak_days ? (current?.streak_before_break ?? 0) : nextStreak; nextStreak = 0; }
      }
      const coopRound = await recordCoopChapter(user.id, { bookSlug: body.bookSlug, chapter: body.chapter });
      const xpGain = xpWithStreakBonus(40, nextStreak);
      const nextXp = (current?.xp ?? 0) + xpGain;
      const nextLevel = levelForXp(nextXp);
      await env.DB.prepare("UPDATE user_progress SET xp = ?, level = ?, coins = coins + 4, streak = ?, streak_before_break = ?, missed_streak_days = ?, last_read_date = ?, updated_at = ? WHERE user_id = ?").bind(nextXp, nextLevel, nextStreak, streakBeforeBreak, missedStreakDays, today, Date.now(), user.id).run();
      return withCors(Response.json({ ...(await loadProgress(user.id)), reward: { xp: xpGain, coins: 4, levelUp: nextLevel > (current?.level ?? 1), unlocked: [], coopBonus: true, coopRoundCompleted: coopRound.chapterAdvanced, coopJourneyCompleted: coopRound.journeyCompleted } }));
    }
    const existing = await env.DB.prepare("SELECT 1 AS found FROM completed_chapters WHERE user_id = ? AND book_slug = ? AND chapter = ?")
      .bind(user.id, body.bookSlug, body.chapter).first<{ found: number }>();
    if (existing) return withCors(Response.json({ ...(await loadProgress(user.id)), reward: null }));

    const current = await env.DB.prepare("SELECT xp, level, streak, last_read_date, streak_before_break, missed_streak_days FROM user_progress WHERE user_id = ?").bind(user.id).first<ProgressRow>();
    const today = todayInBrazil();
    const lastRead = current?.last_read_date;
    let nextStreak = current?.streak ?? 0;
    let streakBeforeBreak = current?.streak_before_break ?? 0;
    let missedStreakDays = current?.missed_streak_days ?? 0;
    if (lastRead !== today) {
      if (!lastRead) nextStreak = 1;
      else if (lastRead === previousDay(today)) nextStreak += 1;
      else {
        missedStreakDays += daysBetween(lastRead, today) - 1;
        streakBeforeBreak = current?.missed_streak_days ? (current?.streak_before_break ?? 0) : nextStreak;
        nextStreak = 0;
      }
    }
    const campaignMission = missionForChapter(body.bookSlug, body.chapter);
    const mission = campaignMission?.mission;
    const completedBefore = mission ? (await env.DB.prepare("SELECT COUNT(*) AS total FROM completed_chapters WHERE user_id = ? AND book_slug = ? AND chapter BETWEEN ? AND ?").bind(user.id, mission.slug, mission.from, mission.to).first<{ total: number }>())?.total ?? 0 : 0;
    const missionCompleted = Boolean(mission && completedBefore === mission.to - mission.from);
    const activeSecondaryRow = await env.DB.prepare("SELECT mission_id FROM user_secondary_missions WHERE user_id = ? AND active = 1 AND completed_at IS NULL").bind(user.id).first<{ mission_id: string }>();
    const secondaryMission = activeSecondaryRow ? secondaryMissionById(activeSecondaryRow.mission_id) : null;
    const coopBefore = null;
    const secondaryCompletedBefore = secondaryMission ? (await env.DB.prepare("SELECT COUNT(*) AS total FROM completed_chapters WHERE user_id = ? AND book_slug = ? AND chapter BETWEEN ? AND ?").bind(user.id, secondaryMission.bookSlug, secondaryMission.from, secondaryMission.to).first<{ total: number }>())?.total ?? 0 : 0;
    const secondaryMissionCompleted = Boolean(secondaryMission && body.bookSlug === secondaryMission.bookSlug && body.chapter >= secondaryMission.from && body.chapter <= secondaryMission.to && secondaryCompletedBefore === secondaryMission.to - secondaryMission.from);
    const act = actForChapter(body.bookSlug, body.chapter);
    const actCompleted = Boolean(act && await completesAct(user.id, act, body.bookSlug, body.chapter));
    const baseXpGain = actCompleted ? 100 : missionCompleted || secondaryMissionCompleted ? 80 : 40;
    const xpGain = coopBefore ? Math.ceil(xpWithStreakBonus(baseXpGain, nextStreak) * 1.05) : xpWithStreakBonus(baseXpGain, nextStreak);
    const coinGain = actCompleted ? 10 : missionCompleted || secondaryMissionCompleted ? 8 : 4;
    const nextXp = (current?.xp ?? 0) + xpGain;
    const nextLevel = levelForXp(nextXp);
    const now = Date.now();

    await env.DB.batch([
      env.DB.prepare("INSERT INTO completed_chapters (user_id, book_slug, chapter, completed_at) VALUES (?, ?, ?, ?)").bind(user.id, body.bookSlug, body.chapter, now),
      env.DB.prepare("UPDATE user_progress SET xp = ?, level = ?, coins = coins + ?, streak = ?, streak_before_break = ?, missed_streak_days = ?, last_read_date = ?, updated_at = ? WHERE user_id = ?")
        .bind(nextXp, nextLevel, coinGain, nextStreak, streakBeforeBreak, missedStreakDays, today, now, user.id),
      ...(secondaryMissionCompleted && secondaryMission ? [env.DB.prepare("UPDATE user_secondary_missions SET active = 0, completed_at = ? WHERE user_id = ? AND mission_id = ?").bind(now, user.id, secondaryMission.id)] : []),
    ]);

    const coopRound = null;

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

    try {
      if (actCompleted && act) await recordSocialActivity(user.id, "mission_completed", { title: `Concluiu o Ato ${act.number}: ${act.title}`, detail: `Missão ${mission?.title || "da Jornada Principal"} concluída · +${xpGain} XP · nível ${nextLevel}.`, xp: xpGain, level: nextLevel, act: `Ato ${act.number} · ${act.title}`, mission: mission?.title, notifyFriends: true });
      else if (nextLevel > (current?.level ?? 1)) await recordSocialActivity(user.id, "achievement_unlocked", { title: `Alcançou o nível ${nextLevel}`, detail: `A jornada alcançou ${nextXp.toLocaleString("pt-BR")} XP.`, xp: xpGain, level: nextLevel, notifyFriends: true });
      else if (secondaryMissionCompleted && secondaryMission) await recordSocialActivity(user.id, "mission_completed", { title: `Concluiu a missão secundária ${secondaryMission.title}`, detail: `Completou uma jornada especial na Palavra · +${xpGain} XP.`, reference: `Mateus ${secondaryMission.from}–${secondaryMission.to}`, xp: xpGain, level: nextLevel, mission: secondaryMission.title, notifyFriends: true });
      else if (missionCompleted && mission) await recordSocialActivity(user.id, "mission_completed", { title: `Concluiu a missão ${mission.title}`, detail: `Avançou na Jornada Principal · +${xpGain} XP.`, reference: `${mission.slug} ${mission.from}${mission.from === mission.to ? "" : `–${mission.to}`}`, xp: xpGain, level: nextLevel, mission: mission.title });
      else if (nextStreak > 0 && nextStreak % 7 === 0) await recordSocialActivity(user.id, "streak_milestone", { title: `${nextStreak} dias de leitura`, detail: "Manteve a chama acesa na Palavra.", level: nextLevel });
      else if (unlocked.length) await recordSocialActivity(user.id, "achievement_unlocked", { title: unlocked.length === 1 ? "Nova conquista desbloqueada" : `${unlocked.length} novas conquistas desbloqueadas`, detail: unlocked.map((code) => code.replaceAll("_", " ")).join(" · "), level: nextLevel, notifyFriends: true });
    } catch (error) {
      console.error("Falha ao registrar atividade social", error);
    }

    return withCors(Response.json({ ...(await loadProgress(user.id)), reward: { xp: xpGain, coins: coinGain, levelUp: nextLevel > (current?.level ?? 1), unlocked, missionCompleted: Boolean(missionCompleted || secondaryMissionCompleted), missionTitle: missionCompleted ? mission?.title : secondaryMissionCompleted ? secondaryMission?.title : undefined, secondaryMissionCompleted, actCompleted, actTitle: actCompleted ? act?.title : undefined, coopBonus: Boolean(coopBefore), coopRoundCompleted: Boolean(coopRound?.roundCompleted) } }));
  } catch (error) {
    if (error instanceof CoopMissionLockedError || error instanceof CoopMissionChapterError) return withCors(Response.json({ error: error.message, coopLocked: true }, { status: 423 }));
    console.error("Falha ao concluir capítulo", error);
    return withCors(Response.json({ error: "Não foi possível salvar o progresso" }, { status: 500 }));
  }
}

import { env } from "cloudflare:workers";
import { areFriends, contactFromRow, findSocialUser, normalizePublicHandle, type SocialContact } from "./social";

export type CoopMissionState = {
  status: "none" | "incoming" | "outgoing" | "active";
  sessionId?: number;
  dailyGoal?: number;
  round?: number;
  myProgress?: number;
  partnerProgress?: number;
  waitingForPartner?: boolean;
  partner?: SocialContact;
};

type SessionRow = { id: number; inviter_id: string; partner_id: string; daily_goal: number; status: "pending" | "active" | "declined" | "ended"; current_round: number };
type MemberRow = { user_id: string; round_progress: number };

export class CoopMissionLockedError extends Error {}

export async function ensureCoopMissionSchema() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS coop_mission_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, inviter_id TEXT NOT NULL, partner_id TEXT NOT NULL, daily_goal INTEGER NOT NULL CHECK(daily_goal BETWEEN 3 AND 10), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'declined', 'ended')), current_round INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, accepted_at INTEGER, ended_at INTEGER, FOREIGN KEY(inviter_id) REFERENCES users(id), FOREIGN KEY(partner_id) REFERENCES users(id), CHECK(inviter_id <> partner_id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_coop_mission_sessions_inviter_status ON coop_mission_sessions(inviter_id, status)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_coop_mission_sessions_partner_status ON coop_mission_sessions(partner_id, status)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS coop_mission_members (session_id INTEGER NOT NULL, user_id TEXT NOT NULL, round_progress INTEGER NOT NULL DEFAULT 0 CHECK(round_progress >= 0), updated_at INTEGER NOT NULL, PRIMARY KEY(session_id, user_id), FOREIGN KEY(session_id) REFERENCES coop_mission_sessions(id), FOREIGN KEY(user_id) REFERENCES users(id))"),
  ]);
}

async function currentSession(userId: string) {
  await ensureCoopMissionSchema();
  return env.DB.prepare("SELECT id, inviter_id, partner_id, daily_goal, status, current_round FROM coop_mission_sessions WHERE (inviter_id = ? OR partner_id = ?) AND status IN ('pending', 'active') ORDER BY created_at DESC LIMIT 1")
    .bind(userId, userId).first<SessionRow>();
}

async function partnerFor(session: SessionRow, userId: string) {
  return session.inviter_id === userId ? session.partner_id : session.inviter_id;
}

export async function getCoopMissionState(userId: string): Promise<CoopMissionState> {
  const session = await currentSession(userId);
  if (!session) return { status: "none" };
  const partnerId = await partnerFor(session, userId);
  const partnerRow = await env.DB.prepare("SELECT public_handle, display_name, profile_photo FROM users WHERE id = ?").bind(partnerId).first<{ public_handle: string; display_name: string | null; profile_photo: string | null }>();
  const partner = partnerRow?.public_handle ? contactFromRow(partnerRow) : undefined;
  if (session.status === "pending") return { status: session.partner_id === userId ? "incoming" : "outgoing", sessionId: session.id, dailyGoal: session.daily_goal, partner };
  const members = await env.DB.prepare("SELECT user_id, round_progress FROM coop_mission_members WHERE session_id = ?").bind(session.id).all<MemberRow>();
  const mine = members.results.find((member) => member.user_id === userId)?.round_progress ?? 0;
  const theirs = members.results.find((member) => member.user_id === partnerId)?.round_progress ?? 0;
  return { status: "active", sessionId: session.id, dailyGoal: session.daily_goal, round: session.current_round, myProgress: mine, partnerProgress: theirs, waitingForPartner: mine >= session.daily_goal && theirs < session.daily_goal, partner };
}

export async function inviteToCoopMission(userId: string, publicHandle: unknown, dailyGoal: unknown) {
  const handle = normalizePublicHandle(publicHandle);
  const goal = Number(dailyGoal);
  if (!handle || !Number.isInteger(goal) || goal < 3 || goal > 10) return { ok: false as const, status: 400, error: "Escolha um amigo e uma meta entre 3 e 10 capítulos." };
  const recipient = await findSocialUser(handle);
  if (!recipient) return { ok: false as const, status: 404, error: "Amigo não encontrado." };
  if (recipient.id === userId) return { ok: false as const, status: 400, error: "Convide um amigo para jogar em coop." };
  if (!await areFriends(userId, recipient.id)) return { ok: false as const, status: 403, error: "O modo coop está disponível apenas entre amigos." };
  if (await currentSession(userId) || await currentSession(recipient.id)) return { ok: false as const, status: 409, error: "Um dos dois já possui uma missão cooperativa em andamento." };
  const result = await env.DB.prepare("INSERT INTO coop_mission_sessions (inviter_id, partner_id, daily_goal, status, current_round, created_at) VALUES (?, ?, ?, 'pending', 1, ?)").bind(userId, recipient.id, goal, Date.now()).run();
  return { ok: true as const, sessionId: Number(result.meta.last_row_id) };
}

export async function respondToCoopMission(userId: string, sessionId: unknown, accept: boolean) {
  const id = Number(sessionId);
  if (!Number.isInteger(id) || id < 1) return { ok: false as const, status: 400, error: "Convite inválido." };
  const session = await env.DB.prepare("SELECT id, inviter_id, partner_id, daily_goal, status, current_round FROM coop_mission_sessions WHERE id = ?").bind(id).first<SessionRow>();
  if (!session || session.partner_id !== userId || session.status !== "pending") return { ok: false as const, status: 404, error: "Este convite não está mais disponível." };
  if (!accept) {
    await env.DB.prepare("UPDATE coop_mission_sessions SET status = 'declined', ended_at = ? WHERE id = ?").bind(Date.now(), id).run();
    return { ok: true as const };
  }
  if (!await areFriends(userId, session.inviter_id)) return { ok: false as const, status: 403, error: "Vocês precisam continuar amigos para iniciar o coop." };
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE coop_mission_sessions SET status = 'active', accepted_at = ? WHERE id = ? AND status = 'pending'").bind(now, id),
    env.DB.prepare("INSERT OR IGNORE INTO coop_mission_members (session_id, user_id, round_progress, updated_at) VALUES (?, ?, 0, ?)").bind(id, session.inviter_id, now),
    env.DB.prepare("INSERT OR IGNORE INTO coop_mission_members (session_id, user_id, round_progress, updated_at) VALUES (?, ?, 0, ?)").bind(id, userId, now),
  ]);
  return { ok: true as const };
}

export async function leaveCoopMission(userId: string, sessionId: unknown) {
  const id = Number(sessionId);
  if (!Number.isInteger(id) || id < 1) return { ok: false as const, status: 400, error: "Missão cooperativa inválida." };
  const result = await env.DB.prepare("UPDATE coop_mission_sessions SET status = 'ended', ended_at = ? WHERE id = ? AND (inviter_id = ? OR partner_id = ?) AND status IN ('pending', 'active')").bind(Date.now(), id, userId, userId).run();
  return result.meta.changes ? { ok: true as const } : { ok: false as const, status: 404, error: "Missão cooperativa não encontrada." };
}

export async function ensureCoopChapterCanBeCompleted(userId: string) {
  const state = await getCoopMissionState(userId);
  if (state.status === "active" && state.waitingForPartner) throw new CoopMissionLockedError(`Aguarde ${state.partner?.displayName || "seu amigo"} concluir a rodada para liberar os próximos capítulos.`);
  return state.status === "active" ? state : null;
}

export async function recordCoopChapter(userId: string) {
  const state = await ensureCoopChapterCanBeCompleted(userId);
  if (!state?.sessionId || !state.dailyGoal) return { active: false, roundCompleted: false, state };
  const now = Date.now();
  await env.DB.prepare("UPDATE coop_mission_members SET round_progress = round_progress + 1, updated_at = ? WHERE session_id = ? AND user_id = ? AND round_progress < ?").bind(now, state.sessionId, userId, state.dailyGoal).run();
  const next = await getCoopMissionState(userId);
  if (next.status === "active" && (next.myProgress ?? 0) >= state.dailyGoal && (next.partnerProgress ?? 0) >= state.dailyGoal) {
    await env.DB.batch([
      env.DB.prepare("UPDATE coop_mission_sessions SET current_round = current_round + 1 WHERE id = ? AND status = 'active'").bind(state.sessionId),
      env.DB.prepare("UPDATE coop_mission_members SET round_progress = 0, updated_at = ? WHERE session_id = ?").bind(now, state.sessionId),
    ]);
    return { active: true, roundCompleted: true, state: await getCoopMissionState(userId) };
  }
  return { active: true, roundCompleted: false, state: next };
}

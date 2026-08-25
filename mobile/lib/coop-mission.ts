import { env } from "cloudflare:workers";
import { compareCoopReferences, isCoopReference, nextCoopReference, type CoopReference } from "./coop-bible";
import { areFriends, contactFromRow, findSocialUser, normalizePublicHandle, type SocialContact } from "./social";

export type CoopMissionState = { status: "none" | "incoming" | "outgoing" | "active"; sessionId?: number; journeyMode?: "whole" | "custom"; start?: CoopReference; end?: CoopReference; current?: CoopReference; myProgress?: number; partnerProgress?: number; waitingForPartner?: boolean; partner?: SocialContact };
type SessionRow = { id: number; inviter_id: string; partner_id: string; status: "pending" | "active" | "declined" | "ended"; journey_mode: "whole" | "custom"; start_book_slug: string; start_chapter: number; end_book_slug: string; end_chapter: number; current_book_slug: string; current_chapter: number };
type MemberRow = { user_id: string; round_progress: number };
type InvitePath = { journeyMode?: unknown; startBookSlug?: unknown; startChapter?: unknown; endBookSlug?: unknown; endChapter?: unknown };
export class CoopMissionLockedError extends Error {}
export class CoopMissionChapterError extends Error {}
const wholeBible = { start: { bookSlug: "gen", chapter: 1 }, end: { bookSlug: "apo", chapter: 22 } };

export async function ensureCoopMissionSchema() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS coop_mission_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, inviter_id TEXT NOT NULL, partner_id TEXT NOT NULL, daily_goal INTEGER NOT NULL CHECK(daily_goal BETWEEN 3 AND 10), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'declined', 'ended')), current_round INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, accepted_at INTEGER, ended_at INTEGER, FOREIGN KEY(inviter_id) REFERENCES users(id), FOREIGN KEY(partner_id) REFERENCES users(id), CHECK(inviter_id <> partner_id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_coop_mission_sessions_inviter_status ON coop_mission_sessions(inviter_id, status)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_coop_mission_sessions_partner_status ON coop_mission_sessions(partner_id, status)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS coop_mission_members (session_id INTEGER NOT NULL, user_id TEXT NOT NULL, round_progress INTEGER NOT NULL DEFAULT 0 CHECK(round_progress >= 0), updated_at INTEGER NOT NULL, PRIMARY KEY(session_id, user_id), FOREIGN KEY(session_id) REFERENCES coop_mission_sessions(id), FOREIGN KEY(user_id) REFERENCES users(id))"),
  ]);
  const columns = await env.DB.prepare("PRAGMA table_info(coop_mission_sessions)").all<{ name: string }>();
  const additions = [["journey_mode", "ALTER TABLE coop_mission_sessions ADD COLUMN journey_mode TEXT NOT NULL DEFAULT 'whole'"], ["start_book_slug", "ALTER TABLE coop_mission_sessions ADD COLUMN start_book_slug TEXT NOT NULL DEFAULT 'gen'"], ["start_chapter", "ALTER TABLE coop_mission_sessions ADD COLUMN start_chapter INTEGER NOT NULL DEFAULT 1"], ["end_book_slug", "ALTER TABLE coop_mission_sessions ADD COLUMN end_book_slug TEXT NOT NULL DEFAULT 'apo'"], ["end_chapter", "ALTER TABLE coop_mission_sessions ADD COLUMN end_chapter INTEGER NOT NULL DEFAULT 22"], ["current_book_slug", "ALTER TABLE coop_mission_sessions ADD COLUMN current_book_slug TEXT NOT NULL DEFAULT 'gen'"], ["current_chapter", "ALTER TABLE coop_mission_sessions ADD COLUMN current_chapter INTEGER NOT NULL DEFAULT 1"]] as const;
  for (const [column, statement] of additions) if (!columns.results.some((item) => item.name === column)) await env.DB.prepare(statement).run();
}
async function currentSession(userId: string) { await ensureCoopMissionSchema(); return env.DB.prepare("SELECT id, inviter_id, partner_id, status, journey_mode, start_book_slug, start_chapter, end_book_slug, end_chapter, current_book_slug, current_chapter FROM coop_mission_sessions WHERE (inviter_id = ? OR partner_id = ?) AND status IN ('pending', 'active') ORDER BY created_at DESC LIMIT 1").bind(userId, userId).first<SessionRow>(); }
function pathOf(session: SessionRow) { return { journeyMode: session.journey_mode === "custom" ? "custom" as const : "whole" as const, start: { bookSlug: session.start_book_slug, chapter: session.start_chapter }, end: { bookSlug: session.end_book_slug, chapter: session.end_chapter }, current: { bookSlug: session.current_book_slug, chapter: session.current_chapter } }; }
async function partnerFor(session: SessionRow, userId: string) { return session.inviter_id === userId ? session.partner_id : session.inviter_id; }

export async function getCoopMissionState(userId: string): Promise<CoopMissionState> {
  const session = await currentSession(userId); if (!session) return { status: "none" };
  const partnerId = await partnerFor(session, userId);
  const partnerRow = await env.DB.prepare("SELECT public_handle, display_name, profile_photo FROM users WHERE id = ?").bind(partnerId).first<{ public_handle: string; display_name: string | null; profile_photo: string | null }>();
  const partner = partnerRow?.public_handle ? contactFromRow(partnerRow) : undefined; const path = pathOf(session);
  if (session.status === "pending") return { status: session.partner_id === userId ? "incoming" : "outgoing", sessionId: session.id, partner, ...path };
  const members = await env.DB.prepare("SELECT user_id, round_progress FROM coop_mission_members WHERE session_id = ?").bind(session.id).all<MemberRow>();
  const mine = members.results.find((member) => member.user_id === userId)?.round_progress ?? 0; const theirs = members.results.find((member) => member.user_id === partnerId)?.round_progress ?? 0;
  return { status: "active", sessionId: session.id, myProgress: mine, partnerProgress: theirs, waitingForPartner: mine >= 1 && theirs < 1, partner, ...path };
}
function readPath(path: InvitePath) {
  const journeyMode = path.journeyMode === "custom" ? "custom" : path.journeyMode === "whole" ? "whole" : null; if (!journeyMode) return null;
  if (journeyMode === "whole") return { journeyMode, ...wholeBible };
  if (!isCoopReference(path.startBookSlug, path.startChapter) || !isCoopReference(path.endBookSlug, path.endChapter)) return null;
  const start = { bookSlug: path.startBookSlug, chapter: Number(path.startChapter) }; const end = { bookSlug: path.endBookSlug, chapter: Number(path.endChapter) };
  return compareCoopReferences(start, end) <= 0 ? { journeyMode, start, end } : null;
}
export async function inviteToCoopMission(userId: string, publicHandle: unknown, path: InvitePath) {
  const handle = normalizePublicHandle(publicHandle); const itinerary = readPath(path);
  if (!handle || !itinerary) return { ok: false as const, status: 400, error: "Escolha um amigo e um percurso válido para a jornada coop." };
  const recipient = await findSocialUser(handle); if (!recipient) return { ok: false as const, status: 404, error: "Amigo não encontrado." };
  if (recipient.id === userId) return { ok: false as const, status: 400, error: "Convide um amigo para jogar em coop." };
  if (!await areFriends(userId, recipient.id)) return { ok: false as const, status: 403, error: "O modo coop está disponível apenas entre amigos." };
  if (await currentSession(userId) || await currentSession(recipient.id)) return { ok: false as const, status: 409, error: "Um dos dois já possui uma missão cooperativa em andamento." };
  const result = await env.DB.prepare("INSERT INTO coop_mission_sessions (inviter_id, partner_id, daily_goal, status, current_round, created_at, journey_mode, start_book_slug, start_chapter, end_book_slug, end_chapter, current_book_slug, current_chapter) VALUES (?, ?, 3, 'pending', 1, ?, ?, ?, ?, ?, ?, ?, ?)").bind(userId, recipient.id, Date.now(), itinerary.journeyMode, itinerary.start.bookSlug, itinerary.start.chapter, itinerary.end.bookSlug, itinerary.end.chapter, itinerary.start.bookSlug, itinerary.start.chapter).run();
  return { ok: true as const, sessionId: Number(result.meta.last_row_id) };
}
export async function respondToCoopMission(userId: string, sessionId: unknown, accept: boolean) {
  const id = Number(sessionId); if (!Number.isInteger(id) || id < 1) return { ok: false as const, status: 400, error: "Convite inválido." };
  const session = await env.DB.prepare("SELECT id, inviter_id, partner_id, status, journey_mode, start_book_slug, start_chapter, end_book_slug, end_chapter, current_book_slug, current_chapter FROM coop_mission_sessions WHERE id = ?").bind(id).first<SessionRow>();
  if (!session || session.partner_id !== userId || session.status !== "pending") return { ok: false as const, status: 404, error: "Este convite não está mais disponível." };
  if (!accept) { await env.DB.prepare("UPDATE coop_mission_sessions SET status = 'declined', ended_at = ? WHERE id = ?").bind(Date.now(), id).run(); return { ok: true as const }; }
  if (!await areFriends(userId, session.inviter_id)) return { ok: false as const, status: 403, error: "Vocês precisam continuar amigos para iniciar o coop." };
  const now = Date.now(); await env.DB.batch([env.DB.prepare("UPDATE coop_mission_sessions SET status = 'active', accepted_at = ? WHERE id = ? AND status = 'pending'").bind(now, id), env.DB.prepare("INSERT OR IGNORE INTO coop_mission_members (session_id, user_id, round_progress, updated_at) VALUES (?, ?, 0, ?)").bind(id, session.inviter_id, now), env.DB.prepare("INSERT OR IGNORE INTO coop_mission_members (session_id, user_id, round_progress, updated_at) VALUES (?, ?, 0, ?)").bind(id, userId, now)]);
  return { ok: true as const };
}
export async function leaveCoopMission(userId: string, sessionId: unknown) { const id = Number(sessionId); if (!Number.isInteger(id) || id < 1) return { ok: false as const, status: 400, error: "Missão cooperativa inválida." }; const result = await env.DB.prepare("UPDATE coop_mission_sessions SET status = 'ended', ended_at = ? WHERE id = ? AND (inviter_id = ? OR partner_id = ?) AND status IN ('pending', 'active')").bind(Date.now(), id, userId, userId).run(); return result.meta.changes ? { ok: true as const } : { ok: false as const, status: 404, error: "Missão cooperativa não encontrada." }; }
export async function ensureCoopChapterCanBeCompleted(userId: string, reference?: CoopReference) { const state = await getCoopMissionState(userId); if (state.status !== "active") return null; if (reference && (state.current?.bookSlug !== reference.bookSlug || state.current?.chapter !== reference.chapter)) throw new CoopMissionChapterError("Este não é o capítulo atual da jornada cooperativa."); if (state.waitingForPartner) throw new CoopMissionLockedError(`Aguarde ${state.partner?.displayName || "seu amigo"} concluir este capítulo para liberar o próximo.`); return state; }
export async function recordCoopChapter(userId: string, reference: CoopReference) {
  const state = await ensureCoopChapterCanBeCompleted(userId, reference); if (!state?.sessionId || !state.current || !state.end) return { active: false, chapterAdvanced: false, journeyCompleted: false, state };
  const now = Date.now(); await env.DB.prepare("UPDATE coop_mission_members SET round_progress = 1, updated_at = ? WHERE session_id = ? AND user_id = ? AND round_progress < 1").bind(now, state.sessionId, userId).run();
  const next = await getCoopMissionState(userId); if (next.status !== "active" || (next.myProgress ?? 0) < 1 || (next.partnerProgress ?? 0) < 1) return { active: true, chapterAdvanced: false, journeyCompleted: false, state: next };
  if (state.current.bookSlug === state.end.bookSlug && state.current.chapter === state.end.chapter) { await env.DB.prepare("UPDATE coop_mission_sessions SET status = 'ended', ended_at = ? WHERE id = ? AND status = 'active'").bind(now, state.sessionId).run(); return { active: false, chapterAdvanced: false, journeyCompleted: true, state: { status: "none" } as CoopMissionState }; }
  const following = nextCoopReference(state.current); if (!following) throw new CoopMissionChapterError("Não foi possível localizar o próximo capítulo da jornada cooperativa.");
  await env.DB.batch([env.DB.prepare("UPDATE coop_mission_sessions SET current_book_slug = ?, current_chapter = ?, current_round = current_round + 1 WHERE id = ? AND status = 'active'").bind(following.bookSlug, following.chapter, state.sessionId), env.DB.prepare("UPDATE coop_mission_members SET round_progress = 0, updated_at = ? WHERE session_id = ?").bind(now, state.sessionId)]);
  return { active: true, chapterAdvanced: true, journeyCompleted: false, state: await getCoopMissionState(userId) };
}

import { env } from "cloudflare:workers";
import { campaignActs } from "./campaign";
import { secondaryMissions } from "./secondary-missions";

export type SocialPrivacy = {
  publicHandle: string;
  profileVisibility: "friends" | "private";
  showProgress: boolean;
  showFavorites: boolean;
  showNotes: boolean;
  showActivities: boolean;
  showStats: boolean;
  allowFriendRequests: boolean;
};

export type SocialContact = {
  publicHandle: string;
  displayName: string;
  profilePhoto: string;
};

export type SocialProfile = {
  publicHandle: string;
  relationship: "self" | "friend" | "none";
  profileVisible: boolean;
  canSendFriendRequest: boolean;
  displayName?: string;
  profilePhoto?: string;
  progress?: { level: number; xp: number; streak: number };
  campaign?: { actNumber: number; actTitle: string; missionTitle: string; done: number; total: number; percent: number; completedActs: number; totalActs: number; completedChapters: number; totalChapters: number };
  stats?: { completedChapters: number; favoriteVerses: number; notes: number };
  favorites?: string[];
  secondaryMissions?: { completed: number; total: number; xp: number; missions: { id: string; title: string; completedAt: number }[] };
  notes?: SocialSharedNote[];
};

export type SocialSharedNote = { id: number; activityId: number; reference: string; text: string; createdAt: number; noteCreatedAt: number; reactions: { amen: number; celebrate: number; viewer?: "amen" | "celebrate" } };
export type SocialComment = { id: number; text: string; createdAt: number; author: SocialContact };

export type SocialActivityKind = "mission_completed" | "chapter_completed" | "streak_milestone" | "achievement_unlocked";
export type SocialActivity = {
  id: number;
  kind: SocialActivityKind;
  title: string;
  detail: string;
  reference?: string;
  category?: "note_shared" | "verse_favorited" | "verse_marked" | "scroll_found";
  xp?: number;
  level?: number;
  act?: string;
  mission?: string;
  createdAt: number;
  actor: SocialContact;
  reactions: { amen: number; celebrate: number; viewer?: "amen" | "celebrate" };
  comments: { total: number; items: SocialComment[] };
};

export type SocialNotification = {
  id: number;
  kind: "friend_request" | "friend_accepted" | "reaction" | "comment" | "social_activity";
  createdAt: number;
  read: boolean;
  actor: SocialContact;
  activityId?: number;
  activityTitle?: string;
};

type UserRow = { public_handle: string | null };
type PrivacyRow = {
  profile_visibility: "friends" | "private";
  show_progress: number;
  show_favorites: number;
  show_notes: number;
  show_activities: number;
  show_stats: number;
  allow_friend_requests: number;
};

type SocialUserRow = {
  id: string;
  public_handle: string;
  display_name: string | null;
  profile_photo: string | null;
  profile_visibility: "friends" | "private" | null;
  show_progress: number | null;
  show_favorites: number | null;
  show_notes: number | null;
  show_stats: number | null;
  allow_friend_requests: number | null;
};

const defaults = {
  profileVisibility: "friends" as const,
  showProgress: true,
  showFavorites: false,
  showNotes: false,
  showActivities: true,
  showStats: true,
  allowFriendRequests: true,
};

export async function ensureSocialSchema() {
  const userColumns = await env.DB.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  if (!userColumns.results.some((column) => column.name === "public_handle")) {
    await env.DB.prepare("ALTER TABLE users ADD COLUMN public_handle TEXT").run();
  }

  await env.DB.batch([
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_handle ON users(public_handle) WHERE public_handle IS NOT NULL"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS social_privacy_settings (user_id TEXT PRIMARY KEY NOT NULL, profile_visibility TEXT NOT NULL DEFAULT 'friends' CHECK(profile_visibility IN ('friends', 'private')), show_progress INTEGER NOT NULL DEFAULT 1 CHECK(show_progress IN (0, 1)), show_favorites INTEGER NOT NULL DEFAULT 0 CHECK(show_favorites IN (0, 1)), show_notes INTEGER NOT NULL DEFAULT 0 CHECK(show_notes IN (0, 1)), show_activities INTEGER NOT NULL DEFAULT 1 CHECK(show_activities IN (0, 1)), show_stats INTEGER NOT NULL DEFAULT 1 CHECK(show_stats IN (0, 1)), allow_friend_requests INTEGER NOT NULL DEFAULT 1 CHECK(allow_friend_requests IN (0, 1)), updated_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS friend_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'cancelled')), created_at INTEGER NOT NULL, responded_at INTEGER, FOREIGN KEY (sender_id) REFERENCES users(id), FOREIGN KEY (recipient_id) REFERENCES users(id), CHECK(sender_id <> recipient_id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient_status ON friend_requests(recipient_id, status)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_friend_requests_sender_status ON friend_requests(sender_id, status)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS friendships (user_a_id TEXT NOT NULL, user_b_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_a_id, user_b_id), FOREIGN KEY (user_a_id) REFERENCES users(id), FOREIGN KEY (user_b_id) REFERENCES users(id), CHECK(user_a_id < user_b_id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_friendships_user_b ON friendships(user_b_id)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS social_activities (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('mission_completed', 'chapter_completed', 'streak_milestone', 'achievement_unlocked')), payload_json TEXT NOT NULL DEFAULT '{}', visibility TEXT NOT NULL DEFAULT 'friends' CHECK(visibility IN ('friends', 'private')), created_at INTEGER NOT NULL, FOREIGN KEY (actor_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_social_activities_actor_created ON social_activities(actor_id, created_at)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS social_reactions (activity_id INTEGER NOT NULL, user_id TEXT NOT NULL, reaction TEXT NOT NULL CHECK(reaction IN ('amen', 'celebrate')), created_at INTEGER NOT NULL, PRIMARY KEY (activity_id, user_id), FOREIGN KEY (activity_id) REFERENCES social_activities(id), FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS social_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, actor_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('friend_request', 'friend_accepted', 'reaction', 'comment', 'social_activity')), activity_id INTEGER, read_at INTEGER, created_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (actor_id) REFERENCES users(id), FOREIGN KEY (activity_id) REFERENCES social_activities(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_social_notifications_user_read_created ON social_notifications(user_id, read_at, created_at)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS user_blocks (blocker_id TEXT NOT NULL, blocked_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (blocker_id, blocked_id), FOREIGN KEY (blocker_id) REFERENCES users(id), FOREIGN KEY (blocked_id) REFERENCES users(id), CHECK(blocker_id <> blocked_id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS social_shared_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, activity_id INTEGER NOT NULL UNIQUE, reference TEXT NOT NULL, note_text TEXT NOT NULL, created_at INTEGER NOT NULL, note_created_at INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id, reference), FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (activity_id) REFERENCES social_activities(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_social_shared_notes_user_created ON social_shared_notes(user_id, created_at)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS social_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, activity_id INTEGER NOT NULL, user_id TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY (activity_id) REFERENCES social_activities(id), FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_social_comments_activity_created ON social_comments(activity_id, created_at)"),
  ]);
  const privacyColumns = await env.DB.prepare("PRAGMA table_info(social_privacy_settings)").all<{ name: string }>();
  if (!privacyColumns.results.some((column) => column.name === "show_notes")) await env.DB.prepare("ALTER TABLE social_privacy_settings ADD COLUMN show_notes INTEGER NOT NULL DEFAULT 0").run();
  const sharedNoteColumns = await env.DB.prepare("PRAGMA table_info(social_shared_notes)").all<{ name: string }>();
  if (!sharedNoteColumns.results.some((column) => column.name === "note_created_at")) await env.DB.prepare("ALTER TABLE social_shared_notes ADD COLUMN note_created_at INTEGER NOT NULL DEFAULT 0").run();
}

function newHandle() {
  return `verbo-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

export async function ensureSocialUser(userId: string): Promise<string> {
  await ensureSocialSchema();
  const current = await env.DB.prepare("SELECT public_handle FROM users WHERE id = ?").bind(userId).first<UserRow>();
  if (!current) throw new Error("Usuário não encontrado");

  let publicHandle = current.public_handle;
  for (let attempt = 0; !publicHandle && attempt < 4; attempt += 1) {
    const candidate = newHandle();
    try {
      const result = await env.DB.prepare("UPDATE users SET public_handle = ? WHERE id = ? AND public_handle IS NULL").bind(candidate, userId).run();
      if (result.meta.changes) publicHandle = candidate;
    } catch {
      // A very unlikely collision is harmless: generate a fresh public handle.
    }
  }
  if (!publicHandle) throw new Error("Não foi possível criar o identificador público");

  await env.DB.prepare("INSERT OR IGNORE INTO social_privacy_settings (user_id, show_activities, updated_at) VALUES (?, 1, ?)").bind(userId, Date.now()).run();
  return publicHandle;
}

function fromRow(publicHandle: string, row: PrivacyRow | null): SocialPrivacy {
  if (!row) return { publicHandle, ...defaults };
  return {
    publicHandle,
    profileVisibility: row.profile_visibility,
    showProgress: Boolean(row.show_progress),
    showFavorites: Boolean(row.show_favorites),
    showNotes: Boolean(row.show_notes),
    showActivities: Boolean(row.show_activities),
    showStats: Boolean(row.show_stats),
    allowFriendRequests: Boolean(row.allow_friend_requests),
  };
}

export async function getSocialPrivacy(userId: string): Promise<SocialPrivacy> {
  const publicHandle = await ensureSocialUser(userId);
  const row = await env.DB.prepare("SELECT profile_visibility, show_progress, show_favorites, show_notes, show_activities, show_stats, allow_friend_requests FROM social_privacy_settings WHERE user_id = ?").bind(userId).first<PrivacyRow>();
  return fromRow(publicHandle, row);
}

export async function saveSocialPrivacy(userId: string, next: Omit<SocialPrivacy, "publicHandle">): Promise<SocialPrivacy> {
  const publicHandle = await ensureSocialUser(userId);
  await env.DB.prepare("UPDATE social_privacy_settings SET profile_visibility = ?, show_progress = ?, show_favorites = ?, show_notes = ?, show_activities = ?, show_stats = ?, allow_friend_requests = ?, updated_at = ? WHERE user_id = ?")
    .bind(next.profileVisibility, Number(next.showProgress), Number(next.showFavorites), Number(next.showNotes), Number(next.showActivities), Number(next.showStats), Number(next.allowFriendRequests), Date.now(), userId)
    .run();
  return { publicHandle, ...next };
}

export function normalizePublicHandle(value: unknown) {
  const handle = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z0-9-]{4,32}$/.test(handle) ? handle : null;
}

function orderedPair(firstUserId: string, secondUserId: string) {
  return firstUserId < secondUserId ? [firstUserId, secondUserId] as const : [secondUserId, firstUserId] as const;
}

export async function areFriends(firstUserId: string, secondUserId: string) {
  if (firstUserId === secondUserId) return false;
  await ensureSocialSchema();
  const [userAId, userBId] = orderedPair(firstUserId, secondUserId);
  const friendship = await env.DB.prepare("SELECT 1 AS found FROM friendships WHERE user_a_id = ? AND user_b_id = ?").bind(userAId, userBId).first<{ found: number }>();
  return Boolean(friendship);
}

export async function areUsersBlocked(firstUserId: string, secondUserId: string) {
  if (firstUserId === secondUserId) return false;
  await ensureSocialSchema();
  const block = await env.DB.prepare("SELECT 1 AS found FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)")
    .bind(firstUserId, secondUserId, secondUserId, firstUserId)
    .first<{ found: number }>();
  return Boolean(block);
}

async function createSocialNotification(userId: string, actorId: string, kind: SocialNotification["kind"], activityId?: number) {
  if (userId === actorId) return;
  await env.DB.prepare("INSERT INTO social_notifications (user_id, actor_id, kind, activity_id, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(userId, actorId, kind, activityId ?? null, Date.now())
    .run();
}

export function contactFromRow(row: Pick<SocialUserRow, "public_handle" | "display_name" | "profile_photo">): SocialContact {
  return {
    publicHandle: row.public_handle,
    displayName: row.display_name?.trim() || "Discípulo do Verbo",
    profilePhoto: row.profile_photo || "",
  };
}

export async function findSocialUser(publicHandle: string) {
  await ensureSocialSchema();
  return env.DB.prepare("SELECT users.id, users.public_handle, users.display_name, users.profile_photo, social_privacy_settings.profile_visibility, social_privacy_settings.show_progress, social_privacy_settings.show_favorites, social_privacy_settings.show_notes, social_privacy_settings.show_stats, social_privacy_settings.allow_friend_requests FROM users LEFT JOIN social_privacy_settings ON social_privacy_settings.user_id = users.id WHERE users.public_handle = ?")
    .bind(publicHandle)
    .first<SocialUserRow>();
}

function favoriteVerses(value: string | null | undefined) {
  try {
    const favorites = JSON.parse(value || "[]");
    return Array.isArray(favorites) ? favorites.filter((favorite): favorite is string => typeof favorite === "string").slice(0, 500) : [];
  } catch {
    return [];
  }
}

function savedNotes(value: string | null | undefined, datesValue?: string | null) {
  try {
    const notes = JSON.parse(value || "{}");
    const dates = JSON.parse(datesValue || "{}");
    return notes && typeof notes === "object" && !Array.isArray(notes)
      ? Object.entries(notes).filter(([reference, note]) => typeof reference === "string" && typeof note === "string" && Boolean(note.trim())).map(([reference, note]) => ({ reference, text: (note as string).trim(), createdAt: typeof dates?.[reference] === "number" ? dates[reference] : 0 }))
      : [];
  } catch {
    return [];
  }
}

function campaignProgress(completed: { book_slug: string; chapter: number }[]) {
  const completedSet = new Set(completed.map((item) => `${item.book_slug}:${item.chapter}`));
  const missionComplete = (mission: (typeof campaignActs)[number]["missions"][number]) => Array.from({ length: mission.to - mission.from + 1 }, (_, index) => completedSet.has(`${mission.slug}:${mission.from + index}`)).every(Boolean);
  const actComplete = (act: (typeof campaignActs)[number]) => act.ranges.every((range) => Array.from({ length: range.to - range.from + 1 }, (_, index) => completedSet.has(`${range.slug}:${range.from + index}`)).every(Boolean));
  const act = campaignActs.find((item) => !actComplete(item)) || campaignActs.at(-1)!;
  const mission = act.missions.find((item) => !missionComplete(item)) || act.missions.at(-1)!;
  const total = mission.to - mission.from + 1;
  const done = Array.from({ length: total }, (_, index) => completedSet.has(`${mission.slug}:${mission.from + index}`)).filter(Boolean).length;
  const campaignChapters = new Set(campaignActs.flatMap((campaignAct) => campaignAct.ranges.flatMap((range) => Array.from({ length: range.to - range.from + 1 }, (_, index) => `${range.slug}:${range.from + index}`))));
  const completedChapters = Array.from(campaignChapters).filter((chapter) => completedSet.has(chapter)).length;
  const completedActs = campaignActs.filter(actComplete).length;
  return { actNumber: act.number, actTitle: act.title, missionTitle: mission.title, done, total, percent: campaignChapters.size ? Math.round(completedChapters / campaignChapters.size * 100) : 0, completedActs, totalActs: campaignActs.length, completedChapters, totalChapters: campaignChapters.size };
}

async function sharedNotesForProfile(userId: string, viewerId: string): Promise<SocialSharedNote[]> {
  const rows = await env.DB.prepare("SELECT social_shared_notes.id, social_shared_notes.activity_id, social_shared_notes.reference, social_shared_notes.note_text, social_shared_notes.created_at, social_shared_notes.note_created_at, COALESCE(SUM(CASE WHEN social_reactions.reaction = 'amen' THEN 1 ELSE 0 END), 0) AS amen_count, COALESCE(SUM(CASE WHEN social_reactions.reaction = 'celebrate' THEN 1 ELSE 0 END), 0) AS celebrate_count, MAX(CASE WHEN social_reactions.user_id = ? THEN social_reactions.reaction ELSE NULL END) AS viewer_reaction FROM social_shared_notes LEFT JOIN social_reactions ON social_reactions.activity_id = social_shared_notes.activity_id WHERE social_shared_notes.user_id = ? GROUP BY social_shared_notes.id ORDER BY social_shared_notes.created_at DESC LIMIT 20")
    .bind(viewerId, userId)
    .all<{ id: number; activity_id: number; reference: string; note_text: string; created_at: number; note_created_at: number; amen_count: number; celebrate_count: number; viewer_reaction: "amen" | "celebrate" | null }>();
  return rows.results.map((row) => ({ id: row.id, activityId: row.activity_id, reference: row.reference, text: row.note_text, createdAt: row.created_at, noteCreatedAt: row.note_created_at || row.created_at, reactions: { amen: Number(row.amen_count), celebrate: Number(row.celebrate_count), ...(row.viewer_reaction ? { viewer: row.viewer_reaction } : {}) } }));
}

async function profileData(userId: string, viewerId: string, includeProgress: boolean, includeStats: boolean, includeFavorites: boolean, includeNotes: boolean) {
  const [progress, campaignChapters, completed, library, secondary] = await Promise.all([
    includeProgress ? env.DB.prepare("SELECT level, xp, streak FROM user_progress WHERE user_id = ?").bind(userId).first<{ level: number; xp: number; streak: number }>() : null,
    includeProgress ? env.DB.prepare("SELECT book_slug, chapter FROM completed_chapters WHERE user_id = ?").bind(userId).all<{ book_slug: string; chapter: number }>().catch(() => null) : null,
    includeStats ? env.DB.prepare("SELECT COUNT(*) AS count FROM completed_chapters WHERE user_id = ?").bind(userId).first<{ count: number }>().catch(() => null) : null,
    (includeStats || includeFavorites) ? env.DB.prepare("SELECT favorites_json, notes_json, note_dates_json FROM user_library WHERE user_id = ?").bind(userId).first<{ favorites_json: string; notes_json: string; note_dates_json: string }>().catch(() => null) : null,
    includeProgress ? env.DB.prepare("SELECT mission_id, completed_at FROM user_secondary_missions WHERE user_id = ? AND completed_at IS NOT NULL ORDER BY completed_at DESC").bind(userId).all<{ mission_id: string; completed_at: number }>().catch(() => null) : null,
  ]);
  const favorites = favoriteVerses(library?.favorites_json);
  const notes = savedNotes(library?.notes_json, library?.note_dates_json);
  const completedSecondary = (secondary?.results || []).map((row) => {
    const mission = secondaryMissions.find((item) => item.id === row.mission_id);
    return mission ? { id: mission.id, title: mission.title, completedAt: row.completed_at, xp: mission.completionXp } : null;
  }).filter((mission): mission is { id: string; title: string; completedAt: number; xp: number } => Boolean(mission));
  return {
    ...(includeProgress && progress ? { progress, campaign: campaignProgress(campaignChapters?.results || []) } : {}),
    ...(includeStats ? { stats: { completedChapters: completed?.count ?? 0, favoriteVerses: favorites.length, notes: notes.length } } : {}),
    ...(includeFavorites ? { favorites } : {}),
    ...(includeProgress ? { secondaryMissions: { completed: completedSecondary.length, total: secondaryMissions.length, xp: completedSecondary.reduce((total, mission) => total + mission.xp, 0), missions: completedSecondary.map(({ xp: _xp, ...mission }) => mission) } } : {}),
    ...(includeNotes ? { notes: await sharedNotesForProfile(userId, viewerId) } : {}),
  };
}

export async function getSocialProfile(viewerId: string, publicHandle: string): Promise<SocialProfile | null> {
  await ensureSocialUser(viewerId);
  const target = await findSocialUser(publicHandle);
  if (!target) return null;
  if (target.id !== viewerId && await areUsersBlocked(viewerId, target.id)) return null;

  const relationship: SocialProfile["relationship"] = target.id === viewerId ? "self" : await areFriends(viewerId, target.id) ? "friend" : "none";
  const profileVisible = relationship === "self" || (relationship === "friend" && (target.profile_visibility ?? defaults.profileVisibility) === "friends");
  const canSendFriendRequest = relationship === "none" && Boolean(target.allow_friend_requests ?? defaults.allowFriendRequests);
  if (!profileVisible) return { publicHandle: target.public_handle, relationship, profileVisible, canSendFriendRequest };

  const includeProgress = relationship === "self" || Boolean(target.show_progress ?? defaults.showProgress);
  const includeStats = relationship === "self" || Boolean(target.show_stats ?? defaults.showStats);
  const includeFavorites = relationship === "self" || Boolean(target.show_favorites ?? defaults.showFavorites);
  const includeNotes = relationship === "self" || Boolean(target.show_notes ?? defaults.showNotes);
  return {
    publicHandle: target.public_handle,
    relationship,
    profileVisible,
    canSendFriendRequest,
    ...contactFromRow(target),
    ...await profileData(target.id, viewerId, includeProgress, includeStats, includeFavorites, includeNotes),
  };
}

function validVerseReference(reference: unknown) {
  return typeof reference === "string" && /^[a-z0-9]+:\d{1,3}:\d{1,3}$/.test(reference) ? reference : null;
}

export async function listOwnSharedNotes(userId: string) {
  await ensureSocialUser(userId);
  return sharedNotesForProfile(userId, userId);
}

export async function shareSocialNote(userId: string, reference: unknown) {
  await ensureSocialUser(userId);
  const safeReference = validVerseReference(reference);
  if (!safeReference) return { ok: false as const, status: 400, error: "Referência bíblica inválida" };
  const privacy = await getSocialPrivacy(userId);
  if (!privacy.showNotes) return { ok: false as const, status: 403, error: "Ative o compartilhamento de anotações nas preferências do perfil." };
  const library = await env.DB.prepare("SELECT notes_json, note_dates_json FROM user_library WHERE user_id = ?").bind(userId).first<{ notes_json: string; note_dates_json: string }>();
  const note = savedNotes(library?.notes_json, library?.note_dates_json).find((item) => item.reference === safeReference);
  if (!note) return { ok: false as const, status: 404, error: "Anotação não encontrada" };
  const now = Date.now();
  const payload = JSON.stringify({ title: "Compartilhou uma anotação", detail: note.text.slice(0, 180), reference: safeReference, category: "note_shared" });
  const existing = await env.DB.prepare("SELECT id, activity_id FROM social_shared_notes WHERE user_id = ? AND reference = ?").bind(userId, safeReference).first<{ id: number; activity_id: number }>();
  if (existing) {
    await env.DB.batch([
      env.DB.prepare("UPDATE social_shared_notes SET note_text = ?, created_at = ?, note_created_at = ? WHERE id = ?").bind(note.text.slice(0, 1200), now, note.createdAt || now, existing.id),
      env.DB.prepare("UPDATE social_activities SET payload_json = ?, visibility = 'friends', created_at = ? WHERE id = ? AND actor_id = ?").bind(payload, now, existing.activity_id, userId),
    ]);
    return { ok: true as const, id: existing.id };
  }
  const activity = await env.DB.prepare("INSERT INTO social_activities (actor_id, kind, payload_json, visibility, created_at) VALUES (?, 'achievement_unlocked', ?, 'friends', ?)").bind(userId, payload, now).run();
  const result = await env.DB.prepare("INSERT INTO social_shared_notes (user_id, activity_id, reference, note_text, created_at, note_created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(userId, Number(activity.meta.last_row_id), safeReference, note.text.slice(0, 1200), now, note.createdAt || now).run();
  return { ok: true as const, id: Number(result.meta.last_row_id) };
}

export async function unshareSocialNote(userId: string, reference: unknown) {
  await ensureSocialUser(userId);
  const safeReference = validVerseReference(reference);
  if (!safeReference) return { ok: false as const, status: 400, error: "Referência bíblica inválida" };
  const existing = await env.DB.prepare("SELECT id, activity_id FROM social_shared_notes WHERE user_id = ? AND reference = ?").bind(userId, safeReference).first<{ id: number; activity_id: number }>();
  if (!existing) return { ok: false as const, status: 404, error: "Anotação compartilhada não encontrada" };
  await env.DB.batch([
    env.DB.prepare("DELETE FROM social_notifications WHERE activity_id = ?").bind(existing.activity_id),
    env.DB.prepare("DELETE FROM social_reactions WHERE activity_id = ?").bind(existing.activity_id),
    env.DB.prepare("DELETE FROM social_shared_notes WHERE id = ? AND user_id = ?").bind(existing.id, userId),
    env.DB.prepare("DELETE FROM social_activities WHERE id = ? AND actor_id = ?").bind(existing.activity_id, userId),
  ]);
  return { ok: true as const };
}

export async function listFriends(userId: string): Promise<SocialContact[]> {
  await ensureSocialUser(userId);
  const rows = await env.DB.prepare("SELECT users.public_handle, users.display_name, users.profile_photo FROM friendships JOIN users ON users.id = CASE WHEN friendships.user_a_id = ? THEN friendships.user_b_id ELSE friendships.user_a_id END WHERE friendships.user_a_id = ? OR friendships.user_b_id = ? ORDER BY lower(users.display_name), users.public_handle")
    .bind(userId, userId, userId)
    .all<Pick<SocialUserRow, "public_handle" | "display_name" | "profile_photo">>();
  return rows.results.map(contactFromRow);
}

export async function listBlockedUsers(userId: string): Promise<SocialContact[]> {
  await ensureSocialUser(userId);
  const rows = await env.DB.prepare("SELECT users.public_handle, users.display_name, users.profile_photo FROM user_blocks JOIN users ON users.id = user_blocks.blocked_id WHERE user_blocks.blocker_id = ? ORDER BY user_blocks.created_at DESC")
    .bind(userId)
    .all<Pick<SocialUserRow, "public_handle" | "display_name" | "profile_photo">>();
  return rows.results.map(contactFromRow);
}

export async function removeFriend(userId: string, publicHandle: string) {
  await ensureSocialUser(userId);
  const target = await findSocialUser(publicHandle);
  if (!target || target.id === userId) return { ok: false as const, status: 404, error: "Amizade não encontrada" };
  const [userAId, userBId] = orderedPair(userId, target.id);
  const result = await env.DB.prepare("DELETE FROM friendships WHERE user_a_id = ? AND user_b_id = ?").bind(userAId, userBId).run();
  if (!result.meta.changes) return { ok: false as const, status: 404, error: "Amizade não encontrada" };
  return { ok: true as const };
}

export async function blockSocialUser(userId: string, publicHandle: string) {
  await ensureSocialUser(userId);
  const target = await findSocialUser(publicHandle);
  if (!target || target.id === userId) return { ok: false as const, status: 404, error: "Perfil não encontrado" };
  const [userAId, userBId] = orderedPair(userId, target.id);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)").bind(userId, target.id, now),
    env.DB.prepare("DELETE FROM friendships WHERE user_a_id = ? AND user_b_id = ?").bind(userAId, userBId),
    env.DB.prepare("UPDATE friend_requests SET status = 'cancelled', responded_at = ? WHERE status = 'pending' AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))").bind(now, userId, target.id, target.id, userId),
    env.DB.prepare("DELETE FROM social_notifications WHERE user_id = ? AND actor_id = ?").bind(userId, target.id),
  ]);
  return { ok: true as const };
}

export async function unblockSocialUser(userId: string, publicHandle: string) {
  await ensureSocialUser(userId);
  const target = await findSocialUser(publicHandle);
  if (!target) return { ok: false as const, status: 404, error: "Perfil não encontrado" };
  const result = await env.DB.prepare("DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?").bind(userId, target.id).run();
  if (!result.meta.changes) return { ok: false as const, status: 404, error: "Bloqueio não encontrado" };
  return { ok: true as const };
}

export async function listFriendRequests(userId: string) {
  await ensureSocialUser(userId);
  const [incoming, outgoing] = await Promise.all([
    env.DB.prepare("SELECT friend_requests.id, friend_requests.created_at, users.public_handle, users.display_name, users.profile_photo FROM friend_requests JOIN users ON users.id = friend_requests.sender_id WHERE friend_requests.recipient_id = ? AND friend_requests.status = 'pending' ORDER BY friend_requests.created_at DESC")
      .bind(userId)
      .all<{ id: number; created_at: number } & Pick<SocialUserRow, "public_handle" | "display_name" | "profile_photo">>(),
    env.DB.prepare("SELECT friend_requests.id, friend_requests.created_at, users.public_handle, users.display_name, users.profile_photo FROM friend_requests JOIN users ON users.id = friend_requests.recipient_id WHERE friend_requests.sender_id = ? AND friend_requests.status = 'pending' ORDER BY friend_requests.created_at DESC")
      .bind(userId)
      .all<{ id: number; created_at: number } & Pick<SocialUserRow, "public_handle" | "display_name" | "profile_photo">>(),
  ]);
  const toRequest = (row: { id: number; created_at: number } & Pick<SocialUserRow, "public_handle" | "display_name" | "profile_photo">) => ({ id: row.id, createdAt: row.created_at, ...contactFromRow(row) });
  return { incoming: incoming.results.map(toRequest), outgoing: outgoing.results.map(toRequest) };
}

export async function createFriendRequest(senderId: string, recipientHandle: string) {
  await ensureSocialUser(senderId);
  const recipient = await findSocialUser(recipientHandle);
  if (!recipient || recipient.id === senderId || !Boolean(recipient.allow_friend_requests ?? defaults.allowFriendRequests)) return { ok: false as const, status: 404, error: "Este perfil não está disponível para pedidos de amizade" };
  if (await areUsersBlocked(senderId, recipient.id)) return { ok: false as const, status: 404, error: "Este perfil não está disponível para pedidos de amizade" };
  if (await areFriends(senderId, recipient.id)) return { ok: false as const, status: 409, error: "Vocês já são amigos" };

  const pending = await env.DB.prepare("SELECT id, sender_id FROM friend_requests WHERE status = 'pending' AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)) ORDER BY created_at DESC LIMIT 1")
    .bind(senderId, recipient.id, recipient.id, senderId)
    .first<{ id: number; sender_id: string }>();
  if (pending) {
    return pending.sender_id === senderId
      ? { ok: false as const, status: 409, error: "O pedido de amizade já foi enviado" }
      : { ok: false as const, status: 409, error: "Há um pedido deste perfil aguardando sua resposta" };
  }

  const result = await env.DB.prepare("INSERT INTO friend_requests (sender_id, recipient_id, status, created_at) VALUES (?, ?, 'pending', ?)").bind(senderId, recipient.id, Date.now()).run();
  await createSocialNotification(recipient.id, senderId, "friend_request");
  return { ok: true as const, requestId: result.meta.last_row_id, recipient: contactFromRow(recipient) };
}

export async function respondToFriendRequest(userId: string, requestId: number, action: "accept" | "decline" | "cancel") {
  await ensureSocialUser(userId);
  const request = await env.DB.prepare("SELECT id, sender_id, recipient_id FROM friend_requests WHERE id = ? AND status = 'pending'").bind(requestId).first<{ id: number; sender_id: string; recipient_id: string }>();
  if (!request) return { ok: false as const, status: 404, error: "Pedido de amizade não encontrado" };
  const isRecipient = request.recipient_id === userId;
  const isSender = request.sender_id === userId;
  if ((action === "accept" || action === "decline") && !isRecipient) return { ok: false as const, status: 403, error: "Você não pode responder a este pedido" };
  if (action === "cancel" && !isSender) return { ok: false as const, status: 403, error: "Você não pode cancelar este pedido" };
  if (action === "accept" && await areUsersBlocked(userId, request.sender_id)) return { ok: false as const, status: 404, error: "Pedido de amizade não encontrado" };

  const status = action === "accept" ? "accepted" : action === "decline" ? "declined" : "cancelled";
  const statements = [env.DB.prepare("UPDATE friend_requests SET status = ?, responded_at = ? WHERE id = ? AND status = 'pending'").bind(status, Date.now(), requestId)];
  if (action === "accept") {
    const [userAId, userBId] = orderedPair(request.sender_id, request.recipient_id);
    statements.push(env.DB.prepare("INSERT OR IGNORE INTO friendships (user_a_id, user_b_id, created_at) VALUES (?, ?, ?)").bind(userAId, userBId, Date.now()));
  }
  await env.DB.batch(statements);
  if (action === "accept") await createSocialNotification(request.sender_id, userId, "friend_accepted");
  return { ok: true as const, status };
}

type ActivityRow = {
  id: number;
  actor_id: string;
  kind: SocialActivityKind;
  payload_json: string;
  created_at: number;
  public_handle: string;
  display_name: string | null;
  profile_photo: string | null;
  amen_count: number;
  celebrate_count: number;
  viewer_reaction: "amen" | "celebrate" | null;
};

function validActivityText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseActivityPayload(value: string) {
  try {
    const payload = JSON.parse(value) as { title?: unknown; detail?: unknown; reference?: unknown; category?: unknown; xp?: unknown; level?: unknown; act?: unknown; mission?: unknown };
    return {
      title: validActivityText(payload.title, 100) || "Avançou na jornada",
      detail: validActivityText(payload.detail, 180),
      reference: validActivityText(payload.reference, 60) || undefined,
      ...(typeof payload.xp === "number" && Number.isFinite(payload.xp) && payload.xp >= 0 ? { xp: Math.round(payload.xp) } : {}),
      ...(typeof payload.level === "number" && Number.isInteger(payload.level) && payload.level > 0 ? { level: payload.level } : {}),
      ...(validActivityText(payload.act, 80) ? { act: validActivityText(payload.act, 80) } : {}),
      ...(validActivityText(payload.mission, 100) ? { mission: validActivityText(payload.mission, 100) } : {}),
      ...(payload.category === "note_shared" || payload.category === "verse_favorited" || payload.category === "verse_marked" || payload.category === "scroll_found" ? { category: payload.category } : {}),
    };
  } catch {
    return { title: "Avançou na jornada", detail: "" };
  }
}

export async function recordSocialActivity(userId: string, kind: SocialActivityKind, payload: { title: string; detail?: string; reference?: string; category?: "note_shared" | "verse_favorited" | "verse_marked" | "scroll_found"; xp?: number; level?: number; act?: string; mission?: string; notifyFriends?: boolean }) {
  const privacy = await getSocialPrivacy(userId);
  const safePayload = {
    title: validActivityText(payload.title, 100),
    detail: validActivityText(payload.detail, 180),
    reference: validActivityText(payload.reference, 60),
    ...(payload.category === "note_shared" || payload.category === "verse_favorited" || payload.category === "verse_marked" || payload.category === "scroll_found" ? { category: payload.category } : {}),
    ...(typeof payload.xp === "number" && Number.isFinite(payload.xp) && payload.xp >= 0 ? { xp: Math.round(payload.xp) } : {}),
    ...(typeof payload.level === "number" && Number.isInteger(payload.level) && payload.level > 0 ? { level: payload.level } : {}),
    ...(validActivityText(payload.act, 80) ? { act: validActivityText(payload.act, 80) } : {}),
    ...(validActivityText(payload.mission, 100) ? { mission: validActivityText(payload.mission, 100) } : {}),
  };
  const now = Date.now();
  const result = await env.DB.prepare("INSERT INTO social_activities (actor_id, kind, payload_json, visibility, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(userId, kind, JSON.stringify(safePayload), privacy.showActivities ? "friends" : "private", now)
    .run();
  const activityId = Number(result.meta.last_row_id);
  if (privacy.showActivities && payload.notifyFriends && activityId > 0) {
    await env.DB.prepare("INSERT INTO social_notifications (user_id, actor_id, kind, activity_id, created_at) SELECT CASE WHEN user_a_id = ? THEN user_b_id ELSE user_a_id END, ?, 'social_activity', ?, ? FROM friendships WHERE user_a_id = ? OR user_b_id = ?")
      .bind(userId, userId, activityId, now, userId, userId)
      .run();
  }
  return activityId;
}

export async function listSocialFeed(viewerId: string): Promise<SocialActivity[]> {
  await ensureSocialUser(viewerId);
  const rows = await env.DB.prepare("SELECT social_activities.id, social_activities.actor_id, social_activities.kind, social_activities.payload_json, social_activities.created_at, users.public_handle, users.display_name, users.profile_photo, COALESCE(SUM(CASE WHEN social_reactions.reaction = 'amen' THEN 1 ELSE 0 END), 0) AS amen_count, COALESCE(SUM(CASE WHEN social_reactions.reaction = 'celebrate' THEN 1 ELSE 0 END), 0) AS celebrate_count, MAX(CASE WHEN social_reactions.user_id = ? THEN social_reactions.reaction ELSE NULL END) AS viewer_reaction FROM social_activities JOIN users ON users.id = social_activities.actor_id LEFT JOIN social_reactions ON social_reactions.activity_id = social_activities.id WHERE (social_activities.actor_id = ? OR (social_activities.visibility = 'friends' AND EXISTS (SELECT 1 FROM friendships WHERE (friendships.user_a_id = ? AND friendships.user_b_id = social_activities.actor_id) OR (friendships.user_b_id = ? AND friendships.user_a_id = social_activities.actor_id)))) AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE (user_blocks.blocker_id = ? AND user_blocks.blocked_id = social_activities.actor_id) OR (user_blocks.blocker_id = social_activities.actor_id AND user_blocks.blocked_id = ?)) GROUP BY social_activities.id ORDER BY social_activities.created_at DESC")
    .bind(viewerId, viewerId, viewerId, viewerId, viewerId, viewerId)
    .all<ActivityRow>();
  const activityIds = rows.results.map((row) => row.id);
  const commentRows = activityIds.length ? await env.DB.prepare(`SELECT social_comments.id, social_comments.activity_id, social_comments.text, social_comments.created_at, users.public_handle, users.display_name, users.profile_photo FROM social_comments JOIN users ON users.id = social_comments.user_id WHERE social_comments.activity_id IN (${activityIds.map(() => "?").join(",")}) AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE (user_blocks.blocker_id = ? AND user_blocks.blocked_id = social_comments.user_id) OR (user_blocks.blocker_id = social_comments.user_id AND user_blocks.blocked_id = ?)) ORDER BY social_comments.created_at ASC`).bind(...activityIds, viewerId, viewerId).all<{ id: number; activity_id: number; text: string; created_at: number } & Pick<SocialUserRow, "public_handle" | "display_name" | "profile_photo">>() : { results: [] as ({ id: number; activity_id: number; text: string; created_at: number } & Pick<SocialUserRow, "public_handle" | "display_name" | "profile_photo">)[] };
  const commentsByActivity = new Map<number, SocialComment[]>();
  for (const comment of commentRows.results) {
    const comments = commentsByActivity.get(comment.activity_id) || [];
    comments.push({ id: comment.id, text: comment.text, createdAt: comment.created_at, author: contactFromRow(comment) });
    commentsByActivity.set(comment.activity_id, comments);
  }
  return rows.results.map((row) => ({
    id: row.id,
    kind: row.kind,
    ...parseActivityPayload(row.payload_json),
    createdAt: row.created_at,
    actor: contactFromRow(row),
    reactions: { amen: Number(row.amen_count), celebrate: Number(row.celebrate_count), ...(row.viewer_reaction ? { viewer: row.viewer_reaction } : {}) },
    comments: { total: (commentsByActivity.get(row.id) || []).length, items: (commentsByActivity.get(row.id) || []).slice(-3) },
  }));
}

async function canViewActivity(viewerId: string, activityId: number) {
  const activity = await env.DB.prepare("SELECT actor_id, visibility FROM social_activities WHERE id = ?").bind(activityId).first<{ actor_id: string; visibility: "friends" | "private" }>();
  if (!activity) return null;
  if (activity.actor_id !== viewerId && await areUsersBlocked(viewerId, activity.actor_id)) return null;
  if (activity.actor_id === viewerId) return activity;
  if (activity.visibility !== "friends" || !await areFriends(viewerId, activity.actor_id)) return null;
  return activity;
}

export async function setSocialReaction(viewerId: string, activityId: number, reaction: "amen" | "celebrate" | null) {
  await ensureSocialUser(viewerId);
  const activity = await canViewActivity(viewerId, activityId);
  if (!activity) return { ok: false as const, status: 404, error: "Atividade não encontrada" };
  if (!reaction) {
    await env.DB.prepare("DELETE FROM social_reactions WHERE activity_id = ? AND user_id = ?").bind(activityId, viewerId).run();
    return { ok: true as const, reaction: null };
  }
  const existing = await env.DB.prepare("SELECT reaction FROM social_reactions WHERE activity_id = ? AND user_id = ?").bind(activityId, viewerId).first<{ reaction: string }>();
  await env.DB.prepare("INSERT INTO social_reactions (activity_id, user_id, reaction, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(activity_id, user_id) DO UPDATE SET reaction = excluded.reaction, created_at = excluded.created_at")
    .bind(activityId, viewerId, reaction, Date.now())
    .run();
  if (!existing && activity.actor_id !== viewerId) await createSocialNotification(activity.actor_id, viewerId, "reaction", activityId);
  return { ok: true as const, reaction };
}

export async function listSocialComments(viewerId: string, activityId: number) {
  await ensureSocialUser(viewerId);
  const activity = await canViewActivity(viewerId, activityId);
  if (!activity) return { ok: false as const, status: 404, error: "Atividade não encontrada" };
  const rows = await env.DB.prepare("SELECT social_comments.id, social_comments.text, social_comments.created_at, users.public_handle, users.display_name, users.profile_photo FROM social_comments JOIN users ON users.id = social_comments.user_id WHERE social_comments.activity_id = ? AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE (user_blocks.blocker_id = ? AND user_blocks.blocked_id = social_comments.user_id) OR (user_blocks.blocker_id = social_comments.user_id AND user_blocks.blocked_id = ?)) ORDER BY social_comments.created_at ASC LIMIT 80")
    .bind(activityId, viewerId, viewerId)
    .all<{ id: number; text: string; created_at: number } & Pick<SocialUserRow, "public_handle" | "display_name" | "profile_photo">>();
  return { ok: true as const, comments: rows.results.map((row) => ({ id: row.id, text: row.text, createdAt: row.created_at, author: contactFromRow(row) })) };
}

export async function createSocialComment(viewerId: string, activityId: number, text: unknown) {
  await ensureSocialUser(viewerId);
  const activity = await canViewActivity(viewerId, activityId);
  if (!activity) return { ok: false as const, status: 404, error: "Atividade não encontrada" };
  const safeText = validActivityText(text, 400);
  if (!safeText) return { ok: false as const, status: 400, error: "Escreva um comentário antes de enviar" };
  const now = Date.now();
  const result = await env.DB.prepare("INSERT INTO social_comments (activity_id, user_id, text, created_at) VALUES (?, ?, ?, ?)").bind(activityId, viewerId, safeText, now).run();
  if (activity.actor_id !== viewerId) await createSocialNotification(activity.actor_id, viewerId, "comment", activityId);
  const author = await env.DB.prepare("SELECT public_handle, display_name, profile_photo FROM users WHERE id = ?").bind(viewerId).first<Pick<SocialUserRow, "public_handle" | "display_name" | "profile_photo">>();
  return { ok: true as const, comment: { id: Number(result.meta.last_row_id), text: safeText, createdAt: now, author: contactFromRow(author!) } };
}

export async function listSocialNotifications(userId: string): Promise<SocialNotification[]> {
  await ensureSocialUser(userId);
  const rows = await env.DB.prepare("SELECT social_notifications.id, social_notifications.kind, social_notifications.activity_id, social_notifications.read_at, social_notifications.created_at, users.public_handle, users.display_name, users.profile_photo, social_activities.payload_json FROM social_notifications JOIN users ON users.id = social_notifications.actor_id LEFT JOIN social_activities ON social_activities.id = social_notifications.activity_id WHERE social_notifications.user_id = ? AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE (user_blocks.blocker_id = ? AND user_blocks.blocked_id = social_notifications.actor_id) OR (user_blocks.blocker_id = social_notifications.actor_id AND user_blocks.blocked_id = ?)) ORDER BY social_notifications.read_at IS NOT NULL, social_notifications.created_at DESC LIMIT 30")
    .bind(userId, userId, userId)
    .all<{ id: number; kind: SocialNotification["kind"]; activity_id: number | null; read_at: number | null; created_at: number; payload_json: string | null } & Pick<SocialUserRow, "public_handle" | "display_name" | "profile_photo">>();
  return rows.results.map((row) => ({ id: row.id, kind: row.kind, createdAt: row.created_at, read: Boolean(row.read_at), actor: contactFromRow(row), ...(row.activity_id ? { activityId: row.activity_id } : {}), ...((row.kind === "reaction" || row.kind === "comment" || row.kind === "social_activity") && row.payload_json ? { activityTitle: parseActivityPayload(row.payload_json).title } : {}) }));
}

export async function markSocialNotificationsRead(userId: string) {
  await ensureSocialUser(userId);
  await env.DB.prepare("UPDATE social_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").bind(Date.now(), userId).run();
}

export async function markSocialNotificationRead(userId: string, notificationId: number) {
  await ensureSocialUser(userId);
  await env.DB.prepare("UPDATE social_notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL").bind(Date.now(), notificationId, userId).run();
}

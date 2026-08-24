import { env } from "cloudflare:workers";

export type SocialPrivacy = {
  publicHandle: string;
  profileVisibility: "friends" | "private";
  showProgress: boolean;
  showFavorites: boolean;
  showActivities: boolean;
  showStats: boolean;
  allowFriendRequests: boolean;
};

type UserRow = { public_handle: string | null };
type PrivacyRow = {
  profile_visibility: "friends" | "private";
  show_progress: number;
  show_favorites: number;
  show_activities: number;
  show_stats: number;
  allow_friend_requests: number;
};

const defaults = {
  profileVisibility: "friends" as const,
  showProgress: true,
  showFavorites: false,
  showActivities: false,
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
    env.DB.prepare("CREATE TABLE IF NOT EXISTS social_privacy_settings (user_id TEXT PRIMARY KEY NOT NULL, profile_visibility TEXT NOT NULL DEFAULT 'friends' CHECK(profile_visibility IN ('friends', 'private')), show_progress INTEGER NOT NULL DEFAULT 1 CHECK(show_progress IN (0, 1)), show_favorites INTEGER NOT NULL DEFAULT 0 CHECK(show_favorites IN (0, 1)), show_activities INTEGER NOT NULL DEFAULT 0 CHECK(show_activities IN (0, 1)), show_stats INTEGER NOT NULL DEFAULT 1 CHECK(show_stats IN (0, 1)), allow_friend_requests INTEGER NOT NULL DEFAULT 1 CHECK(allow_friend_requests IN (0, 1)), updated_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS friend_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'cancelled')), created_at INTEGER NOT NULL, responded_at INTEGER, FOREIGN KEY (sender_id) REFERENCES users(id), FOREIGN KEY (recipient_id) REFERENCES users(id), CHECK(sender_id <> recipient_id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient_status ON friend_requests(recipient_id, status)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_friend_requests_sender_status ON friend_requests(sender_id, status)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS friendships (user_a_id TEXT NOT NULL, user_b_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_a_id, user_b_id), FOREIGN KEY (user_a_id) REFERENCES users(id), FOREIGN KEY (user_b_id) REFERENCES users(id), CHECK(user_a_id < user_b_id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_friendships_user_b ON friendships(user_b_id)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS social_activities (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('mission_completed', 'chapter_completed', 'streak_milestone', 'achievement_unlocked')), payload_json TEXT NOT NULL DEFAULT '{}', visibility TEXT NOT NULL DEFAULT 'friends' CHECK(visibility IN ('friends', 'private')), created_at INTEGER NOT NULL, FOREIGN KEY (actor_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_social_activities_actor_created ON social_activities(actor_id, created_at)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS social_reactions (activity_id INTEGER NOT NULL, user_id TEXT NOT NULL, reaction TEXT NOT NULL CHECK(reaction IN ('amen', 'celebrate')), created_at INTEGER NOT NULL, PRIMARY KEY (activity_id, user_id), FOREIGN KEY (activity_id) REFERENCES social_activities(id), FOREIGN KEY (user_id) REFERENCES users(id))"),
  ]);
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

  await env.DB.prepare("INSERT OR IGNORE INTO social_privacy_settings (user_id, updated_at) VALUES (?, ?)").bind(userId, Date.now()).run();
  return publicHandle;
}

function fromRow(publicHandle: string, row: PrivacyRow | null): SocialPrivacy {
  if (!row) return { publicHandle, ...defaults };
  return {
    publicHandle,
    profileVisibility: row.profile_visibility,
    showProgress: Boolean(row.show_progress),
    showFavorites: Boolean(row.show_favorites),
    showActivities: Boolean(row.show_activities),
    showStats: Boolean(row.show_stats),
    allowFriendRequests: Boolean(row.allow_friend_requests),
  };
}

export async function getSocialPrivacy(userId: string): Promise<SocialPrivacy> {
  const publicHandle = await ensureSocialUser(userId);
  const row = await env.DB.prepare("SELECT profile_visibility, show_progress, show_favorites, show_activities, show_stats, allow_friend_requests FROM social_privacy_settings WHERE user_id = ?").bind(userId).first<PrivacyRow>();
  return fromRow(publicHandle, row);
}

export async function saveSocialPrivacy(userId: string, next: Omit<SocialPrivacy, "publicHandle">): Promise<SocialPrivacy> {
  const publicHandle = await ensureSocialUser(userId);
  await env.DB.prepare("UPDATE social_privacy_settings SET profile_visibility = ?, show_progress = ?, show_favorites = ?, show_activities = ?, show_stats = ?, allow_friend_requests = ?, updated_at = ? WHERE user_id = ?")
    .bind(next.profileVisibility, Number(next.showProgress), Number(next.showFavorites), Number(next.showActivities), Number(next.showStats), Number(next.allowFriendRequests), Date.now(), userId)
    .run();
  return { publicHandle, ...next };
}

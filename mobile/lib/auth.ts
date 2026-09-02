import { cookies } from "next/headers";
import { env } from "cloudflare:workers";

const SESSION_COOKIE = "verbo_session";
const SESSION_DAYS = 30;
// Cloudflare Workers limits Web Crypto PBKDF2 to 100,000 iterations.
const PASSWORD_ITERATIONS = 100000;
const MAX_ACTIVE_SESSIONS = 5;
const AUTH_RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, ipAttempts: 25, accountAttempts: 10 },
  register: { windowMs: 60 * 60 * 1000, ipAttempts: 8, accountAttempts: 3 },
} as const;

type User = { id: string; email: string; displayName: string };

export class InvalidCredentialsError extends Error {
  constructor() {
    super("E-mail ou senha incorretos.");
    this.name = "InvalidCredentialsError";
  }
}

export type AuthRateLimitScope = keyof typeof AUTH_RATE_LIMITS;

function toBase64Url(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function digest(value: string | Uint8Array) {
  return crypto.subtle.digest("SHA-256", typeof value === "string" ? new TextEncoder().encode(value) : value);
}

async function hashPassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PASSWORD_ITERATIONS, hash: "SHA-256" }, key, 256);
  return toBase64Url(bits);
}

async function ensureAuthSchema() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, display_name TEXT, created_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS user_progress (user_id TEXT PRIMARY KEY NOT NULL, xp INTEGER DEFAULT 0 NOT NULL, level INTEGER DEFAULT 1 NOT NULL, coins INTEGER DEFAULT 0 NOT NULL, streak INTEGER DEFAULT 0 NOT NULL, last_read_date TEXT, last_login_date TEXT, last_note_date TEXT, streak_before_break INTEGER DEFAULT 0 NOT NULL, missed_streak_days INTEGER DEFAULT 0 NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS auth_rate_limits (key_hash TEXT PRIMARY KEY NOT NULL, attempt_count INTEGER NOT NULL, window_started_at INTEGER NOT NULL)"),
  ]);
  const columns = await env.DB.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "email")) await env.DB.prepare("ALTER TABLE users ADD COLUMN email TEXT").run();
  if (!columns.results.some((column) => column.name === "password_hash")) await env.DB.prepare("ALTER TABLE users ADD COLUMN password_hash TEXT").run();
  if (!columns.results.some((column) => column.name === "password_salt")) await env.DB.prepare("ALTER TABLE users ADD COLUMN password_salt TEXT").run();
  if (!columns.results.some((column) => column.name === "profile_photo")) await env.DB.prepare("ALTER TABLE users ADD COLUMN profile_photo TEXT").run();
}

export async function prepareAuthSchema() {
  await ensureAuthSchema();
}

export async function createAccount(email: string, displayName: string, password: string, profilePhoto = "") {
  await ensureAuthSchema();
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await env.DB.prepare("SELECT id FROM users WHERE lower(email) = ?").bind(normalizedEmail).first<{ id: string }>();
  if (existing) throw new Error("Este e-mail já está cadastrado.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(password, salt);
  const userId = crypto.randomUUID();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, display_name, email, password_hash, password_salt, profile_photo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(userId, displayName.trim(), normalizedEmail, passwordHash, toBase64Url(salt), profilePhoto, now),
    env.DB.prepare("INSERT OR IGNORE INTO user_progress (user_id, updated_at) VALUES (?, ?)").bind(userId, now),
  ]);
  return { userId, email: normalizedEmail, displayName: displayName.trim() };
}

export async function authenticate(email: string, password: string) {
  await ensureAuthSchema();
  const normalizedEmail = email.trim().toLowerCase();
  const row = await env.DB.prepare("SELECT id, email, display_name, password_hash, password_salt FROM users WHERE lower(email) = ?").bind(normalizedEmail).first<{ id: string; email: string; display_name: string; password_hash: string | null; password_salt: string | null }>();
  if (!row?.password_hash || !row.password_salt) throw new InvalidCredentialsError();
  const passwordHash = await hashPassword(password, fromBase64Url(row.password_salt));
  if (passwordHash !== row.password_hash) throw new InvalidCredentialsError();
  return { userId: row.id, email: row.email, displayName: row.display_name };
}

export async function authenticateGoogle(email: string, displayName: string) {
  await ensureAuthSchema();
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await env.DB.prepare("SELECT id, email, display_name FROM users WHERE lower(email) = ?").bind(normalizedEmail).first<{ id: string; email: string; display_name: string | null }>();
  if (existing) return { userId: existing.id, email: existing.email, displayName: existing.display_name || displayName };
  const userId = crypto.randomUUID();
  const now = Date.now();
  const safeDisplayName = displayName.trim().slice(0, 24) || normalizedEmail.split("@")[0].slice(0, 24);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, display_name, email, created_at) VALUES (?, ?, ?, ?)").bind(userId, safeDisplayName, normalizedEmail, now),
    env.DB.prepare("INSERT OR IGNORE INTO user_progress (user_id, updated_at) VALUES (?, ?)").bind(userId, now),
  ]);
  return { userId, email: normalizedEmail, displayName: safeDisplayName };
}

function clientAddress(request: Request) {
  return request.headers.get("CF-Connecting-IP")?.trim() || "unknown";
}

async function authRateLimitKey(scope: AuthRateLimitScope, kind: "ip" | "account", value: string) {
  return toBase64Url(await digest(`verbo-auth-rate-limit:${scope}:${kind}:${value}`));
}

export async function consumeAuthAttempt(request: Request, scope: AuthRateLimitScope, account: string) {
  await ensureAuthSchema();
  const rule = AUTH_RATE_LIMITS[scope];
  const now = Date.now();
  const identities = [
    { key: await authRateLimitKey(scope, "ip", clientAddress(request)), limit: rule.ipAttempts },
    { key: await authRateLimitKey(scope, "account", account.trim().toLowerCase().slice(0, 320)), limit: rule.accountAttempts },
  ];
  const rows = await Promise.all(identities.map(({ key }) => env.DB.prepare("SELECT attempt_count, window_started_at FROM auth_rate_limits WHERE key_hash = ?").bind(key).first<{ attempt_count: number; window_started_at: number }>()));
  const blocked = rows.find((row, index) => row && row.window_started_at + rule.windowMs > now && row.attempt_count >= identities[index].limit);
  if (blocked) return { allowed: false as const, retryAfterSeconds: Math.max(1, Math.ceil((blocked.window_started_at + rule.windowMs - now) / 1000)) };

  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_rate_limits WHERE window_started_at < ?").bind(now - 24 * 60 * 60 * 1000),
    ...identities.map(({ key }) => env.DB.prepare("INSERT INTO auth_rate_limits (key_hash, attempt_count, window_started_at) VALUES (?, 1, ?) ON CONFLICT(key_hash) DO UPDATE SET attempt_count = CASE WHEN auth_rate_limits.window_started_at <= ? THEN 1 ELSE auth_rate_limits.attempt_count + 1 END, window_started_at = CASE WHEN auth_rate_limits.window_started_at <= ? THEN excluded.window_started_at ELSE auth_rate_limits.window_started_at END").bind(key, now, now - rule.windowMs, now - rule.windowMs)),
  ]);
  return { allowed: true as const };
}

export async function startSession(userId: string, secure = false) {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = toBase64Url(await digest(token));
  const now = Date.now();
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(tokenHash, userId, expiresAt, now),
    env.DB.prepare("DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET ?)").bind(userId, MAX_ACTIVE_SESSIONS),
  ]);
  return `verbo_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}${secure ? "; Secure" : ""}`;
}

export async function endCurrentSession() {
  await ensureAuthSchema();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return;
  const tokenHash = toBase64Url(await digest(token));
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export async function currentUser(): Promise<User | null> {
  await ensureAuthSchema();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = toBase64Url(await digest(token));
  const row = await env.DB.prepare("SELECT users.id, users.email, users.display_name, sessions.expires_at FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?").bind(tokenHash).first<{ id: string; email: string; display_name: string; expires_at: number }>();
  if (!row || row.expires_at <= Date.now()) return null;
  return { id: row.id, email: row.email, displayName: row.display_name };
}

export function clearSessionCookie(secure = false) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

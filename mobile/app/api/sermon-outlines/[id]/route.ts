import { env } from "cloudflare:workers";
import { currentUser } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
type BlockKind = "introduction" | "topic" | "subtopic" | "application" | "illustration" | "verse" | "prayer" | "observation" | "conclusion" | "divider";
type OutlineBlock = { id: number; kind: BlockKind; position: number; title: string; body: string; plannedMinutes: number };
type OutlineRow = {
  id: number;
  title: string;
  color: string;
  icon: string;
  createdAt: number;
  updatedAt: number;
  theme: string;
  baseReference: string;
  category: string;
  favorite: number;
  plannedMinutes: number;
  alertMarksJson: string;
  sermonDate: string | null;
  location: string;
  eventName: string;
  actualMinutes: number | null;
  postNotes: string;
};

const colors = new Set(["gold", "violet", "teal", "rose", "blue", "green"]);
const icons = new Set(["✦", "♡", "✎", "⌁", "☀", "⚑"]);
const blockKinds = new Set<BlockKind>(["introduction", "topic", "subtopic", "application", "illustration", "verse", "prayer", "observation", "conclusion", "divider"]);

function positiveId(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
function text(value: unknown, maximum: number, trim = true) {
  if (typeof value !== "string") return "";
  const next = trim ? value.trim() : value;
  return next.slice(0, maximum);
}
function integer(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}
function blockKind(value: unknown): BlockKind {
  return typeof value === "string" && blockKinds.has(value as BlockKind) ? value as BlockKind : "topic";
}
function alertMarks(value: unknown) {
  const candidate = Array.isArray(value) ? value : [];
  const marks = [...new Set(candidate.map(Number).filter((mark) => Number.isInteger(mark) && mark >= 10 && mark <= 100))].sort((a, b) => a - b);
  return marks.length ? marks.slice(0, 8) : [50, 75, 90, 100];
}

async function ownedOutline(studyId: number, userId: string) {
  return env.DB.prepare(
    `SELECT personal_studies.id, personal_studies.title, personal_studies.color,
      personal_studies.icon, personal_studies.created_at AS createdAt,
      personal_studies.updated_at AS updatedAt,
      sermon_outlines.theme, sermon_outlines.base_reference AS baseReference,
      sermon_outlines.category, sermon_outlines.favorite,
      sermon_outlines.planned_minutes AS plannedMinutes,
      sermon_outlines.alert_marks_json AS alertMarksJson,
      sermon_outlines.sermon_date AS sermonDate,
      sermon_outlines.location, sermon_outlines.event_name AS eventName,
      sermon_outlines.actual_minutes AS actualMinutes,
      sermon_outlines.post_notes AS postNotes
    FROM sermon_outlines
    INNER JOIN personal_studies ON personal_studies.id = sermon_outlines.study_id
    WHERE sermon_outlines.study_id = ? AND sermon_outlines.user_id = ?`,
  ).bind(studyId, userId).first<OutlineRow>();
}

async function outlineBlocks(studyId: number, userId: string) {
  const rows = await env.DB.prepare(
    `SELECT id, kind, position, title, body, planned_minutes AS plannedMinutes
     FROM sermon_outline_blocks WHERE study_id = ? AND user_id = ? ORDER BY position, id`,
  ).bind(studyId, userId).all<OutlineBlock>();
  return rows.results;
}

async function fullOutline(studyId: number, userId: string) {
  const outline = await ownedOutline(studyId, userId);
  if (!outline) return null;
  const [blocks, revisions, sessions] = await Promise.all([
    outlineBlocks(studyId, userId),
    env.DB.prepare(
      "SELECT id, created_at AS createdAt FROM sermon_outline_revisions WHERE study_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 10",
    ).bind(studyId, userId).all(),
    env.DB.prepare(
      "SELECT id, started_at AS startedAt, ended_at AS endedAt, planned_seconds AS plannedSeconds, actual_seconds AS actualSeconds, location, event_name AS eventName, notes FROM sermon_sessions WHERE study_id = ? AND user_id = ? ORDER BY started_at DESC LIMIT 10",
    ).bind(studyId, userId).all(),
  ]);
  let savedAlertMarks: unknown = [];
  try { savedAlertMarks = JSON.parse(outline.alertMarksJson || "[]"); } catch { savedAlertMarks = []; }
  return {
    ...outline,
    favorite: Boolean(outline.favorite),
    alertMarks: alertMarks(savedAlertMarks),
    blocks,
    revisions: revisions.results,
    sessions: sessions.results,
  };
}

async function checkpoint(studyId: number, userId: string, force = false) {
  const last = await env.DB.prepare(
    "SELECT created_at AS createdAt FROM sermon_outline_revisions WHERE study_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1",
  ).bind(studyId, userId).first<{ createdAt: number }>();
  const now = Date.now();
  if (!force && last && now - last.createdAt < 120_000) return;
  const outline = await ownedOutline(studyId, userId);
  if (!outline) return;
  const blocks = await outlineBlocks(studyId, userId);
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO sermon_outline_revisions (study_id, user_id, snapshot_json, created_at) VALUES (?, ?, ?, ?)",
    ).bind(studyId, userId, JSON.stringify({ outline, blocks }), now),
    env.DB.prepare(
      "DELETE FROM sermon_outline_revisions WHERE study_id = ? AND user_id = ? AND id NOT IN (SELECT id FROM sermon_outline_revisions WHERE study_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 20)",
    ).bind(studyId, userId, studyId, userId),
  ]);
}

export function OPTIONS() {
  return corsOptions();
}

export async function GET(_: Request, context: Context) {
  const user = await currentUser();
  const studyId = positiveId((await context.params).id);
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  if (!studyId) return withCors(Response.json({ error: "Esboço inválido" }, { status: 400 }));
  const outline = await fullOutline(studyId, user.id);
  if (!outline) return withCors(Response.json({ error: "Esboço não encontrado" }, { status: 404 }));
  return withCors(Response.json({ outline }));
}

export async function PATCH(request: Request, context: Context) {
  const user = await currentUser();
  const studyId = positiveId((await context.params).id);
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  if (!studyId || !(await ownedOutline(studyId, user.id)))
    return withCors(Response.json({ error: "Esboço não encontrado" }, { status: 404 }));

  const payload = (await request.json()) as Record<string, unknown>;
  const action = typeof payload.action === "string" ? payload.action : "edit";
  const now = Date.now();

  if (action === "add-block") {
    const afterId = positiveId(payload.afterBlockId);
    const previous = afterId
      ? await env.DB.prepare("SELECT position FROM sermon_outline_blocks WHERE id = ? AND study_id = ? AND user_id = ?").bind(afterId, studyId, user.id).first<{ position: number }>()
      : await env.DB.prepare("SELECT COALESCE(MAX(position), 0) AS position FROM sermon_outline_blocks WHERE study_id = ? AND user_id = ?").bind(studyId, user.id).first<{ position: number }>();
    if (!previous) return withCors(Response.json({ error: "Posição inválida" }, { status: 400 }));
    const target = previous.position + 1;
    const kind = blockKind(payload.kind);
    await env.DB.batch([
      env.DB.prepare("UPDATE sermon_outline_blocks SET position = position + 1, updated_at = ? WHERE study_id = ? AND user_id = ? AND position >= ?").bind(now, studyId, user.id, target),
      env.DB.prepare("INSERT INTO sermon_outline_blocks (study_id, user_id, kind, position, title, body, planned_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)").bind(studyId, user.id, kind, target, text(payload.title, 120) || (kind === "topic" ? "Novo tópico" : ""), integer(payload.plannedMinutes, 0, 120, kind === "topic" ? 5 : 0), now, now),
      env.DB.prepare("UPDATE personal_studies SET updated_at = ? WHERE id = ? AND user_id = ?").bind(now, studyId, user.id),
      env.DB.prepare("UPDATE sermon_outlines SET updated_at = ? WHERE study_id = ? AND user_id = ?").bind(now, studyId, user.id),
    ]);
  } else if (action === "edit-block") {
    const blockId = positiveId(payload.blockId);
    if (!blockId) return withCors(Response.json({ error: "Bloco inválido" }, { status: 400 }));
    const updated = await env.DB.prepare(
      "UPDATE sermon_outline_blocks SET kind = ?, title = ?, body = ?, planned_minutes = ?, updated_at = ? WHERE id = ? AND study_id = ? AND user_id = ?",
    ).bind(blockKind(payload.kind), text(payload.title, 120), text(payload.body, 20_000, false), integer(payload.plannedMinutes, 0, 120, 0), now, blockId, studyId, user.id).run();
    if (!updated.meta.changes) return withCors(Response.json({ error: "Bloco não encontrado" }, { status: 404 }));
    await env.DB.batch([
      env.DB.prepare("UPDATE personal_studies SET updated_at = ? WHERE id = ? AND user_id = ?").bind(now, studyId, user.id),
      env.DB.prepare("UPDATE sermon_outlines SET updated_at = ? WHERE study_id = ? AND user_id = ?").bind(now, studyId, user.id),
    ]);
  } else if (action === "remove-block") {
    await checkpoint(studyId, user.id, true);
    const blockId = positiveId(payload.blockId);
    const block = blockId ? await env.DB.prepare("SELECT position FROM sermon_outline_blocks WHERE id = ? AND study_id = ? AND user_id = ?").bind(blockId, studyId, user.id).first<{ position: number }>() : null;
    if (!blockId || !block) return withCors(Response.json({ error: "Bloco não encontrado" }, { status: 404 }));
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sermon_outline_blocks WHERE id = ? AND study_id = ? AND user_id = ?").bind(blockId, studyId, user.id),
      env.DB.prepare("UPDATE sermon_outline_blocks SET position = position - 1, updated_at = ? WHERE study_id = ? AND user_id = ? AND position > ?").bind(now, studyId, user.id, block.position),
      env.DB.prepare("UPDATE personal_studies SET updated_at = ? WHERE id = ? AND user_id = ?").bind(now, studyId, user.id),
    ]);
  } else if (action === "move-block") {
    const blockId = positiveId(payload.blockId);
    const direction = payload.direction === "up" || payload.direction === "down" ? payload.direction : null;
    const block = blockId ? await env.DB.prepare("SELECT position FROM sermon_outline_blocks WHERE id = ? AND study_id = ? AND user_id = ?").bind(blockId, studyId, user.id).first<{ position: number }>() : null;
    if (!blockId || !direction || !block) return withCors(Response.json({ error: "Movimento inválido" }, { status: 400 }));
    const neighbour = await env.DB.prepare(direction === "up"
      ? "SELECT id, position FROM sermon_outline_blocks WHERE study_id = ? AND user_id = ? AND position < ? ORDER BY position DESC, id DESC LIMIT 1"
      : "SELECT id, position FROM sermon_outline_blocks WHERE study_id = ? AND user_id = ? AND position > ? ORDER BY position, id LIMIT 1")
      .bind(studyId, user.id, block.position).first<{ id: number; position: number }>();
    if (neighbour) await env.DB.batch([
      env.DB.prepare("UPDATE sermon_outline_blocks SET position = ?, updated_at = ? WHERE id = ? AND study_id = ? AND user_id = ?").bind(neighbour.position, now, blockId, studyId, user.id),
      env.DB.prepare("UPDATE sermon_outline_blocks SET position = ?, updated_at = ? WHERE id = ? AND study_id = ? AND user_id = ?").bind(block.position, now, neighbour.id, studyId, user.id),
      env.DB.prepare("UPDATE personal_studies SET updated_at = ? WHERE id = ? AND user_id = ?").bind(now, studyId, user.id),
    ]);
  } else if (action === "checkpoint") {
    await checkpoint(studyId, user.id, true);
  } else if (action === "record-session") {
    const startedAt = integer(payload.startedAt, 1, Number.MAX_SAFE_INTEGER, now);
    const endedAt = integer(payload.endedAt, startedAt, Number.MAX_SAFE_INTEGER, now);
    const plannedSeconds = integer(payload.plannedSeconds, 60, 14_400, 1800);
    const actualSeconds = integer(payload.actualSeconds, 0, 86_400, Math.max(0, Math.round((endedAt - startedAt) / 1000)));
    await env.DB.batch([
      env.DB.prepare("INSERT INTO sermon_sessions (study_id, user_id, started_at, ended_at, planned_seconds, actual_seconds, location, event_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(studyId, user.id, startedAt, endedAt, plannedSeconds, actualSeconds, text(payload.location, 160), text(payload.eventName, 160), text(payload.notes, 4000, false)),
      env.DB.prepare("UPDATE sermon_outlines SET actual_minutes = ?, sermon_date = ?, location = ?, event_name = ?, post_notes = ?, updated_at = ? WHERE study_id = ? AND user_id = ?").bind(Math.max(1, Math.round(actualSeconds / 60)), new Date(endedAt).toISOString().slice(0, 10), text(payload.location, 160), text(payload.eventName, 160), text(payload.notes, 4000, false), now, studyId, user.id),
      env.DB.prepare("UPDATE personal_studies SET updated_at = ? WHERE id = ? AND user_id = ?").bind(now, studyId, user.id),
    ]);
  } else if (action === "duplicate") {
    const original = await ownedOutline(studyId, user.id);
    const blocks = await outlineBlocks(studyId, user.id);
    if (!original) return withCors(Response.json({ error: "Esboço não encontrado" }, { status: 404 }));
    const created = await env.DB.prepare("INSERT INTO personal_studies (user_id, title, color, icon, body, created_at, updated_at) VALUES (?, ?, ?, ?, '', ?, ?)").bind(user.id, `${original.title} · cópia`.slice(0, 100), original.color, original.icon, now, now).run();
    const duplicateId = Number(created.meta.last_row_id);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO sermon_outlines (study_id, user_id, theme, base_reference, category, favorite, planned_minutes, alert_marks_json, location, event_name, post_notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, '', '', '', ?, ?)").bind(duplicateId, user.id, original.theme, original.baseReference, original.category, original.plannedMinutes, original.alertMarksJson, now, now),
      ...blocks.map((block, index) => env.DB.prepare("INSERT INTO sermon_outline_blocks (study_id, user_id, kind, position, title, body, planned_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(duplicateId, user.id, block.kind, index + 1, block.title, block.body, block.plannedMinutes, now, now)),
    ]);
    return withCors(Response.json({ duplicateId }));
  } else {
    const title = text(payload.title, 100);
    if (title.length < 2) return withCors(Response.json({ error: "Título muito curto" }, { status: 400 }));
    const color = typeof payload.color === "string" && colors.has(payload.color) ? payload.color : "gold";
    const icon = typeof payload.icon === "string" && icons.has(payload.icon) ? payload.icon : "✎";
    await env.DB.batch([
      env.DB.prepare("UPDATE personal_studies SET title = ?, color = ?, icon = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(title, color, icon, now, studyId, user.id),
      env.DB.prepare("UPDATE sermon_outlines SET theme = ?, base_reference = ?, category = ?, favorite = ?, planned_minutes = ?, alert_marks_json = ?, sermon_date = ?, location = ?, event_name = ?, actual_minutes = ?, post_notes = ?, updated_at = ? WHERE study_id = ? AND user_id = ?").bind(text(payload.theme, 160), text(payload.baseReference, 120), text(payload.category, 60) || "Geral", payload.favorite ? 1 : 0, integer(payload.plannedMinutes, 1, 240, 30), JSON.stringify(alertMarks(payload.alertMarks)), text(payload.sermonDate, 10) || null, text(payload.location, 160), text(payload.eventName, 160), payload.actualMinutes === null || payload.actualMinutes === undefined ? null : integer(payload.actualMinutes, 1, 1440, 1), text(payload.postNotes, 4000, false), now, studyId, user.id),
    ]);
  }

  const outline = await fullOutline(studyId, user.id);
  return withCors(Response.json({ outline }));
}

export async function DELETE(_: Request, context: Context) {
  const user = await currentUser();
  const studyId = positiveId((await context.params).id);
  if (!user) return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));
  if (!studyId || !(await ownedOutline(studyId, user.id)))
    return withCors(Response.json({ error: "Esboço não encontrado" }, { status: 404 }));
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sermon_sessions WHERE study_id = ? AND user_id = ?").bind(studyId, user.id),
    env.DB.prepare("DELETE FROM sermon_outline_revisions WHERE study_id = ? AND user_id = ?").bind(studyId, user.id),
    env.DB.prepare("DELETE FROM sermon_outline_blocks WHERE study_id = ? AND user_id = ?").bind(studyId, user.id),
    env.DB.prepare("DELETE FROM sermon_outlines WHERE study_id = ? AND user_id = ?").bind(studyId, user.id),
    env.DB.prepare("DELETE FROM personal_study_items WHERE study_id = ? AND user_id = ?").bind(studyId, user.id),
    env.DB.prepare("DELETE FROM personal_studies WHERE id = ? AND user_id = ?").bind(studyId, user.id),
  ]);
  return withCors(Response.json({ ok: true }));
}

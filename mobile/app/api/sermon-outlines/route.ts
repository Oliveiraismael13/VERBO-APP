import { env } from "cloudflare:workers";
import { currentUser } from "../../../lib/auth";
import { corsOptions, withCors } from "../../../lib/cors";

export const dynamic = "force-dynamic";

const colors = new Set(["gold", "violet", "teal", "rose", "blue", "green"]);
const icons = new Set(["✦", "♡", "✎", "⌁", "☀", "⚑"]);

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function minutes(value: unknown, fallback = 30) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 240 ? parsed : fallback;
}

export function OPTIONS() {
  return corsOptions();
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user)
    return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));

  const url = new URL(request.url);
  const query = text(url.searchParams.get("query"), 80).replace(/[%_]/g, "");
  const favoritesOnly = url.searchParams.get("favorite") === "1";
  const rows = await env.DB.prepare(
    `SELECT personal_studies.id, personal_studies.title, personal_studies.color,
      personal_studies.icon, personal_studies.updated_at AS updatedAt,
      sermon_outlines.theme, sermon_outlines.base_reference AS baseReference,
      sermon_outlines.category, sermon_outlines.favorite,
      sermon_outlines.planned_minutes AS plannedMinutes,
      COUNT(sermon_outline_blocks.id) AS blockCount
    FROM sermon_outlines
    INNER JOIN personal_studies ON personal_studies.id = sermon_outlines.study_id
    LEFT JOIN sermon_outline_blocks ON sermon_outline_blocks.study_id = sermon_outlines.study_id
    WHERE sermon_outlines.user_id = ?
      AND (? = 0 OR sermon_outlines.favorite = 1)
      AND (? = '' OR personal_studies.title LIKE '%' || ? || '%'
        OR sermon_outlines.theme LIKE '%' || ? || '%'
        OR sermon_outlines.base_reference LIKE '%' || ? || '%'
        OR sermon_outlines.category LIKE '%' || ? || '%')
    GROUP BY personal_studies.id
    ORDER BY sermon_outlines.favorite DESC, personal_studies.updated_at DESC
    LIMIT 100`,
  )
    .bind(user.id, favoritesOnly ? 1 : 0, query, query, query, query, query)
    .all();

  return withCors(Response.json({ outlines: rows.results }));
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user)
    return withCors(Response.json({ error: "Não autenticado" }, { status: 401 }));

  const payload = (await request.json()) as {
    title?: unknown;
    theme?: unknown;
    baseReference?: unknown;
    category?: unknown;
    plannedMinutes?: unknown;
    color?: unknown;
    icon?: unknown;
  };
  const title = text(payload.title, 100);
  if (title.length < 2)
    return withCors(
      Response.json({ error: "Dê um título de pelo menos 2 caracteres ao esboço." }, { status: 400 }),
    );

  const theme = text(payload.theme, 160);
  const baseReference = text(payload.baseReference, 120);
  const category = text(payload.category, 60) || "Geral";
  const plannedMinutes = minutes(payload.plannedMinutes);
  const color = typeof payload.color === "string" && colors.has(payload.color) ? payload.color : "gold";
  const icon = typeof payload.icon === "string" && icons.has(payload.icon) ? payload.icon : "✎";
  const now = Date.now();
  const created = await env.DB.prepare(
    "INSERT INTO personal_studies (user_id, title, color, icon, body, created_at, updated_at) VALUES (?, ?, ?, ?, '', ?, ?)",
  ).bind(user.id, title, color, icon, now, now).run();
  const studyId = Number(created.meta.last_row_id);

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO sermon_outlines (study_id, user_id, theme, base_reference, category, planned_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(studyId, user.id, theme, baseReference, category, plannedMinutes, now, now),
    env.DB.prepare(
      "INSERT INTO sermon_outline_blocks (study_id, user_id, kind, position, title, body, planned_minutes, created_at, updated_at) VALUES (?, ?, 'introduction', 1, 'Introdução', '', 5, ?, ?)",
    ).bind(studyId, user.id, now, now),
    env.DB.prepare(
      "INSERT INTO sermon_outline_blocks (study_id, user_id, kind, position, title, body, planned_minutes, created_at, updated_at) VALUES (?, ?, 'topic', 2, 'Tópico principal', '', ?, ?, ?)",
    ).bind(studyId, user.id, Math.max(5, plannedMinutes - 10), now, now),
    env.DB.prepare(
      "INSERT INTO sermon_outline_blocks (study_id, user_id, kind, position, title, body, planned_minutes, created_at, updated_at) VALUES (?, ?, 'conclusion', 3, 'Conclusão', '', 5, ?, ?)",
    ).bind(studyId, user.id, now, now),
  ]);

  return withCors(Response.json({ outline: { id: studyId, title } }, { status: 201 }));
}

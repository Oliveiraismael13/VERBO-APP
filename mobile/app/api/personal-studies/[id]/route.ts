import { env } from "cloudflare:workers";
import { currentUser } from "../../../../lib/auth";
import { corsOptions, withCors } from "../../../../lib/cors";

export const dynamic = "force-dynamic";

const colors = new Set(["gold", "violet", "teal", "rose", "blue", "green"]);
const icons = new Set(["✦", "♡", "✎", "⌁", "☀", "⚑"]);
type Context = { params: Promise<{ id: string }> };
type Verse = { bookSlug: string; chapter: number; verse: number };
function id(value: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}
function noteBody(value: unknown, maximum: number) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}
function verses(value: unknown) {
  if (!Array.isArray(value)) return [] as Verse[];
  const unique = new Map<string, Verse>();
  value.slice(0, 50).forEach((item) => {
    if (!item || typeof item !== "object") return;
    const ref = item as Partial<Verse>;
    if (
      typeof ref.bookSlug === "string" &&
      /^[a-z0-9]+$/.test(ref.bookSlug) &&
      Number.isInteger(ref.chapter) &&
      ref.chapter! >= 1 &&
      ref.chapter! <= 150 &&
      Number.isInteger(ref.verse) &&
      ref.verse! >= 1 &&
      ref.verse! <= 200
    )
      unique.set(`${ref.bookSlug}:${ref.chapter}:${ref.verse}`, ref as Verse);
  });
  return [...unique.values()];
}
async function ownedStudy(studyId: number, userId: string) {
  return env.DB.prepare(
    "SELECT id, title, color, icon, body, created_at AS createdAt, updated_at AS updatedAt FROM personal_studies WHERE id = ? AND user_id = ?",
  )
    .bind(studyId, userId)
    .first();
}

export function OPTIONS() {
  return corsOptions();
}

export async function GET(_: Request, context: Context) {
  const user = await currentUser();
  const studyId = id((await context.params).id);
  if (!user)
    return withCors(
      Response.json({ error: "Não autenticado" }, { status: 401 }),
    );
  if (!studyId)
    return withCors(
      Response.json({ error: "Estudo inválido" }, { status: 400 }),
    );
  const study = await ownedStudy(studyId, user.id);
  if (!study)
    return withCors(
      Response.json({ error: "Estudo não encontrado" }, { status: 404 }),
    );
  const items = await env.DB.prepare(
    "SELECT id, kind, position, book_slug AS bookSlug, chapter, verse, body FROM personal_study_items WHERE study_id = ? AND user_id = ? ORDER BY position, id",
  )
    .bind(studyId, user.id)
    .all();
  return withCors(Response.json({ study: { ...study, items: items.results } }));
}

export async function PATCH(request: Request, context: Context) {
  const user = await currentUser();
  const studyId = id((await context.params).id);
  if (!user)
    return withCors(
      Response.json({ error: "Não autenticado" }, { status: 401 }),
    );
  if (!studyId || !(await ownedStudy(studyId, user.id)))
    return withCors(
      Response.json({ error: "Estudo não encontrado" }, { status: 404 }),
    );
  const payload = (await request.json()) as {
    action?: unknown;
    title?: unknown;
    color?: unknown;
    icon?: unknown;
    body?: unknown;
    verses?: unknown;
    itemId?: unknown;
    afterItemId?: unknown;
    direction?: unknown;
    order?: unknown;
  };
  const action = typeof payload.action === "string" ? payload.action : "edit";
  const now = Date.now();
  if (action === "add-verses") {
    const selected = verses(payload.verses);
    if (!selected.length)
      return withCors(
        Response.json(
          { error: "Selecione ao menos um versículo." },
          { status: 400 },
        ),
      );
    const last = await env.DB.prepare(
      "SELECT COALESCE(MAX(position), 0) AS position FROM personal_study_items WHERE study_id = ?",
    )
      .bind(studyId)
      .first<{ position: number }>();
    await env.DB.batch([
      ...selected.map((item, index) =>
        env.DB.prepare(
          "INSERT OR IGNORE INTO personal_study_items (study_id, user_id, kind, position, book_slug, chapter, verse, body, created_at, updated_at) VALUES (?, ?, 'verse', ?, ?, ?, ?, '', ?, ?)",
        ).bind(
          studyId,
          user.id,
          Number(last?.position || 0) + index + 1,
          item.bookSlug,
          item.chapter,
          item.verse,
          now,
          now,
        ),
      ),
      env.DB.prepare(
        "UPDATE personal_studies SET updated_at = ? WHERE id = ? AND user_id = ?",
      ).bind(now, studyId, user.id),
    ]);
  } else if (action === "add-note") {
    const afterItemId =
      payload.afterItemId === undefined || payload.afterItemId === null
        ? null
        : id(String(payload.afterItemId));
    const previous = afterItemId
      ? await env.DB.prepare(
          "SELECT position FROM personal_study_items WHERE id = ? AND study_id = ? AND user_id = ?",
        )
          .bind(afterItemId, studyId, user.id)
          .first<{ position: number }>()
      : { position: 0 };
    if (!previous)
      return withCors(
        Response.json(
          { error: "Não foi possível localizar o item anterior." },
          { status: 400 },
        ),
      );
    const target = previous.position + 1;
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE personal_study_items SET position = position + 1, updated_at = ? WHERE study_id = ? AND user_id = ? AND position >= ?",
      ).bind(now, studyId, user.id, target),
      env.DB.prepare(
        "INSERT INTO personal_study_items (study_id, user_id, kind, position, body, created_at, updated_at) VALUES (?, ?, 'note', ?, ?, ?, ?)",
      ).bind(studyId, user.id, target, noteBody(payload.body, 12000), now, now),
      env.DB.prepare(
        "UPDATE personal_studies SET updated_at = ? WHERE id = ? AND user_id = ?",
      ).bind(now, studyId, user.id),
    ]);
  } else if (action === "edit-item") {
    const itemId = id(String(payload.itemId || ""));
    if (!itemId)
      return withCors(
        Response.json({ error: "Anotação inválida" }, { status: 400 }),
      );
    const updated = await env.DB.prepare(
      "UPDATE personal_study_items SET body = ?, updated_at = ? WHERE id = ? AND study_id = ? AND user_id = ? AND kind IN ('note', 'heading')",
    )
      .bind(noteBody(payload.body, 12000), now, itemId, studyId, user.id)
      .run();
    if (!updated.meta.changes)
      return withCors(
        Response.json({ error: "Anotação não encontrada" }, { status: 404 }),
      );
    await env.DB.prepare(
      "UPDATE personal_studies SET updated_at = ? WHERE id = ? AND user_id = ?",
    )
      .bind(now, studyId, user.id)
      .run();
  } else if (action === "remove-item") {
    const itemId = id(String(payload.itemId || ""));
    if (!itemId)
      return withCors(
        Response.json({ error: "Item inválido" }, { status: 400 }),
      );
    const item = await env.DB.prepare(
      "SELECT position FROM personal_study_items WHERE id = ? AND study_id = ? AND user_id = ?",
    )
      .bind(itemId, studyId, user.id)
      .first<{ position: number }>();
    if (!item)
      return withCors(
        Response.json({ error: "Item não encontrado" }, { status: 404 }),
      );
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM personal_study_items WHERE id = ? AND study_id = ? AND user_id = ?",
      ).bind(itemId, studyId, user.id),
      env.DB.prepare(
        "UPDATE personal_study_items SET position = position - 1, updated_at = ? WHERE study_id = ? AND user_id = ? AND position > ?",
      ).bind(now, studyId, user.id, item.position),
      env.DB.prepare(
        "UPDATE personal_studies SET updated_at = ? WHERE id = ? AND user_id = ?",
      ).bind(now, studyId, user.id),
    ]);
  } else if (action === "move-item") {
    const itemId = id(String(payload.itemId || ""));
    const item = itemId
      ? await env.DB.prepare(
          "SELECT position FROM personal_study_items WHERE id = ? AND study_id = ? AND user_id = ?",
        )
          .bind(itemId, studyId, user.id)
          .first<{ position: number }>()
      : null;
    const direction =
      payload.direction === "up" || payload.direction === "down"
        ? payload.direction
        : null;
    if (!itemId || !item || !direction)
      return withCors(
        Response.json({ error: "Movimento inválido" }, { status: 400 }),
      );
    const neighbour = await env.DB.prepare(
      direction === "up"
        ? "SELECT id, position FROM personal_study_items WHERE study_id = ? AND user_id = ? AND position < ? ORDER BY position DESC, id DESC LIMIT 1"
        : "SELECT id, position FROM personal_study_items WHERE study_id = ? AND user_id = ? AND position > ? ORDER BY position, id LIMIT 1",
    )
      .bind(studyId, user.id, item.position)
      .first<{ id: number; position: number }>();
    if (neighbour)
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE personal_study_items SET position = ?, updated_at = ? WHERE id = ? AND study_id = ? AND user_id = ?",
        ).bind(neighbour.position, now, itemId, studyId, user.id),
        env.DB.prepare(
          "UPDATE personal_study_items SET position = ?, updated_at = ? WHERE id = ? AND study_id = ? AND user_id = ?",
        ).bind(item.position, now, neighbour.id, studyId, user.id),
        env.DB.prepare(
          "UPDATE personal_studies SET updated_at = ? WHERE id = ? AND user_id = ?",
        ).bind(now, studyId, user.id),
      ]);
  } else if (action === "reorder") {
    const order = Array.isArray(payload.order)
      ? payload.order
          .map((item) => id(String(item)))
          .filter((item): item is number => Boolean(item))
      : [];
    if (!order.length)
      return withCors(
        Response.json({ error: "Ordem inválida" }, { status: 400 }),
      );
    const ownItems = await env.DB.prepare(
      `SELECT id FROM personal_study_items WHERE study_id = ? AND user_id = ? AND id IN (${order.map(() => "?").join(",")})`,
    )
      .bind(studyId, user.id, ...order)
      .all<{ id: number }>();
    const total = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM personal_study_items WHERE study_id = ? AND user_id = ?",
    )
      .bind(studyId, user.id)
      .first<{ count: number }>();
    if (
      ownItems.results.length !== order.length ||
      order.length !== Number(total?.count || 0)
    )
      return withCors(
        Response.json(
          { error: "A ordem deve conter todos os itens deste estudo." },
          { status: 400 },
        ),
      );
    await env.DB.batch([
      ...order.map((item, index) =>
        env.DB.prepare(
          "UPDATE personal_study_items SET position = ?, updated_at = ? WHERE id = ? AND study_id = ? AND user_id = ?",
        ).bind(index + 1, now, item, studyId, user.id),
      ),
      env.DB.prepare(
        "UPDATE personal_studies SET updated_at = ? WHERE id = ? AND user_id = ?",
      ).bind(now, studyId, user.id),
    ]);
  } else {
    const title = text(payload.title, 80);
    const body = noteBody(payload.body, 12000);
    const color =
      typeof payload.color === "string" && colors.has(payload.color)
        ? payload.color
        : "gold";
    const icon =
      typeof payload.icon === "string" && icons.has(payload.icon)
        ? payload.icon
        : "✦";
    if (title.length < 2)
      return withCors(
        Response.json(
          { error: "Dê um nome de pelo menos 2 caracteres ao estudo." },
          { status: 400 },
        ),
      );
    await env.DB.prepare(
      "UPDATE personal_studies SET title = ?, color = ?, icon = ?, body = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    )
      .bind(title, color, icon, body, now, studyId, user.id)
      .run();
  }
  const study = await ownedStudy(studyId, user.id);
  const items = await env.DB.prepare(
    "SELECT id, kind, position, book_slug AS bookSlug, chapter, verse, body FROM personal_study_items WHERE study_id = ? AND user_id = ? ORDER BY position, id",
  )
    .bind(studyId, user.id)
    .all();
  return withCors(Response.json({ study: { ...study, items: items.results } }));
}

export async function DELETE(_: Request, context: Context) {
  const user = await currentUser();
  const studyId = id((await context.params).id);
  if (!user)
    return withCors(
      Response.json({ error: "Não autenticado" }, { status: 401 }),
    );
  if (!studyId || !(await ownedStudy(studyId, user.id)))
    return withCors(
      Response.json({ error: "Estudo não encontrado" }, { status: 404 }),
    );
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM personal_study_items WHERE study_id = ? AND user_id = ?",
    ).bind(studyId, user.id),
    env.DB.prepare(
      "DELETE FROM personal_studies WHERE id = ? AND user_id = ?",
    ).bind(studyId, user.id),
  ]);
  return withCors(Response.json({ ok: true }));
}

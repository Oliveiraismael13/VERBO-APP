"use client";

import { useCallback, useEffect, useState } from "react";

export type StudyVerseReference = {
  bookSlug: string;
  chapter: number;
  verse: number;
};
type StudySummary = {
  id: number;
  title: string;
  color: string;
  icon: string;
  body: string;
  updatedAt: number;
  itemCount: number;
};
type StudyItem = Partial<StudyVerseReference> & {
  id: number;
  kind: "verse" | "heading" | "note";
  position: number;
  body: string;
};
type StudyDetail = StudySummary & { createdAt: number; items: StudyItem[] };
type Source = {
  path: string;
  privateTranslation: boolean;
  bookNames: Record<string, string>;
};

const colors = ["gold", "violet", "teal", "rose", "blue", "green"];
const icons = ["✦", "♡", "✎", "⌁", "☀", "⚑"];

async function responseJson<T>(request: Promise<Response>) {
  const response = await request;
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(data.error || "Não foi possível salvar o estudo.");
  return data;
}

function referenceLabel(
  reference: Partial<StudyVerseReference>,
  names: Record<string, string>,
) {
  return `${names[reference.bookSlug || ""] || reference.bookSlug} ${reference.chapter}:${reference.verse}`;
}

function VersePreview({
  item,
  source,
  onOpen,
}: {
  item: StudyItem;
  source: Source;
  onOpen: (reference: StudyVerseReference) => void;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (item.kind !== "verse" || !item.bookSlug || !item.chapter || !item.verse)
      return;
    const controller = new AbortController();
    const suffix = source.privateTranslation
      ? item.bookSlug
      : `${item.bookSlug}.json`;
    fetch(`${source.path}/${suffix}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((book: { chapters?: { text?: string }[][] } | null) => {
        const verse = book?.chapters?.[item.chapter! - 1]?.find(
          (candidate) =>
            candidate &&
            typeof candidate.text === "string" &&
            Number((candidate as { number?: number }).number) === item.verse,
        );
        setText(verse?.text || "Texto indisponível nesta edição.");
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [
    item.bookSlug,
    item.chapter,
    item.verse,
    item.kind,
    source.path,
    source.privateTranslation,
  ]);
  if (item.kind !== "verse")
    return (
      <article className={`study-block study-block-${item.kind}`}>
        {item.body}
      </article>
    );
  return (
    <button
      className="study-verse"
      onClick={() =>
        onOpen({
          bookSlug: item.bookSlug!,
          chapter: item.chapter!,
          verse: item.verse!,
        })
      }
    >
      <small>{referenceLabel(item, source.bookNames)}</small>
      <b>{text || "Carregando versículo…"}</b>
      <span>Abrir na Bíblia ›</span>
    </button>
  );
}

export function StudyPicker({
  open,
  selection,
  onClose,
  onAssigned,
}: {
  open: boolean;
  selection: StudyVerseReference[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState("gold");
  const [icon, setIcon] = useState("✦");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    void responseJson<{ studies: StudySummary[] }>(
      fetch("/api/personal-studies"),
    )
      .then((data) => setStudies(data.studies))
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar os estudos.",
        ),
      );
  }, [open]);
  if (!open) return null;
  const assign = async () => {
    if (!chosen.length) return;
    setBusy(true);
    setError("");
    try {
      await Promise.all(
        chosen.map((id) =>
          responseJson(
            fetch(`/api/personal-studies/${id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "add-verses", verses: selection }),
            }),
          ),
        ),
      );
      onAssigned();
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível adicionar os versículos.",
      );
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    setBusy(true);
    setError("");
    try {
      await responseJson(
        fetch("/api/personal-studies", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title, color, icon, verses: selection }),
        }),
      );
      setTitle("");
      onAssigned();
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível criar o estudo.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="study-picker-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Adicionar ao estudo"
    >
      <section className="study-picker">
        <button className="study-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <p className="eyebrow">MEUS ESTUDOS</p>
        <h2>
          Adicionar{" "}
          {selection.length > 1
            ? `${selection.length} versículos`
            : "versículo"}
        </h2>
        <small>Escolha um estudo existente ou crie um agora.</small>
        <div className="study-choice-list">
          {studies.length ? (
            studies.map((study) => (
              <button
                key={study.id}
                className={chosen.includes(study.id) ? "chosen" : ""}
                onClick={() =>
                  setChosen((current) =>
                    current.includes(study.id)
                      ? current.filter((id) => id !== study.id)
                      : [...current, study.id],
                  )
                }
              >
                <i data-color={study.color}>{study.icon}</i>
                <span>
                  <b>{study.title}</b>
                  <small>{study.itemCount} itens</small>
                </span>
                <em>{chosen.includes(study.id) ? "✓" : "+"}</em>
              </button>
            ))
          ) : (
            <p className="study-empty-mini">Você ainda não criou um estudo.</p>
          )}
        </div>
        <button
          className="study-add-existing"
          disabled={!chosen.length || busy}
          onClick={() => void assign()}
        >
          Adicionar aos estudos selecionados
        </button>
        <div className="study-create-inline">
          <b>Criar novo estudo</b>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            placeholder="Ex.: Salvação"
          />
          <div className="study-options">
            <span>
              {icons.map((item) => (
                <button
                  key={item}
                  className={icon === item ? "active" : ""}
                  onClick={() => setIcon(item)}
                >
                  {item}
                </button>
              ))}
            </span>
            <span>
              {colors.map((item) => (
                <button
                  key={item}
                  className={`study-color ${item} ${color === item ? "active" : ""}`}
                  onClick={() => setColor(item)}
                  aria-label={`Cor ${item}`}
                />
              ))}
            </span>
          </div>
          <button
            className="study-create"
            disabled={busy || title.trim().length < 2}
            onClick={() => void create()}
          >
            Criar e adicionar
          </button>
        </div>
        {error && <p className="study-error">{error}</p>}
      </section>
    </div>
  );
}

export function PersonalStudies({
  open,
  onClose,
  onOpenReference,
  source,
  referenceFilter,
}: {
  open: boolean;
  onClose: () => void;
  onOpenReference: (reference: StudyVerseReference) => void;
  source: Source;
  referenceFilter?: StudyVerseReference | null;
}) {
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [selected, setSelected] = useState<StudyDetail | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    color: "gold",
    icon: "✦",
    body: "",
  });
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [newNote, setNewNote] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);
  const [savingNewNote, setSavingNewNote] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const loadStudies = useCallback(async (search = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ query: search });
      if (referenceFilter) {
        params.set("bookSlug", referenceFilter.bookSlug);
        params.set("chapter", String(referenceFilter.chapter));
        params.set("verse", String(referenceFilter.verse));
      }
      const data = await responseJson<{ studies: StudySummary[] }>(
        fetch(`/api/personal-studies?${params}`),
      );
      setStudies(data.studies);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar os estudos.",
      );
    } finally {
      setLoading(false);
    }
  }, [referenceFilter]);
  const openStudy = async (id: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await responseJson<{ study: StudyDetail }>(
        fetch(`/api/personal-studies/${id}`),
      );
      setSelected(data.study);
      setDraft({
        title: data.study.title,
        color: data.study.color,
        icon: data.study.icon,
        body: data.study.body,
      });
      setNoteDrafts({});
      setEditingNoteId(null);
      setNewNote("");
      setDirty(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível abrir o estudo.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void loadStudies(""), 0);
    return () => window.clearTimeout(timer);
  }, [open, loadStudies]);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void loadStudies(query), 280);
    return () => window.clearTimeout(timer);
  }, [open, query, loadStudies]);
  const saveStudy = useCallback(async () => {
    if (!selected || !dirty) return true;
    setSaving(true);
    try {
      const data = await responseJson<{ study: StudyDetail }>(
        fetch(`/api/personal-studies/${selected.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        }),
      );
      setSelected(data.study);
      setDirty(false);
      void loadStudies(query);
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar o estudo.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [selected, dirty, draft, loadStudies, query]);
  useEffect(() => {
    if (!selected || !dirty) return;
    const timer = window.setTimeout(() => void saveStudy(), 700);
    return () => window.clearTimeout(timer);
  }, [selected, dirty, saveStudy]);
  const updateItems = async (body: Record<string, unknown>) => {
    if (!selected) return false;
    try {
      const data = await responseJson<{ study: StudyDetail }>(
        fetch(`/api/personal-studies/${selected.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      setSelected(data.study);
      void loadStudies(query);
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível atualizar os itens do estudo.",
      );
      return false;
    }
  };
  const saveNote = async (itemId: number) => {
    if (!(itemId in noteDrafts)) return true;
    setSavingNoteId(itemId);
    const saved = await updateItems({
      action: "edit-item",
      itemId,
      body: noteDrafts[itemId],
    });
    if (saved)
      setNoteDrafts((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    if (saved) setEditingNoteId(null);
    setSavingNoteId(null);
    return saved;
  };
  const savePendingNotes = async () => {
    for (const itemId of Object.keys(noteDrafts).map(Number))
      if (!(await saveNote(itemId))) return false;
    return true;
  };
  const addNote = async (
    afterItemId: number | null,
    body = "",
    openEditor = true,
  ) => {
    const itemIds = new Set(selected?.items.map((item) => item.id));
    const study = await updateItems({ action: "add-note", afterItemId, body });
    if (study && openEditor) {
      const newItem = study.items.find((item) => !itemIds.has(item.id));
      if (newItem) setEditingNoteId(newItem.id);
    }
    return study;
  };
  const saveNewNote = async () => {
    if (!selected || !newNote.trim()) return;
    setSavingNewNote(true);
    try {
      const saved = await addNote(
        selected.items.at(-1)?.id ?? null,
        newNote,
        false,
      );
      if (saved) setNewNote("");
    } finally {
      setSavingNewNote(false);
    }
  };
  const moveItem = async (item: StudyItem, direction: "up" | "down") => {
    if (item.kind === "note" && !(await saveNote(item.id))) return;
    await updateItems({ action: "move-item", itemId: item.id, direction });
  };
  const removeItem = async (item: StudyItem) => {
    if (item.kind === "note" && !(await saveNote(item.id))) return;
    await updateItems({ action: "remove-item", itemId: item.id });
  };
  const leaveDetail = async (close: boolean) => {
    if (!selected) {
      onClose();
      return;
    }
    if (!(await saveStudy()) || !(await savePendingNotes())) return;
    if (close) onClose();
    else setSelected(null);
  };
  const create = async () => {
    try {
      const data = await responseJson<{ study: StudySummary }>(
        fetch("/api/personal-studies", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: newTitle, color: "gold", icon: "✦" }),
        }),
      );
      setNewTitle("");
      await loadStudies(query);
      await openStudy(data.study.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível criar o estudo.",
      );
    }
  };
  const deleteStudy = async () => {
    if (!selected || !window.confirm(`Excluir o estudo “${selected.title}”?`))
      return;
    try {
      await responseJson(
        fetch(`/api/personal-studies/${selected.id}`, { method: "DELETE" }),
      );
      setSelected(null);
      setNoteDrafts({});
      setEditingNoteId(null);
      setNewNote("");
      await loadStudies(query);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível excluir o estudo.",
      );
    }
  };
  if (!open) return null;
  const verseCount =
    selected?.items.filter((item) => item.kind === "verse").length || 0;
  const noteCount =
    selected?.items.filter((item) => item.kind === "note").length || 0;
  return (
    <div className="study-library-backdrop">
      <section className="study-library">
        <header>
          <button
            className="study-back"
            onClick={() => void leaveDetail(false)}
          >
            {selected ? "‹ Estudos" : "‹ Voltar"}
          </button>
          <span>
              {saving || savingNoteId || savingNewNote
              ? "Salvando…"
              : dirty || Object.keys(noteDrafts).length
                ? "Alterações pendentes"
                : selected
                  ? "Salvo"
                  : ""}
          </span>
          <button
            className="study-close"
            onClick={() => void leaveDetail(true)}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>
        {selected ? (
          <section className="study-detail">
            <div className="study-detail-title">
              <i data-color={draft.color}>{draft.icon}</i>
              <input
                aria-label="Título do estudo"
                value={draft.title}
                maxLength={80}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }));
                  setDirty(true);
                }}
              />
            </div>
            <div className="study-options study-detail-options">
              <span>
                {icons.map((item) => (
                  <button
                    key={item}
                    className={draft.icon === item ? "active" : ""}
                    onClick={() => {
                      setDraft((current) => ({ ...current, icon: item }));
                      setDirty(true);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </span>
              <span>
                {colors.map((item) => (
                  <button
                    key={item}
                    className={`study-color ${item} ${draft.color === item ? "active" : ""}`}
                    onClick={() => {
                      setDraft((current) => ({ ...current, color: item }));
                      setDirty(true);
                    }}
                    aria-label={`Cor ${item}`}
                  />
                ))}
              </span>
            </div>
            <section className="study-note-composer">
              <b>NOVA ANOTAÇÃO</b>
              <textarea
                value={newNote}
                maxLength={12000}
                onChange={(event) => setNewNote(event.target.value)}
                placeholder="Escreva uma observação, aplicação ou pergunta para incluir no roteiro…"
              />
              <button
                type="button"
                className="study-save-new-note"
                disabled={!newNote.trim() || Boolean(savingNoteId) || savingNewNote}
                onClick={() => void saveNewNote()}
              >
                {savingNewNote ? "Adicionando…" : "Salvar e adicionar ao roteiro"}
              </button>
            </section>
            {selected.body && <p className="study-saved-summary"><b>Resumo geral:</b> {selected.body}</p>}
            <div className="study-verses-heading">
              <div>
                <p className="eyebrow">ROTEIRO DO ESTUDO</p>
                <h2>
                  {verseCount} {verseCount === 1 ? "versículo" : "versículos"} ·{" "}
                  {noteCount} {noteCount === 1 ? "nota" : "notas"}
                </h2>
              </div>
              <button
                className="study-delete"
                onClick={() => void deleteStudy()}
              >
                Excluir
              </button>
            </div>
            <p className="study-items-help">
              Inclua quantas anotações quiser e use as setas para posicioná-las
              entre os versículos.
            </p>
            <div className="study-items">
              <button
                className="study-insert-note"
                onClick={() => void addNote(null)}
              >
                ＋ Inserir anotação no início
              </button>
              {selected.items.map((item, index) => (
                <div className="study-item-wrap" key={item.id}>
                  <article className={`study-item study-item-${item.kind}`}>
                    <div className="study-order">
                      <button
                        disabled={index === 0}
                        onClick={() => void moveItem(item, "up")}
                        aria-label="Mover para cima"
                      >
                        ↑
                      </button>
                      <button
                        disabled={index === selected.items.length - 1}
                        onClick={() => void moveItem(item, "down")}
                        aria-label="Mover para baixo"
                      >
                        ↓
                      </button>
                    </div>
                    {item.kind === "note" && editingNoteId === item.id ? (
                      <section className="study-note study-note-editing">
                        <div>
                          <b>ANOTAÇÃO</b>
                          <small>
                            {savingNoteId === item.id
                              ? "Salvando…"
                              : item.id in noteDrafts
                                ? "Alterada"
                                : "Salva"}
                          </small>
                        </div>
                        <textarea
                          value={noteDrafts[item.id] ?? item.body}
                          maxLength={12000}
                          onChange={(event) =>
                            setNoteDrafts((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          onBlur={() => void saveNote(item.id)}
                          placeholder="Escreva sua observação, aplicação ou pergunta…"
                        />
                        <button
                          type="button"
                          disabled={
                            savingNoteId === item.id || !(item.id in noteDrafts)
                          }
                          onClick={() => void saveNote(item.id)}
                        >
                          {savingNoteId === item.id
                            ? "Salvando…"
                            : "Salvar anotação"}
                        </button>
                      </section>
                    ) : item.kind === "note" ? (
                      <button
                        type="button"
                        className="study-verse study-note-preview"
                        onClick={() => setEditingNoteId(item.id)}
                      >
                        <small>ANOTAÇÃO</small>
                        <b>{item.body || "Anotação sem texto"}</b>
                        <span>Editar nota ›</span>
                      </button>
                    ) : (
                      <VersePreview
                        item={item}
                        source={source}
                        onOpen={onOpenReference}
                      />
                    )}
                    <button
                      className="study-remove-item"
                      onClick={() => void removeItem(item)}
                      aria-label={
                        item.kind === "verse"
                          ? `Remover ${referenceLabel(item, source.bookNames)}`
                          : "Remover anotação"
                      }
                    >
                      ×
                    </button>
                  </article>
                  <button
                    className="study-insert-note between"
                    onClick={() => void addNote(item.id)}
                  >
                    ＋ Inserir anotação aqui
                  </button>
                </div>
              ))}
              {!selected.items.length && (
                <p className="study-empty-mini">
                  Adicione uma anotação agora ou volte à Bíblia para reunir
                  versículos neste estudo.
                </p>
              )}
            </div>
          </section>
        ) : (
          <section className="study-list">
            <div className="study-library-heading">
              <p className="eyebrow">BIBLIOTECA PESSOAL</p>
              <h1>{referenceFilter ? "Estudos deste versículo" : "Meus Estudos"}</h1>
              <p>
                {referenceFilter
                  ? `Escolha o estudo que contém ${referenceLabel(referenceFilter, source.bookNames)}.`
                  : "Conecte versículos, anotações e suas descobertas na Palavra."}
              </p>
            </div>
            <div className="study-new">
              <input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                maxLength={80}
                placeholder="Nome do novo estudo"
              />
              <button
                disabled={newTitle.trim().length < 2}
                onClick={() => void create()}
              >
                Criar
              </button>
            </div>
            <input
              className="study-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar estudos"
              aria-label="Buscar estudos"
            />
            {loading && <p className="study-loading">Carregando…</p>}
            {!loading && (
              <div className="study-cards">
                {studies.length ? (
                  studies.map((study) => (
                    <button
                      key={study.id}
                      onClick={() => void openStudy(study.id)}
                    >
                      <i data-color={study.color}>{study.icon}</i>
                      <span>
                        <b>{study.title}</b>
                        <small>
                          {study.itemCount}{" "}
                          {study.itemCount === 1 ? "item" : "itens"} ·
                          atualizado{" "}
                          {new Date(study.updatedAt).toLocaleDateString(
                            "pt-BR",
                          )}
                        </small>
                        {study.body && <em>{study.body}</em>}
                      </span>
                      <strong>›</strong>
                    </button>
                  ))
                ) : (
                  <div className="study-empty">
                    <span>✦</span>
                    <h2>Seu primeiro estudo começa aqui</h2>
                    <p>
                      Crie um tema e, na Bíblia, reúna os versículos que quer
                      revisitar.
                    </p>
                  </div>
                )}
              </div>
            )}
            {error && <p className="study-error">{error}</p>}
          </section>
        )}
      </section>
    </div>
  );
}

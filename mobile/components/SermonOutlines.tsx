"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type StudyVerseReference = { bookSlug: string; chapter: number; verse: number };
type Source = { path: string; privateTranslation: boolean; bookNames: Record<string, string> };
type BlockKind = "introduction" | "topic" | "subtopic" | "application" | "illustration" | "verse" | "prayer" | "observation" | "conclusion" | "divider";
type OutlineBlock = { id: number; kind: BlockKind; position: number; title: string; body: string; plannedMinutes: number };
type OutlineSummary = { id: number; title: string; color: string; icon: string; updatedAt: number; theme: string; baseReference: string; category: string; favorite: boolean | number; plannedMinutes: number; blockCount: number };
type SermonSession = { id: number; startedAt: number; endedAt: number; plannedSeconds: number; actualSeconds: number; location: string; eventName: string; notes: string };
type OutlineDetail = OutlineSummary & { createdAt: number; alertMarks: number[]; sermonDate: string | null; location: string; eventName: string; actualMinutes: number | null; postNotes: string; blocks: OutlineBlock[]; revisions: { id: number; createdAt: number }[]; sessions: SermonSession[] };
type TimerState = { running: boolean; startedAt: number; elapsedMs: number; sessionStartedAt: number };

const blockLabels: Record<BlockKind, string> = {
  introduction: "Introdução", topic: "Tópico", subtopic: "Subtópico", application: "Aplicação",
  illustration: "Ilustração", verse: "Texto bíblico", prayer: "Oração", observation: "Observação",
  conclusion: "Conclusão", divider: "Separador",
};
const addableKinds: BlockKind[] = ["topic", "subtopic", "verse", "application", "illustration", "prayer", "observation", "conclusion", "divider"];
const emptyTimer: TimerState = { running: false, startedAt: 0, elapsedMs: 0, sessionStartedAt: 0 };

async function responseJson<T>(request: Promise<Response>) {
  const response = await request;
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o esboço.");
  return data;
}

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function parseReference(value: string, names: Record<string, string>): StudyVerseReference | null {
  const match = value.trim().match(/^(.+?)\s+(\d+)(?::(\d+))?/);
  if (!match) return null;
  const wanted = normalize(match[1]);
  const book = Object.entries(names).find(([slug, name]) => normalize(slug) === wanted || normalize(name) === wanted);
  if (!book) return null;
  const chapter = Number(match[2]);
  const verse = Number(match[3] || 1);
  return chapter >= 1 && verse >= 1 ? { bookSlug: book[0], chapter, verse } : null;
}

function inlineRichText(value: string): ReactNode[] {
  const tokens = value.split(/(\*\*[^*]+\*\*|__[^_]+__|==[^=]+==|\*[^*]+\*)/g);
  return tokens.filter(Boolean).map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("__") && token.endsWith("__")) return <u key={index}>{token.slice(2, -2)}</u>;
    if (token.startsWith("==") && token.endsWith("==")) return <mark key={index}>{token.slice(2, -2)}</mark>;
    if (token.startsWith("*") && token.endsWith("*")) return <em key={index}>{token.slice(1, -1)}</em>;
    return token;
  });
}

function RichPreview({ value }: { value: string }) {
  const lines = value.split("\n");
  return <div className="sermon-rich-preview">{lines.map((line, index) => {
    if (line.trim() === "---") return <hr key={index} />;
    if (line.startsWith("## ")) return <h4 key={index}>{inlineRichText(line.slice(3))}</h4>;
    if (line.startsWith("# ")) return <h3 key={index}>{inlineRichText(line.slice(2))}</h3>;
    if (line.startsWith("> ")) return <blockquote key={index}>{inlineRichText(line.slice(2))}</blockquote>;
    if (line.startsWith("- ")) return <p className="sermon-bullet" key={index}>• {inlineRichText(line.slice(2))}</p>;
    if (/^\d+\.\s/.test(line)) return <p className="sermon-number" key={index}>{inlineRichText(line)}</p>;
    return line ? <p key={index}>{inlineRichText(line)}</p> : <br key={index} />;
  })}</div>;
}

function SermonTextEditor({ value, onChange, onBlur }: { value: string; onChange: (value: string) => void; onBlur: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const replaceSelection = (before: string, after = before, fallback = "texto") => {
    const field = ref.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };
  const prefixLines = (prefix: string) => {
    const field = ref.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = value.slice(start, end) || "Novo item";
    const next = selected.split("\n").map((line, index) => prefix === "1. " ? `${index + 1}. ${line}` : `${prefix}${line}`).join("\n");
    onChange(`${value.slice(0, start)}${next}${value.slice(end)}`);
  };
  return <section className="sermon-text-editor">
    <div className="sermon-format-bar" aria-label="Formatação do texto">
      <button type="button" onClick={() => replaceSelection("**")}>B</button>
      <button type="button" className="italic" onClick={() => replaceSelection("*")}>I</button>
      <button type="button" className="underline" onClick={() => replaceSelection("__")}>U</button>
      <button type="button" onClick={() => prefixLines("## ")}>H2</button>
      <button type="button" onClick={() => prefixLines("- ")}>• Lista</button>
      <button type="button" onClick={() => prefixLines("1. ")}>1. Lista</button>
      <button type="button" onClick={() => prefixLines("> ")}>“”</button>
      <button type="button" onClick={() => replaceSelection("==")}>Destaque</button>
      <button type="button" onClick={() => replaceSelection("\n---\n", "", "")}>—</button>
      <button type="button" onClick={() => replaceSelection("🙏 ", "", "")}>🙏</button>
    </div>
    <textarea ref={ref} value={value} maxLength={20_000} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} placeholder="Desenvolva este ponto da mensagem…" />
  </section>;
}

function useSermonTimer(outlineId: number | null, plannedMinutes: number, alertMarks: number[]) {
  const [timer, setTimer] = useState<TimerState>(emptyTimer);
  const [tick, setTick] = useState(0);
  const [hydratedKey, setHydratedKey] = useState("");
  const [notice, setNotice] = useState("");
  const alerted = useRef(new Set<number>());
  const storageKey = outlineId ? `verbo-sermon-timer-${outlineId}` : "";
  useEffect(() => {
    if (!storageKey) return;
    const timeout = window.setTimeout(() => {
      let saved: TimerState | null = null;
      try { saved = JSON.parse(localStorage.getItem(storageKey) || "null") as TimerState | null; } catch { localStorage.removeItem(storageKey); }
      setTimer(saved && typeof saved.elapsedMs === "number" ? saved : emptyTimer);
      setTick(Date.now());
      setHydratedKey(storageKey);
      alerted.current.clear();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey || hydratedKey !== storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(timer));
  }, [hydratedKey, storageKey, timer]);
  useEffect(() => {
    if (!timer.running) return;
    const interval = window.setInterval(() => setTick(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [timer.running]);
  const elapsedSeconds = Math.floor((timer.elapsedMs + (timer.running ? tick - timer.startedAt : 0)) / 1000);
  const plannedSeconds = plannedMinutes * 60;
  const remainingSeconds = Math.max(0, plannedSeconds - elapsedSeconds);
  const percent = plannedSeconds ? Math.min(100, Math.floor(elapsedSeconds / plannedSeconds * 100)) : 0;
  useEffect(() => {
    const reached = alertMarks.filter((mark) => percent >= mark && !alerted.current.has(mark));
    if (!reached.length) return;
    const mark = reached.at(-1)!;
    reached.forEach((item) => alerted.current.add(item));
    setNotice(mark >= 100 ? "Tempo planejado encerrado" : `${mark}% do tempo utilizado`);
    navigator.vibrate?.(mark >= 100 ? [220, 100, 220] : [160]);
    const timeout = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [alertMarks, percent]);
  const start = () => setTimer((current) => current.running ? current : { ...current, running: true, startedAt: Date.now(), sessionStartedAt: current.sessionStartedAt || Date.now() });
  const pause = () => setTimer((current) => current.running ? { ...current, running: false, elapsedMs: current.elapsedMs + Date.now() - current.startedAt, startedAt: 0 } : current);
  const reset = () => { setTimer(emptyTimer); alerted.current.clear(); setTick(Date.now()); };
  return { timer, elapsedSeconds, remainingSeconds, plannedSeconds, percent, notice, start, pause, reset };
}

export function SermonOutlines({ onBack, onClose, onOpenReference, source }: { onBack: () => void; onClose: () => void; onOpenReference: (reference: StudyVerseReference) => void; source: Source }) {
  const [outlines, setOutlines] = useState<OutlineSummary[]>([]);
  const [selected, setSelected] = useState<OutlineDetail | null>(null);
  const [draft, setDraft] = useState<OutlineDetail | null>(null);
  const [query, setQuery] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirtyMeta, setDirtyMeta] = useState(false);
  const [dirtyBlocks, setDirtyBlocks] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [addKind, setAddKind] = useState<BlockKind>("topic");
  const [preaching, setPreaching] = useState(false);
  const [activeBlock, setActiveBlock] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  const loadOutlines = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ query });
      if (favoritesOnly) params.set("favorite", "1");
      const data = await responseJson<{ outlines: OutlineSummary[] }>(fetch(`/api/sermon-outlines?${params}`));
      setOutlines(data.outlines);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar os esboços."); }
    finally { setLoading(false); }
  }, [favoritesOnly, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOutlines(), 250);
    return () => window.clearTimeout(timer);
  }, [loadOutlines]);

  const openOutline = async (id: number) => {
    setLoading(true); setError("");
    try {
      const data = await responseJson<{ outline: OutlineDetail }>(fetch(`/api/sermon-outlines/${id}`));
      setSelected(data.outline); setDraft(data.outline); setDirtyMeta(false); setDirtyBlocks(new Set()); setActiveBlock(0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível abrir o esboço."); }
    finally { setLoading(false); }
  };

  const timer = useSermonTimer(selected?.id ?? null, draft?.plannedMinutes || 30, draft?.alertMarks || [50, 75, 90, 100]);

  useEffect(() => {
    if (!selected || !draft || !dirtyMeta) return;
    const save = window.setTimeout(async () => {
      setSaving(true);
      try {
        await responseJson(fetch(`/api/sermon-outlines/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) }));
        setDirtyMeta(false);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar o esboço."); }
      finally { setSaving(false); }
    }, 800);
    return () => window.clearTimeout(save);
  }, [dirtyMeta, draft, selected]);

  useEffect(() => {
    if (!selected || !draft || !dirtyBlocks.size) return;
    const ids = [...dirtyBlocks];
    const save = window.setTimeout(async () => {
      setSaving(true);
      try {
        await Promise.all(ids.map((id) => {
          const block = draft.blocks.find((item) => item.id === id);
          return block ? responseJson(fetch(`/api/sermon-outlines/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "edit-block", blockId: id, ...block }) })) : Promise.resolve(null);
        }));
        setDirtyBlocks((current) => new Set([...current].filter((id) => !ids.includes(id))));
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar os tópicos."); }
      finally { setSaving(false); }
    }, 900);
    return () => window.clearTimeout(save);
  }, [dirtyBlocks, draft, selected]);

  useEffect(() => {
    if (!selected) return;
    const interval = window.setInterval(() => void responseJson(fetch(`/api/sermon-outlines/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "checkpoint" }) })).catch(() => undefined), 300_000);
    return () => window.clearInterval(interval);
  }, [selected]);

  const requestWakeLock = useCallback(async () => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    try { wakeLock.current = nav.wakeLock ? await nav.wakeLock.request("screen") : null; } catch { wakeLock.current = null; }
  }, []);
  useEffect(() => {
    if (!preaching) return;
    void requestWakeLock();
    const restore = () => { if (document.visibilityState === "visible") void requestWakeLock(); };
    document.addEventListener("visibilitychange", restore);
    return () => { document.removeEventListener("visibilitychange", restore); void wakeLock.current?.release(); wakeLock.current = null; };
  }, [preaching, requestWakeLock]);

  const createOutline = async () => {
    if (newTitle.trim().length < 2) return;
    setSaving(true);
    try {
      const data = await responseJson<{ outline: { id: number } }>(fetch("/api/sermon-outlines", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: newTitle }) }));
      setNewTitle(""); await loadOutlines(); await openOutline(data.outline.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível criar o esboço."); }
    finally { setSaving(false); }
  };

  const persistPending = async () => {
    if (!selected || !draft) return;
    const pendingBlockIds = [...dirtyBlocks];
    const requests: Promise<unknown>[] = [];
    if (dirtyMeta) requests.push(responseJson(fetch(`/api/sermon-outlines/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) })));
    for (const id of pendingBlockIds) {
      const block = draft.blocks.find((item) => item.id === id);
      if (block) requests.push(responseJson(fetch(`/api/sermon-outlines/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "edit-block", blockId: id, ...block }) })));
    }
    if (!requests.length) return;
    await Promise.all(requests);
    setDirtyMeta(false);
    setDirtyBlocks((current) => new Set([...current].filter((id) => !pendingBlockIds.includes(id))));
  };

  const mutate = async (body: Record<string, unknown>) => {
    if (!selected) return null;
    setSaving(true);
    try {
      await persistPending();
      const data = await responseJson<{ outline?: OutlineDetail; duplicateId?: number }>(fetch(`/api/sermon-outlines/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
      if (data.outline) { setSelected(data.outline); setDraft(data.outline); setDirtyBlocks(new Set()); }
      return data;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o esboço."); return null; }
    finally { setSaving(false); }
  };

  const leaveEditor = async (closeLibrary: boolean) => {
    setSaving(true);
    try {
      await persistPending();
      if (closeLibrary) onClose();
      else { setSelected(null); setDraft(null); await loadOutlines(); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar antes de sair."); }
    finally { setSaving(false); }
  };

  const updateBlock = (id: number, changes: Partial<OutlineBlock>) => {
    setDraft((current) => current ? { ...current, blocks: current.blocks.map((block) => block.id === id ? { ...block, ...changes } : block) } : current);
    setDirtyBlocks((current) => new Set(current).add(id));
  };
  const baseReference = draft ? parseReference(draft.baseReference, source.bookNames) : null;
  const activeReference = draft?.blocks[activeBlock]?.kind === "verse" ? parseReference(draft.blocks[activeBlock].title, source.bookNames) : null;
  const plannedTopicSeconds = (draft?.blocks.slice(0, activeBlock + 1).reduce((total, block) => total + block.plannedMinutes, 0) || 0) * 60;
  const topicDelta = plannedTopicSeconds - timer.elapsedSeconds;
  const topicStatus = Math.abs(topicDelta) <= 60 ? "Dentro do planejado" : topicDelta > 60 ? "Adiantado" : "Atrasado";

  const finishSession = async () => {
    if (!selected || !draft || !timer.timer.sessionStartedAt) { setPreaching(false); return; }
    timer.pause();
    await mutate({ action: "record-session", startedAt: timer.timer.sessionStartedAt, endedAt: Date.now(), plannedSeconds: timer.plannedSeconds, actualSeconds: timer.elapsedSeconds, location: draft.location, eventName: draft.eventName, notes: draft.postNotes });
    timer.reset(); setPreaching(false);
  };

  if (preaching && draft) {
    const block = draft.blocks[activeBlock];
    return <div className={`sermon-mode ${timer.notice ? "alerting" : ""}`} style={{ "--sermon-font-scale": fontScale } as React.CSSProperties}>
      <header><div><small>{draft.baseReference || "MODO PREGAÇÃO"}</small><h1>{draft.title}</h1></div><button onClick={() => setPreaching(false)} aria-label="Sair do modo pregação">×</button></header>
      <div className={`sermon-live-timer ${timer.percent >= 90 ? "urgent" : ""}`}><span><small>RESTANTE</small><b>{formatClock(timer.remainingSeconds)}</b></span><span><small>UTILIZADO</small><b>{formatClock(timer.elapsedSeconds)}</b></span><em>{timer.percent}%</em></div>
      {timer.notice && <div className="sermon-time-alert" role="status">{timer.notice}</div>}
      <main>{block ? <article className={`sermon-live-block ${block.kind}`}><p>{blockLabels[block.kind]} · {block.plannedMinutes || 0} min</p><h2>{block.title || blockLabels[block.kind]}</h2><RichPreview value={block.body} />{activeReference && <button className="sermon-open-reference" onClick={() => onOpenReference(activeReference)}>Abrir {block.title} na Bíblia</button>}</article> : <p>Adicione tópicos ao esboço.</p>}</main>
      <div className={`sermon-topic-status ${normalize(topicStatus)}`}><span>{topicStatus}</span><b>{Math.abs(Math.round(topicDelta / 60))} min</b></div>
      <footer><button disabled={activeBlock === 0} onClick={() => setActiveBlock((current) => Math.max(0, current - 1))}>‹ Anterior</button><div><button onClick={timer.timer.running ? timer.pause : timer.start}>{timer.timer.running ? "Pausar" : timer.elapsedSeconds ? "Continuar" : "Iniciar"}</button><button onClick={() => setFontScale((current) => current >= 1.35 ? .9 : current + .15)}>A+</button></div><button disabled={activeBlock >= draft.blocks.length - 1} onClick={() => setActiveBlock((current) => Math.min(draft.blocks.length - 1, current + 1))}>Próximo ›</button></footer>
      <button className="sermon-finish" onClick={() => void finishSession()}>Finalizar pregação</button>
    </div>;
  }

  return <div className="study-library-backdrop sermon-library-backdrop"><section className="study-library sermon-library">
    <header><button className="study-back" onClick={() => selected ? void leaveEditor(false) : onBack()}>{selected ? "‹ Esboços" : "‹ Estudos"}</button><span>{saving ? "Salvando…" : dirtyMeta || dirtyBlocks.size ? "Alterações pendentes" : selected ? "Salvo automaticamente" : ""}</span><button className="study-close" onClick={() => selected ? void leaveEditor(true) : onClose()} aria-label="Fechar">×</button></header>
    {draft && selected ? <section className="sermon-editor">
      <div className="sermon-editor-heading"><div><p className="eyebrow">ASSISTENTE DE PREGAÇÃO</p><input className="sermon-title-input" value={draft.title} maxLength={100} onChange={(event) => { setDraft({ ...draft, title: event.target.value }); setDirtyMeta(true); }} /></div><button className={draft.favorite ? "favorite" : ""} onClick={() => { setDraft({ ...draft, favorite: !draft.favorite }); setDirtyMeta(true); }} aria-label="Favoritar esboço">{draft.favorite ? "♥" : "♡"}</button></div>
      <div className="sermon-meta-grid">
        <label><span>Tema</span><input value={draft.theme} maxLength={160} onChange={(event) => { setDraft({ ...draft, theme: event.target.value }); setDirtyMeta(true); }} placeholder="Ex.: Esperança em meio à tempestade" /></label>
        <label><span>Texto-base</span><div className="sermon-reference-field"><input value={draft.baseReference} maxLength={120} onChange={(event) => { setDraft({ ...draft, baseReference: event.target.value }); setDirtyMeta(true); }} placeholder="Ex.: João 3:16" />{baseReference && <button onClick={() => onOpenReference(baseReference)}>Abrir</button>}</div></label>
        <label><span>Categoria</span><input value={draft.category} maxLength={60} onChange={(event) => { setDraft({ ...draft, category: event.target.value }); setDirtyMeta(true); }} /></label>
        <label><span>Duração total</span><select value={draft.plannedMinutes} onChange={(event) => { setDraft({ ...draft, plannedMinutes: Number(event.target.value) }); setDirtyMeta(true); }}>{[20, 30, 40, 45, 60, 90].map((value) => <option key={value} value={value}>{value} minutos</option>)}</select></label>
      </div>
      <div className="sermon-editor-actions"><button className="sermon-mode-button" onClick={() => { setActiveBlock(0); setPreaching(true); }}>▶ Modo Pregação</button><button onClick={() => void mutate({ action: "checkpoint" })}>Salvar versão</button><button onClick={async () => { const data = await mutate({ action: "duplicate" }); if (data?.duplicateId) await openOutline(data.duplicateId); }}>Duplicar</button></div>
      <section className="sermon-timer-card"><div><span>TEMPO PLANEJADO</span><b>{draft.plannedMinutes} minutos</b></div><div className="sermon-alert-marks">{[50, 75, 90, 100].map((mark) => <label key={mark}><input type="checkbox" checked={draft.alertMarks.includes(mark)} onChange={() => { const marks = draft.alertMarks.includes(mark) ? draft.alertMarks.filter((item) => item !== mark) : [...draft.alertMarks, mark].sort((a, b) => a - b); setDraft({ ...draft, alertMarks: marks }); setDirtyMeta(true); }} />{mark}%</label>)}</div></section>
      <div className="sermon-blocks-heading"><div><p className="eyebrow">ROTEIRO DA PREGAÇÃO</p><h2>{draft.blocks.length} blocos · {draft.blocks.reduce((total, block) => total + block.plannedMinutes, 0)} min distribuídos</h2></div><div><select value={addKind} onChange={(event) => setAddKind(event.target.value as BlockKind)}>{addableKinds.map((kind) => <option value={kind} key={kind}>{blockLabels[kind]}</option>)}</select><button onClick={() => void mutate({ action: "add-block", kind: addKind })}>＋ Adicionar</button></div></div>
      <div className="sermon-block-list">{draft.blocks.map((block, index) => <article className={`sermon-block-card ${block.kind}`} key={block.id}>
        <div className="sermon-block-order"><button disabled={index === 0} onClick={() => void mutate({ action: "move-block", blockId: block.id, direction: "up" })}>↑</button><button disabled={index === draft.blocks.length - 1} onClick={() => void mutate({ action: "move-block", blockId: block.id, direction: "down" })}>↓</button></div>
        <div className="sermon-block-content"><div className="sermon-block-top"><select value={block.kind} onChange={(event) => updateBlock(block.id, { kind: event.target.value as BlockKind })}>{Object.entries(blockLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label><input type="number" min="0" max="120" value={block.plannedMinutes} onChange={(event) => updateBlock(block.id, { plannedMinutes: Number(event.target.value) })} /> min</label><button onClick={() => { if (window.confirm("Remover este bloco do esboço?")) void mutate({ action: "remove-block", blockId: block.id }); }}>×</button></div>{block.kind !== "divider" && <><input className="sermon-block-title" value={block.title} maxLength={120} onChange={(event) => updateBlock(block.id, { title: event.target.value })} onBlur={() => undefined} placeholder={block.kind === "verse" ? "Ex.: João 3:16" : blockLabels[block.kind]} /><SermonTextEditor value={block.body} onChange={(body) => updateBlock(block.id, { body })} onBlur={() => undefined} /><details><summary>Visualizar texto formatado</summary><RichPreview value={block.body} />{block.kind === "verse" && parseReference(block.title, source.bookNames) && <button className="sermon-open-reference" onClick={() => onOpenReference(parseReference(block.title, source.bookNames)!)}>Abrir na Bíblia</button>}</details></>}</div>
      </article>)}</div>
      <section className="sermon-history-fields"><h2>Histórico da ministração</h2><div><label><span>Data</span><input type="date" value={draft.sermonDate || ""} onChange={(event) => { setDraft({ ...draft, sermonDate: event.target.value }); setDirtyMeta(true); }} /></label><label><span>Local</span><input value={draft.location} onChange={(event) => { setDraft({ ...draft, location: event.target.value }); setDirtyMeta(true); }} /></label><label><span>Evento</span><input value={draft.eventName} onChange={(event) => { setDraft({ ...draft, eventName: event.target.value }); setDirtyMeta(true); }} /></label></div><textarea value={draft.postNotes} onChange={(event) => { setDraft({ ...draft, postNotes: event.target.value }); setDirtyMeta(true); }} placeholder="Observações após a pregação…" />{draft.sessions.length > 0 && <p>Última utilização: {new Date(draft.sessions[0].startedAt).toLocaleDateString("pt-BR")} · {formatClock(draft.sessions[0].actualSeconds)}</p>}</section>
      <button className="sermon-delete" onClick={async () => { if (!window.confirm(`Excluir o esboço “${draft.title}”?`)) return; await responseJson(fetch(`/api/sermon-outlines/${draft.id}`, { method: "DELETE" })); setSelected(null); setDraft(null); void loadOutlines(); }}>Excluir esboço</button>
      {error && <p className="study-error">{error}</p>}
    </section> : <section className="sermon-list">
      <div className="study-library-heading"><p className="eyebrow">BLOCO DE NOTAS & MINISTRAÇÃO</p><h1>Esboços de Pregação</h1><p>Prepare a mensagem, organize cada tópico e acompanhe o tempo durante a ministração.</p></div>
      <div className="study-new"><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} maxLength={100} placeholder="Título da nova pregação" /><button disabled={newTitle.trim().length < 2 || saving} onClick={() => void createOutline()}>Criar</button></div>
      <div className="sermon-list-tools"><input className="study-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título, tema, texto ou categoria" /><button className={favoritesOnly ? "active" : ""} onClick={() => setFavoritesOnly(!favoritesOnly)}>♥ Favoritos</button></div>
      {loading ? <p className="study-loading">Carregando…</p> : <div className="sermon-cards">{outlines.length ? outlines.map((outline) => <button key={outline.id} onClick={() => void openOutline(outline.id)}><i data-color={outline.color}>{outline.favorite ? "♥" : outline.icon}</i><span><b>{outline.title}</b><small>{outline.baseReference || outline.theme || "Esboço em preparação"}</small><em>{outline.category} · {outline.plannedMinutes} min · {outline.blockCount} blocos</em></span><strong>›</strong></button>) : <div className="study-empty"><span>✎</span><h2>Prepare sua próxima mensagem</h2><p>Crie um esboço com introdução, tópicos, referências, aplicações e conclusão.</p></div>}</div>}
      {error && <p className="study-error">{error}</p>}
    </section>}
  </section></div>;
}

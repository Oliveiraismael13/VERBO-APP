"use client";

import { useEffect, useRef, useState } from "react";

type Screen = "bible" | "plans" | "camera" | "studies" | "profile" | "result";
type BibleVerse = { number: number; text: string };
type BibleBook = { slug: string; name: string; longName: string; abbreviation: string; testament: "old" | "new"; chapters: BibleVerse[][] };
type ManifestBook = Omit<BibleBook, "chapters"> & { code: string; chapterCount: number; verseCount: number };
type BibleManifest = { translation: string; code: string; canon: string; bookCount: number; verseCount: number; books: ManifestBook[] };

const translations = {
  BLIVRE: {
    label: "BLIVRE",
    path: "/bible",
    note: "Bíblia Livre (BLIVRE), edição Textus Receptus · CC BY 3.0 Brasil.",
  },
  ALMEIDA1819: {
    label: "Almeida 1819",
    path: "/bible/almeida1819",
    note: "Almeida 1819 (Bíblia Livre) · domínio público · fonte: Midvash Bible Data.",
  },
} as const;

type Translation = keyof typeof translations;

const topics = [
  { icon: "♡", title: "Amor de Deus", count: "42 passagens", color: "rose" },
  { icon: "✦", title: "Salvação", count: "36 passagens", color: "gold" },
  { icon: "◉", title: "Fé", count: "58 passagens", color: "blue" },
  { icon: "⌂", title: "Vida eterna", count: "29 passagens", color: "green" },
];

export default function VerboApp() {
  const [screen, setScreen] = useState<Screen>("bible");
  const [dark, setDark] = useState(false);
  const [fontSize, setFontSize] = useState(19);
  const [translation, setTranslation] = useState<Translation>("BLIVRE");
  const [saved, setSaved] = useState(false);
  const [marked, setMarked] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [readerMenu, setReaderMenu] = useState(false);
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  const [book, setBook] = useState<BibleBook | null>(null);
  const [bookSlug, setBookSlug] = useState("joao");
  const [chapter, setChapter] = useState(3);
  const [selectedVerse, setSelectedVerse] = useState(16);
  const [bookPicker, setBookPicker] = useState(false);
  const [cameraState, setCameraState] = useState<"idle" | "live" | "scanning" | "found" | "denied">("idle");
  const [toast, setToast] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("verbo-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tema salvo só existe no navegador
    if (savedTheme === "dark") setDark(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("verbo-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${translations[translation].path}/manifest.json`, { signal: controller.signal })
      .then((response) => response.json())
      .then(setManifest)
      .catch((error) => { if (error.name !== "AbortError") setToast("Não foi possível carregar a tradução"); });
    return () => controller.abort();
  }, [translation]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${translations[translation].path}/${bookSlug}.json`, { signal: controller.signal })
      .then((response) => response.json())
      .then(setBook)
      .catch((error) => { if (error.name !== "AbortError") setToast("Não foi possível carregar o livro"); });
    return () => controller.abort();
  }, [bookSlug, translation]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  const go = (next: Screen) => {
    if (next !== "camera") streamRef.current?.getTracks().forEach((track) => track.stop());
    setScreen(next);
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraState("live");
    } catch {
      setCameraState("denied");
    }
  };

  const scan = () => {
    setCameraState("scanning");
    window.setTimeout(() => setCameraState("found"), 1400);
  };

  const openResult = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setCameraState("idle");
    go("result");
  };

  const chooseBook = (slug: string, nextChapter = 1) => {
    setBookSlug(slug);
    setChapter(nextChapter);
    setSelectedVerse(1);
    setBookPicker(false);
    setSearchOpen(false);
  };

  const moveChapter = (direction: -1 | 1) => {
    if (!book || !manifest) return;
    const target = chapter + direction;
    if (target >= 1 && target <= book.chapters.length) {
      setChapter(target);
      setSelectedVerse(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const index = manifest.books.findIndex((item) => item.slug === book.slug);
    const neighbor = manifest.books[index + direction];
    if (neighbor) chooseBook(neighbor.slug, direction === 1 ? 1 : neighbor.chapterCount);
  };

  const currentVerses = book?.chapters[chapter - 1] ?? [];
  const selected = currentVerses.find((verse) => verse.number === selectedVerse);

  return (
    <main className={`app-shell ${dark ? "dark" : ""}`}>
      {screen !== "camera" && (
        <header className="topbar">
          {screen === "result" ? (
            <button className="back-btn" onClick={() => go("bible")} aria-label="Voltar">‹</button>
          ) : (
            <button className="brand" onClick={() => go("bible")} aria-label="Início"><span>✦</span> VERBO</button>
          )}
          {screen === "result" && <span className="top-title">João 3:16</span>}
          <div className="top-actions">
            <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Buscar">⌕</button>
            <button className="avatar" onClick={() => go("profile")} aria-label="Perfil">M</button>
          </div>
        </header>
      )}

      {screen === "bible" && (
        <section className="reader page-in">
          <div className="reference-row">
            <div>
              <p className="eyebrow">{book?.testament === "old" ? "ANTIGO TESTAMENTO" : "NOVO TESTAMENTO"} · 66 LIVROS</p>
              <h1><button className="reference-button" onClick={() => setBookPicker(true)}>{book?.name ?? "Carregando"} <span>{chapter}⌄</span></button></h1>
            </div>
            <div className="reader-actions">
              <select className="translation" value={translation} onChange={(event) => setTranslation(event.target.value as Translation)} aria-label="Tradução">
                <option value="BLIVRE">BLIVRE</option><option value="ALMEIDA1819">Almeida 1819</option><option disabled>NVI · licença</option><option disabled>NAA · licença</option><option disabled>ARA · licença</option>
              </select>
              <button className="text-control" onClick={() => setReaderMenu(!readerMenu)} aria-label="Preferências de leitura">Aa</button>
            </div>
          </div>

          {readerMenu && (
            <div className="reader-menu">
              <span>Tamanho do texto</span>
              <button onClick={() => setFontSize(Math.max(16, fontSize - 1))}>A−</button>
              <b>{fontSize}</b>
              <button onClick={() => setFontSize(Math.min(24, fontSize + 1))}>A+</button>
              <button className="theme-toggle" onClick={() => setDark(!dark)}>{dark ? "☀ Claro" : "☾ Escuro"}</button>
            </div>
          )}

          <div className="chapter-nav" aria-label="Navegação entre capítulos">
            <button onClick={() => moveChapter(-1)} aria-label="Capítulo anterior">‹ <span>{chapter > 1 ? `${book?.name} ${chapter - 1}` : "Livro anterior"}</span></button>
            <p>{currentVerses.length} versículos</p>
            <button onClick={() => moveChapter(1)} aria-label="Próximo capítulo"><span>{book && chapter < book.chapters.length ? `${book.name} ${chapter + 1}` : "Próximo livro"}</span> ›</button>
          </div>

          <div className="canon-note"><b>✦ Cânon protestante</b><span>66 livros · sem deuterocanônicos</span></div>
          <div className="license-note"><span>i</span> {translations[translation].note}</div>

          <article className="scripture" style={{ "--reader-size": `${fontSize}px` } as React.CSSProperties}>
            {!book && <div className="reader-loading">Carregando as Escrituras…</div>}
            {currentVerses.map(({ number, text }) => (
              <button key={number} className={`verse ${number === selectedVerse && marked ? "highlighted" : ""}`} onClick={() => { setSelectedVerse(number); setMarked(true); }}>
                <sup>{number}</sup>{text}
              </button>
            ))}
          </article>

          {selected && <div className="verse-tools">
            <p><b>{book?.name} {chapter}:{selectedVerse}</b><span>selecionado</span></p>
            <div>
              <button onClick={() => setMarked(!marked)} aria-label="Destacar">◒</button>
              <button onClick={() => { setSaved(!saved); notify(saved ? "Removido dos favoritos" : "Versículo salvo"); }} className={saved ? "active" : ""} aria-label="Favoritar">{saved ? "♥" : "♡"}</button>
              <button onClick={() => notify("Anotação pronta para editar")} aria-label="Criar anotação">▱</button>
              <button onClick={() => navigator.clipboard?.writeText(`${book?.name} ${chapter}:${selectedVerse} — ${selected.text}`).then(() => notify("Versículo copiado"))} aria-label="Copiar">⧉</button>
              <button onClick={() => openResult()} aria-label="Estudar">↗</button>
            </div>
          </div>}
        </section>
      )}

      {screen === "camera" && (
        <section className="camera-screen page-in">
          <div className="camera-head">
            <button onClick={() => go("bible")} aria-label="Fechar">×</button>
            <div><b>Identificar versículo</b><span>OCR · visão bíblica</span></div>
            <button onClick={() => notify("Ajuda: enquadre de 1 a 4 linhas")}>?</button>
          </div>
          <div className="viewfinder">
            {cameraState === "live" && <video ref={videoRef} autoPlay muted playsInline />}
            {(cameraState === "idle" || cameraState === "denied") && (
              <div className="camera-empty"><span>⌁</span><b>{cameraState === "denied" ? "Câmera não autorizada" : "Encontre a referência em segundos"}</b><p>{cameraState === "denied" ? "Você ainda pode enviar uma foto ou usar a demonstração." : "Aponte para um trecho bíblico impresso ou em outra tela."}</p><button onClick={openCamera}>Ativar câmera</button></div>
            )}
            {cameraState === "scanning" && <div className="scanning"><i /><b>Lendo o texto...</b><span>Comparando com a base bíblica</span></div>}
            {cameraState === "found" && (
              <div className="found-card">
                <span className="check">✓</span><p>ENCONTRAMOS ESTE VERSÍCULO</p><h2>João 3:16</h2><blockquote>“Porque Deus amou o mundo de tal maneira...”</blockquote><div className="confidence"><span>Correspondência</span><b>98%</b></div><button onClick={openResult}>Abrir versículo</button><button className="secondary" onClick={openResult}>Estudar agora</button><small>Outra possibilidade: <u>1 João 4:9</u></small>
              </div>
            )}
            <div className="focus-corners"><i /><i /><i /><i /></div>
            {cameraState === "live" && <div className="scan-hint">Enquadre apenas o trecho principal</div>}
          </div>
          <div className="camera-controls">
            <label className="upload">▧<input type="file" accept="image/*" onChange={scan} /><span>Galeria</span></label>
            <button className="shutter" onClick={scan} disabled={cameraState === "scanning" || cameraState === "found"}><i /></button>
            <button className="demo" onClick={scan}>✦<span>Demo</span></button>
          </div>
          <p className="prototype-note">Protótipo: a captura é real; o reconhecimento exibido usa um resultado demonstrativo.</p>
        </section>
      )}

      {screen === "result" && <StudyResult translation={translation} setTranslation={setTranslation} saved={saved} setSaved={setSaved} notify={notify} />}
      {screen === "studies" && <StudiesPage onOpen={() => go("result")} />}
      {screen === "plans" && <PlansPage />}
      {screen === "profile" && <ProfilePage dark={dark} setDark={setDark} />}

      {screen !== "camera" && (
        <nav className="bottom-nav" aria-label="Navegação principal">
          <button className={screen === "bible" ? "selected" : ""} onClick={() => go("bible")}><span>▥</span>Bíblia</button>
          <button className={screen === "plans" ? "selected" : ""} onClick={() => go("plans")}><span>◴</span>Planos</button>
          <button className="camera" onClick={() => go("camera")}><i>⌁</i><span>Câmera</span></button>
          <button className={screen === "studies" || screen === "result" ? "selected" : ""} onClick={() => go("studies")}><span>✧</span>Estudos</button>
          <button className={screen === "profile" ? "selected" : ""} onClick={() => go("profile")}><span>◎</span>Perfil</button>
        </nav>
      )}

      {bookPicker && manifest && <BookPicker manifest={manifest} currentSlug={bookSlug} close={() => setBookPicker(false)} choose={chooseBook} />}
      {searchOpen && <SearchOverlay manifest={manifest} close={() => setSearchOpen(false)} choose={chooseBook} open={() => { setSearchOpen(false); go("result"); }} />}
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}

function StudyResult({ translation, setTranslation, saved, setSaved, notify }: { translation: Translation; setTranslation: (value: Translation) => void; saved: boolean; setSaved: (value: boolean) => void; notify: (value: string) => void }) {
  const [tab, setTab] = useState("resumo");
  const [comparison, setComparison] = useState<Record<Translation, string> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all((Object.keys(translations) as Translation[]).map(async (code) => {
      const response = await fetch(`${translations[code].path}/joao.json`, { signal: controller.signal });
      const john: BibleBook = await response.json();
      return [code, john.chapters[2][15].text] as const;
    })).then((entries) => setComparison(Object.fromEntries(entries) as Record<Translation, string>)).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const verseText = comparison?.[translation] ?? "Carregando o texto bíblico…";
  return (
    <section className="study-page page-in">
      <div className="study-hero">
        <p className="eyebrow light">VERSÍCULO IDENTIFICADO</p>
        <div className="study-ref"><h1>João 3:16</h1><select value={translation} onChange={(e) => setTranslation(e.target.value as Translation)}><option value="BLIVRE">BLIVRE</option><option value="ALMEIDA1819">Almeida 1819</option><option disabled>NAA · licença</option><option disabled>NVI · licença</option></select></div>
        <blockquote>“{verseText}”</blockquote>
        <div className="study-actions"><button onClick={() => { setSaved(!saved); notify(saved ? "Removido dos favoritos" : "Versículo salvo"); }}>{saved ? "♥ Salvo" : "♡ Salvar"}</button><button onClick={() => notify("Versículo copiado")}>⧉ Copiar</button><button onClick={() => notify("Menu de compartilhamento")}>↗ Compartilhar</button></div>
      </div>
      <div className="study-tabs"><button className={tab === "resumo" ? "active" : ""} onClick={() => setTab("resumo")}>Resumo</button><button className={tab === "comparar" ? "active" : ""} onClick={() => setTab("comparar")}>Comparar</button><button className={tab === "contexto" ? "active" : ""} onClick={() => setTab("contexto")}>Contexto</button></div>
      <div className="study-content">
        {tab === "resumo" && <>
          <section><div className="section-title"><div><span className="mini-icon">◈</span><h3>Compreenda o versículo</h3></div><button>Ver tudo</button></div><div className="insight-card"><p>LEITURA REFORMADA · SOLA SCRIPTURA</p><h4>A graça que vem primeiro</h4><span>No diálogo com Nicodemos, a salvação nasce da iniciativa soberana de Deus. O Filho é dado por amor, e a vida eterna é recebida pela fé — não conquistada por mérito humano.</span><button>Ler estudo completo <b>→</b></button></div></section>
          <section><div className="section-title"><div><span className="mini-icon">✦</span><h3>Temas relacionados</h3></div></div><div className="topic-row">{topics.map((topic) => <button key={topic.title} className={topic.color}><i>{topic.icon}</i><span>{topic.title}</span></button>)}</div></section>
          <section><div className="section-title"><div><span className="mini-icon">▷</span><h3>Pregações</h3></div><button>Ver mais</button></div><div className="media-card"><div className="media-thumb sermon"><span>28:14</span><i>▶</i></div><div><small>CONTEÚDO EXTERNO</small><b>O amor que alcança o mundo</b><p>Canal parceiro · YouTube</p></div></div></section>
          <section><div className="section-title"><div><span className="mini-icon">◉</span><h3>Podcasts</h3></div><button>Ver mais</button></div><div className="podcast-card"><div className="podcast-art">V</div><div><small>EPISÓDIO 24 · 32 MIN</small><b>Amados antes de tudo</b><p>Verbo — conversas sobre a fé</p></div><button>▶</button></div></section>
        </>}
        {tab === "comparar" && <div className="compare-list"><p className="license-note"><span>i</span> Duas edições abertas disponíveis para comparação.</p>{(Object.keys(translations) as Translation[]).map((code) => <article key={code}><b>{translations[code].label}<small>{code === "BLIVRE" ? "CC BY 3.0 BR" : "DOMÍNIO PÚBLICO"}</small></b><p>{comparison?.[code] ?? "Carregando…"}</p></article>)}</div>}
        {tab === "contexto" && <div className="context-list"><article><span>15</span><p>Para que todo o que nele crê tenha a vida eterna.</p></article><article className="current"><span>16</span><p>Porque Deus amou o mundo de tal maneira...</p></article><article><span>17</span><p>Pois Deus enviou o seu Filho ao mundo, não para que julgasse o mundo...</p></article><button>Abrir capítulo completo →</button></div>}
      </div>
    </section>
  );
}

function StudiesPage({ onOpen }: { onOpen: () => void }) {
  return <section className="generic-page page-in"><p className="eyebrow">EXPLORE A PALAVRA</p><h1>Estudos</h1><p className="lead">Aprofunde a leitura por temas, livros e perguntas essenciais.</p><div className="featured-study" onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(); }} role="button" tabIndex={0}><span>ESTUDO EM DESTAQUE</span><h2>O amor que transforma</h2><p>De João 3 ao coração do Evangelho</p><button>Começar estudo →</button></div><h3 className="list-heading">Temas populares</h3><div className="topic-grid">{topics.map((topic) => <button key={topic.title} onClick={onOpen} className={topic.color}><i>{topic.icon}</i><div><b>{topic.title}</b><span>{topic.count}</span></div><em>›</em></button>)}</div></section>;
}

function PlansPage() {
  return <section className="generic-page page-in"><p className="eyebrow">CRESÇA UM DIA DE CADA VEZ</p><h1>Planos</h1><p className="lead">Leituras breves para criar constância e aprofundar sua fé.</p><div className="progress-card"><span>PLANO ATUAL</span><h2>João em 21 dias</h2><p>Dia 4 de 21 · João 3</p><div><i style={{ width: "19%" }} /></div><button>Continuar leitura →</button></div><h3 className="list-heading">Para começar</h3><div className="plan-list"><article><i>7</i><div><b>Uma semana com os Salmos</b><span>7 dias · 8 min/dia</span></div><button>＋</button></article><article><i>14</i><div><b>Aprendendo a confiar</b><span>14 dias · 10 min/dia</span></div><button>＋</button></article></div></section>;
}

function ProfilePage({ dark, setDark }: { dark: boolean; setDark: (value: boolean) => void }) {
  return <section className="generic-page page-in"><div className="profile-card"><div className="profile-avatar">M</div><h2>Minha jornada</h2><p>Seu espaço de leitura e estudo</p><div><span><b>12</b>dias lendo</span><span><b>8</b>favoritos</span><span><b>3</b>anotações</span></div></div><h3 className="list-heading">Biblioteca</h3><div className="settings-list"><button><i>♡</i><span>Versículos favoritos<small>8 salvos</small></span><b>›</b></button><button><i>▱</i><span>Minhas anotações<small>3 anotações</small></span><b>›</b></button><button><i>◴</i><span>Histórico de leitura<small>Últimos 30 dias</small></span><b>›</b></button></div><h3 className="list-heading">Preferências</h3><div className="settings-list"><button onClick={() => setDark(!dark)}><i>{dark ? "☾" : "☀"}</i><span>Aparência<small>{dark ? "Modo escuro" : "Modo claro"}</small></span><em className={`switch ${dark ? "on" : ""}`}><u /></em></button><button><i>⇩</i><span>Conteúdo bíblico<small>2 traduções · 66 livros cada</small></span><b>›</b></button><button><i>©</i><span>Créditos das traduções<small>Domínio público + CC BY</small></span><b>›</b></button></div></section>;
}

function BookPicker({ manifest, currentSlug, close, choose }: { manifest: BibleManifest; currentSlug: string; close: () => void; choose: (slug: string) => void }) {
  const [testament, setTestament] = useState<"old" | "new">("old");
  const books = manifest.books.filter((book) => book.testament === testament);
  return <div className="book-picker page-in"><div className="picker-head"><button onClick={close}>×</button><div><p>ESCOLHA UM LIVRO</p><h2>Bíblia Sagrada</h2></div><span>66</span></div><div className="canon-banner"><b>Cânon protestante reformado</b><span>39 livros no Antigo Testamento · 27 no Novo</span></div><div className="testament-tabs"><button className={testament === "old" ? "active" : ""} onClick={() => setTestament("old")}>Antigo Testamento <small>39</small></button><button className={testament === "new" ? "active" : ""} onClick={() => setTestament("new")}>Novo Testamento <small>27</small></button></div><div className="book-grid">{books.map((book) => <button key={book.slug} className={currentSlug === book.slug ? "current" : ""} onClick={() => choose(book.slug)}><i>{book.abbreviation}</i><span><b>{book.name}</b><small>{book.chapterCount} {book.chapterCount === 1 ? "capítulo" : "capítulos"}</small></span><em>›</em></button>)}</div><footer><b>{manifest.code}</b><span>{manifest.translation}</span></footer></div>;
}

function SearchOverlay({ manifest, close, choose, open }: { manifest: BibleManifest | null; close: () => void; choose: (slug: string, chapter?: number) => void; open: () => void }) {
  const [query, setQuery] = useState("");
  const normalized = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const reference = normalized.match(/^(.+?)\s+(\d+)(?::(\d+))?$/);
  const bookMatches = (manifest?.books ?? []).filter((book) => {
    const name = book.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return normalized.length > 1 && (name.includes(normalized) || normalized.includes(name));
  }).slice(0, 6);
  const referencedBook = reference ? (manifest?.books ?? []).find((book) => {
    const name = book.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return name === reference[1] || book.abbreviation.toLowerCase() === reference[1];
  }) : null;
  return <div className="search-overlay page-in"><div className="search-box"><button onClick={close}>‹</button><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busque um livro ou referência" /><span>⌕</span></div><p className="eyebrow">{query ? "RESULTADOS NA TRADUÇÃO SELECIONADA" : "BUSCAS RECENTES"}</p>{query ? <div className="search-results">{referencedBook && reference && Number(reference[2]) <= referencedBook.chapterCount && <button onClick={() => choose(referencedBook.slug, Number(reference[2]))}><small>REFERÊNCIA</small><b>{referencedBook.name} {reference[2]}{reference[3] ? `:${reference[3]}` : ""}</b><p>Abrir na tradução selecionada</p><span>›</span></button>}{bookMatches.map((book) => <button key={book.slug} onClick={() => choose(book.slug)}><small>{book.testament === "old" ? "ANTIGO TESTAMENTO" : "NOVO TESTAMENTO"}</small><b>{book.name}</b><p>{book.chapterCount} capítulos · {book.verseCount} versículos</p><span>›</span></button>)}{normalized.includes("amor") && <button onClick={open}><small>ESTUDO REFORMADO</small><b>O amor soberano de Deus</b><p>Graça, eleição e redenção em Cristo</p><span>›</span></button>}{!referencedBook && bookMatches.length === 0 && !normalized.includes("amor") && <div className="empty-search"><b>Nenhum livro encontrado</b><p>Tente uma referência como “Romanos 8” ou “Salmo 23”. A busca por frases em todos os {manifest?.verseCount.toLocaleString("pt-BR")} versículos será a próxima etapa.</p></div>}</div> : <div className="recent-searches"><button onClick={() => setQuery("João 3:16")}>◴ <span>João 3:16</span> ×</button><button onClick={() => setQuery("Romanos 8")}>◴ <span>Romanos 8</span> ×</button><div className="search-tip"><b>Agora são 66 livros</b><p>Todo o cânon protestante está disponível, de Gênesis a Apocalipse, sem livros deuterocanônicos.</p></div></div>}</div>;
}

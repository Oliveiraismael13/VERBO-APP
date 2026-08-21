"use client";

import { useEffect, useRef, useState } from "react";
import { discipleTitle, getXpProgress } from "../lib/xp";
import { campaignActs, missionForChapter, narrativeForMission } from "../lib/campaign";

type Screen = "journey" | "bible" | "plans" | "camera" | "studies" | "profile" | "result";
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
type PlayerProgress = { xp: number; level: number; coins: number; streak: number; completed: string[]; achievements: string[]; displayName?: string; profilePhoto?: string; favorites?: string[]; highlights?: Record<string, string>; notes?: Record<string, string>; plans?: string[] };
type ChapterReward = { xp: number; coins: number; levelUp: boolean; unlocked: string[]; missionCompleted?: boolean; missionTitle?: string; actCompleted?: boolean; actTitle?: string };

const emptyProgress: PlayerProgress = { xp: 0, level: 1, coins: 0, streak: 0, completed: [], achievements: [] };

const topics = [
  { icon: "♡", title: "Amor de Deus", count: "42 passagens", color: "rose" },
  { icon: "✦", title: "Salvação", count: "36 passagens", color: "gold" },
  { icon: "◉", title: "Fé", count: "58 passagens", color: "blue" },
  { icon: "⌂", title: "Vida eterna", count: "29 passagens", color: "green" },
];

export default function VerboApp() {
  const [screen, setScreen] = useState<Screen>("journey");
  const [dark, setDark] = useState(false);
  const [fontSize, setFontSize] = useState(19);
  const [translation, setTranslation] = useState<Translation>("BLIVRE");
  const [saved, setSaved] = useState(false);
  const [marked, setMarked] = useState(false);
  const [highlightColor, setHighlightColor] = useState("yellow");
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);
  const [verseSelected, setVerseSelected] = useState(false);
  const [missionMode, setMissionMode] = useState(false);
  const [missionBriefingOpen, setMissionBriefingOpen] = useState(false);
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
  const [progress, setProgress] = useState<PlayerProgress>(emptyProgress);
  const [reward, setReward] = useState<ChapterReward | null>(null);
  const [savingChapter, setSavingChapter] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
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

  const verseKey = `${bookSlug}:${chapter}:${selectedVerse}`;
  useEffect(() => {
    const storedFavorites = (progress.favorites || JSON.parse(localStorage.getItem("verbo-mobile-favorites") || "[]")) as string[];
    const storedHighlights = (progress.highlights || JSON.parse(localStorage.getItem("verbo-mobile-highlights") || "{}")) as Record<string, string>;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- favoritos e destaques vêm do armazenamento do navegador
    setSaved(storedFavorites.includes(verseKey));
    setMarked(Boolean(storedHighlights[verseKey]));
    setHighlightColor(storedHighlights[verseKey] || "yellow");
  }, [verseKey, progress.favorites, progress.highlights]);

  useEffect(() => {
    Promise.all([fetch("/api/progress"), fetch("/api/profile"), fetch("/api/library")]).then(async ([progressResponse, profileResponse, libraryResponse]) => {
      const data = await progressResponse.json();
      const profile = profileResponse.ok ? await profileResponse.json() : {};
      const library = libraryResponse.ok ? await libraryResponse.json() : {};
      if (!data.error) setProgress({ ...data, ...profile, ...library });
    }).catch(() => undefined);
  }, []);

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

  const saveRemoteLibrary = async (next: Partial<Pick<PlayerProgress, "favorites" | "highlights" | "notes" | "plans">>) => {
    await fetch("/api/library", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ favorites: progress.favorites || [], highlights: progress.highlights || {}, notes: progress.notes || {}, plans: progress.plans || [], ...next }) }).catch(() => undefined);
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

  const completeChapter = async () => {
    if (!missionMode) {
      notify("Entre na missão para registrar este capítulo");
      return;
    }
    if (progress.completed.includes(`${bookSlug}:${chapter}`) || savingChapter) return;
    setSavingChapter(true);
    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookSlug, chapter }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const { reward: earned, ...nextProgress } = data;
      setProgress(nextProgress);
      if (earned) {
        setReward(earned);
        advanceToNextChapter(nextProgress);
      }
    } catch {
      notify("Não foi possível salvar o progresso");
    } finally {
      setSavingChapter(false);
    }
  };

  const selectVerse = (number: number) => {
    setSelectedVerse(number);
    setVerseSelected(true);
    setHighlightPickerOpen(true);
  };

  const toggleFavorite = () => {
    const favorites = JSON.parse(localStorage.getItem("verbo-mobile-favorites") || "[]") as string[];
    const nextFavorites = favorites.includes(verseKey) ? favorites.filter((item) => item !== verseKey) : [...favorites, verseKey];
    localStorage.setItem("verbo-mobile-favorites", JSON.stringify(nextFavorites));
    setSaved(nextFavorites.includes(verseKey));
    setProgress((current) => ({ ...current, favorites: nextFavorites }));
    void saveRemoteLibrary({ favorites: nextFavorites });
    notify(nextFavorites.includes(verseKey) ? "Versículo salvo" : "Removido dos favoritos");
  };

  const chooseHighlight = (color: string) => {
    const highlights = JSON.parse(localStorage.getItem("verbo-mobile-highlights") || "{}") as Record<string, string>;
    highlights[verseKey] = color;
    localStorage.setItem("verbo-mobile-highlights", JSON.stringify(highlights));
    setHighlightColor(color);
    setMarked(true);
    setProgress((current) => ({ ...current, highlights }));
    void saveRemoteLibrary({ highlights });
    setHighlightPickerOpen(false);
  };

  const clearHighlight = () => {
    const highlights = JSON.parse(localStorage.getItem("verbo-mobile-highlights") || "{}") as Record<string, string>;
    delete highlights[verseKey];
    localStorage.setItem("verbo-mobile-highlights", JSON.stringify(highlights));
    setMarked(false);
    setProgress((current) => ({ ...current, highlights }));
    void saveRemoteLibrary({ highlights });
    setHighlightPickerOpen(false);
  };

  const handleSwipe = (direction: -1 | 1) => {
    const chapterKey = `${bookSlug}:${chapter}`;
    if (missionMode && !progress.completed.includes(chapterKey)) {
      const shouldComplete = window.confirm(`Deseja marcar ${book?.name || "este capítulo"} ${chapter} como concluído?`);
      if (shouldComplete) {
        void completeChapter();
        return;
      }
    }
    moveChapter(direction);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    event.preventDefault();
    handleSwipe(deltaX < 0 ? 1 : -1);
  };

  const chooseBook = (slug: string, nextChapter = 1) => {
    if (missionMode && !isMainChapterUnlocked(manifest, progress, slug, nextChapter)) {
      notify("Este capítulo será liberado conforme você avança na missão");
      return;
    }
    setBookSlug(slug);
    setChapter(nextChapter);
    setSelectedVerse(1);
    setBookPicker(false);
    setSearchOpen(false);
  };

  const openFavorite = (reference: string) => {
    const [slug, savedChapter, savedVerse] = reference.split(":");
    const nextChapter = Number(savedChapter);
    const nextVerse = Number(savedVerse);
    if (!slug || !Number.isInteger(nextChapter) || !Number.isInteger(nextVerse)) return;
    setMissionMode(false);
    setBookSlug(slug);
    setChapter(nextChapter);
    setSelectedVerse(nextVerse);
    setVerseSelected(true);
    go("bible");
  };

  const openMissionBriefing = () => {
    if (nextMainMission(manifest, progress)) setMissionBriefingOpen(true);
  };

  const beginMission = () => {
    const mission = nextMainMission(manifest, progress);
    if (!mission) return;
    chooseBook(mission.slug, mission.chapter);
    setMissionMode(true);
    setMissionBriefingOpen(false);
    go("bible");
  };

  const moveChapter = (direction: -1 | 1) => {
    if (!book || !manifest) return;
    const target = chapter + direction;
    if (target >= 1 && target <= book.chapters.length) {
      if (missionMode && direction > 0 && !isMainChapterUnlocked(manifest, progress, bookSlug, target)) {
        notify("Conclua este capítulo para liberar o próximo");
        return;
      }
      setChapter(target);
      setSelectedVerse(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const index = manifest.books.findIndex((item) => item.slug === book.slug);
    const neighbor = manifest.books[index + direction];
    if (neighbor) chooseBook(neighbor.slug, direction === 1 ? 1 : neighbor.chapterCount);
  };

  const advanceToNextChapter = (updatedProgress: PlayerProgress) => {
    if (!book || !manifest) return;
    const target = chapter + 1;
    if (target <= book.chapters.length) {
      if (missionMode && !isMainChapterUnlocked(manifest, updatedProgress, bookSlug, target)) return;
      setChapter(target);
      setSelectedVerse(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const index = manifest.books.findIndex((item) => item.slug === book.slug);
    const nextBook = manifest.books[index + 1];
    if (!nextBook || (missionMode && !isMainChapterUnlocked(manifest, updatedProgress, nextBook.slug, 1))) return;
    setBookSlug(nextBook.slug);
    setChapter(1);
    setSelectedVerse(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const currentVerses = book?.chapters[chapter - 1] ?? [];
  const selected = currentVerses.find((verse) => verse.number === selectedVerse);

  return (
    <main className={`app-shell rpg-shell ${dark ? "dark" : ""} ${missionMode ? "mission-active" : ""}`}>
      {screen !== "camera" && (
        <header className="topbar">
          {screen === "result" ? (
            <button className="back-btn" onClick={() => go("bible")} aria-label="Voltar">‹</button>
          ) : (
            <button className="brand" onClick={() => go("journey")} aria-label="Início"><span>✦</span> VERBO</button>
          )}
          {screen === "result" && <span className="top-title">João 3:16</span>}
          <div className="top-actions">
            <button className="hud-search" onClick={() => setSearchOpen(true)} aria-label="Buscar na Bíblia">⌕</button>
            <div className="hud-resource"><span>◆</span>{progress.coins}</div>
            <button className="avatar level-avatar" onClick={() => go("profile")} aria-label={`Perfil, nível ${progress.level}`}><b>{progress.level}</b></button>
          </div>
        </header>
      )}

      {screen === "journey" && <JourneyPage manifest={manifest} progress={progress} onContinue={openMissionBriefing} onOpenBible={() => { setMissionMode(false); go("bible"); }} />}

      {screen === "bible" && (
        <section className="reader page-in" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onClick={(event) => { if (!(event.target as HTMLElement).closest("[data-verse], .verse-tools")) { setVerseSelected(false); setHighlightPickerOpen(false); } }}>
          {missionMode && <div className="mission-mode-banner"><div className="mission-disciple" aria-label="Seu Discípulo caminhando"><PixelDisciple /><small>DISCÍPULO</small></div><div className="mission-reference"><b>JORNADA PRINCIPAL ATIVA</b><strong>{book?.name ?? "Carregando"} {chapter}</strong><small>Conclua este capítulo para liberar o próximo.</small></div><button onClick={() => { setMissionMode(false); notify("Você voltou à Bíblia livre"); }}>Sair da missão</button></div>}
          {missionMode && <MissionStoryPanel context={missionForChapter(bookSlug, chapter)} progress={progress} />}
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
            {currentVerses.map(({ number, text }) => {
              const savedHighlight = progress.highlights?.[`${bookSlug}:${chapter}:${number}`];
              return <button key={number} data-verse={number} className={`verse ${number === selectedVerse && verseSelected ? "selected" : ""} ${savedHighlight ? `marked marked-${savedHighlight}` : ""}`} onClick={() => selectVerse(number)}>
                <sup>{number}</sup>{text}
              </button>;
            })}
          </article>

          {missionMode && <button className={`chapter-complete ${progress.completed.includes(`${bookSlug}:${chapter}`) ? "done" : ""}`} onClick={completeChapter} disabled={savingChapter || progress.completed.includes(`${bookSlug}:${chapter}`)}>
            <span>{progress.completed.includes(`${bookSlug}:${chapter}`) ? "✓" : "⚔"}</span>
            <div><b>{progress.completed.includes(`${bookSlug}:${chapter}`) ? "Capítulo concluído" : "Marcar capítulo como lido"}</b><small>{progress.completed.includes(`${bookSlug}:${chapter}`) ? "Recompensa conquistada" : "+40 XP · +4 moedas"}</small></div>
            <em>{savingChapter ? "…" : "›"}</em>
          </button>}

          {selected && verseSelected && <div className="verse-tools">
            <p><b>{book?.name} {chapter}:{selectedVerse}</b><span>selecionado</span></p>
            <div>
              <button onClick={() => setHighlightPickerOpen(!highlightPickerOpen)} className={marked ? "active" : ""} aria-label="Escolher cor da marcação">◒</button>
              <button onClick={toggleFavorite} className={saved ? "active" : ""} aria-label="Favoritar">{saved ? "♥" : "♡"}</button>
              <button onClick={() => notify("Anotação pronta para editar")} aria-label="Criar anotação">▱</button>
              <button onClick={() => navigator.clipboard?.writeText(`${book?.name} ${chapter}:${selectedVerse} — ${selected.text}`).then(() => notify("Versículo copiado"))} aria-label="Copiar">⧉</button>
              <button onClick={() => openResult()} aria-label="Estudar">↗</button>
            </div>
            {highlightPickerOpen && <div className="mobile-highlight-colors" aria-label="Cores da marcação">
              {[["yellow", "Amarelo"], ["green", "Verde"], ["blue", "Azul"], ["rose", "Rosa"]].map(([color, label]) => <button key={color} className={`mobile-color ${color} ${highlightColor === color && marked ? "active" : ""}`} onClick={() => chooseHighlight(color)} aria-label={`Marcar em ${label.toLowerCase()}`} />)}
              <button className="mobile-clear-highlight" onClick={clearHighlight}>Limpar</button>
            </div>}
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
      {screen === "studies" && <StudiesPage manifest={manifest} progress={progress} onStart={openMissionBriefing} />}
      {screen === "plans" && <PlansPage />}
      {screen === "profile" && <><ProfilePage dark={dark} setDark={setDark} progress={progress} manifest={manifest} onOpenFavorite={openFavorite} /><button type="button" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }} style={{ display: "block", width: "calc(100% - 44px)", margin: "-4px auto 24px", padding: "12px", border: "1px solid #d9c8c8", borderRadius: "10px", background: "transparent", color: "#9b5555", fontSize: "11px", fontWeight: 800 }}>Sair da conta</button></>}

      {screen !== "camera" && (
        <nav className="bottom-nav" aria-label="Navegação principal">
          <button className={screen === "journey" ? "selected" : ""} onClick={() => go("journey")}><span>♜</span>Jornada</button>
          <button className={screen === "bible" ? "selected" : ""} onClick={() => { setMissionMode(false); go("bible"); }}><span>▥</span>Bíblia</button>
          <button className="camera" onClick={() => go("camera")}><i>⌁</i><span>Câmera</span></button>
          <button className={screen === "studies" || screen === "result" ? "selected" : ""} onClick={() => go("studies")}><span>✧</span>Missões</button>
          <button className={screen === "profile" ? "selected" : ""} onClick={() => go("profile")}><span>◎</span>Perfil</button>
        </nav>
      )}

      {bookPicker && manifest && <BookPicker manifest={manifest} currentSlug={bookSlug} close={() => setBookPicker(false)} choose={chooseBook} />}
      {searchOpen && <SearchOverlay manifest={manifest} close={() => setSearchOpen(false)} choose={chooseBook} open={() => { setSearchOpen(false); go("result"); }} />}
      {missionBriefingOpen && <MissionBriefing manifest={manifest} progress={progress} start={beginMission} close={() => setMissionBriefingOpen(false)} />}
      {toast && <div className="toast">✓ {toast}</div>}
      {reward && <RewardModal reward={reward} level={progress.level} close={() => setReward(null)} />}
    </main>
  );
}

function nextMainMission(manifest: BibleManifest | null, progress: PlayerProgress) {
  if (!manifest) return null;
  const completed = new Set(progress.completed);
  for (const book of manifest.books) {
    for (let chapter = 1; chapter <= book.chapterCount; chapter += 1) {
      if (!completed.has(`${book.slug}:${chapter}`)) return { slug: book.slug, chapter, name: book.name };
    }
  }
  return null;
}

function isMainChapterUnlocked(manifest: BibleManifest | null, progress: PlayerProgress, slug: string, chapter: number) {
  if (!manifest) return false;
  const completed = new Set(progress.completed);
  for (const item of manifest.books) {
    for (let currentChapter = 1; currentChapter <= item.chapterCount; currentChapter += 1) {
      if (item.slug === slug && currentChapter === chapter) return true;
      if (!completed.has(`${item.slug}:${currentChapter}`)) return false;
    }
  }
  return false;
}

function isActComplete(act: (typeof campaignActs)[number], completed: string[]) {
  const completedSet = new Set(completed);
  return act.ranges.every((item) => {
    for (let chapter = item.from; chapter <= item.to; chapter += 1) {
      if (!completedSet.has(`${item.slug}:${chapter}`)) return false;
    }
    return true;
  });
}

function JourneyPage({ manifest, progress, onContinue, onOpenBible }: { manifest: BibleManifest | null; progress: PlayerProgress; onContinue: () => void; onOpenBible: () => void }) {
  const completedCount = progress.completed.length;
  const xpProgress = getXpProgress(progress.xp);
  const mission = nextMainMission(manifest, progress);
  const milestones = campaignActs.map((act, index) => {
    const complete = isActComplete(act, progress.completed);
    const previousComplete = index === 0 || isActComplete(campaignActs[index - 1], progress.completed);
    return { name: `Ato ${act.number}`, icon: index === campaignActs.length - 1 ? "★" : "✦", state: complete ? "complete" : previousComplete ? "current" : "locked", detail: act.title };
  });
  return <section className="journey-page page-in">
    <div className="player-hud">
      <div className="crest"><span>V</span><i>{progress.level}</i></div>
      <div className="player-level"><p>{discipleTitle(xpProgress.level).toUpperCase()} · NÍVEL {xpProgress.level}</p><h1>Sua jornada na Palavra</h1><div className="xp-track"><i style={{ width: `${xpProgress.progress}%` }} /></div><small>{xpProgress.isMaxLevel ? "NÍVEL MÁXIMO · 50" : `${xpProgress.current - xpProgress.currentLevelXp} / ${xpProgress.needed} XP para o próximo nível`}</small></div>
      <div className="streak"><b>🔥 {progress.streak}</b><span>dias</span></div>
    </div>

    <article className="active-quest">
      <div className="quest-glow" />
      <p><span>MISSÃO ATUAL</span><b>+40 XP</b></p>
      <h2>A Grande História</h2>
      <blockquote>{mission ? `Continue pela Palavra em ${mission.name} ${mission.chapter}.` : "Você concluiu a missão principal."}</blockquote>
      <div><span>{mission ? `${mission.name} ${mission.chapter} · próximo capítulo` : "Missão concluída"}</span><button onClick={onContinue} disabled={!mission}>{mission ? "Continuar missão" : "Jornada concluída"} →</button></div>
    </article>

    <div className="quest-heading"><div><p>TRILHA PRINCIPAL</p><h2>A Grande História</h2></div><span>{completedCount}/1.189</span></div>
    <div className="quest-map">
      <i className="map-line" />
      {milestones.map((item, index) => <button key={item.name} className={`map-node ${item.state} ${index % 2 ? "right" : "left"}`} onClick={item.state === "locked" ? undefined : onOpenBible} disabled={item.state === "locked"}>
        <span>{item.state === "complete" ? "✓" : item.state === "locked" ? "◇" : item.icon}</span><div><small>{item.state === "complete" ? "REGIÃO CONCLUÍDA" : item.state === "current" ? "PRÓXIMA MISSÃO" : "BLOQUEADO"}</small><b>{item.name}</b><p>{item.detail}</p></div>
      </button>)}
    </div>

    <div className="daily-title"><div><p>MISSÕES DIÁRIAS</p><h2>Fortaleça sua constância</h2></div><span>◴ 24h</span></div>
    <div className="daily-quests">
      <article className={completedCount ? "complete" : ""}><i>▥</i><div><b>Leia um capítulo</b><span>{completedCount ? "1/1 concluído" : "0/1 capítulo"}<u><em style={{ width: completedCount ? "100%" : "0%" }} /></u></span></div><strong>+20 XP</strong></article>
      <article><i>🔥</i><div><b>Mantenha a chama</b><span>{progress.streak}/7 dias<u><em style={{ width: `${Math.min(progress.streak / 7 * 100, 100)}%` }} /></u></span></div><strong>◆ 50</strong></article>
      <article><i>✎</i><div><b>Medite na Palavra</b><span>Crie uma anotação<u><em style={{ width: "0%" }} /></u></span></div><strong>+15 XP</strong></article>
    </div>
  </section>;
}

function actProgress(act: (typeof campaignActs)[number], completed: string[]) {
  const completedSet = new Set(completed);
  const total = act.ranges.reduce((sum, range) => sum + range.to - range.from + 1, 0);
  const done = act.ranges.reduce((sum, range) => sum + Array.from({ length: range.to - range.from + 1 }, (_, index) => completedSet.has(`${range.slug}:${range.from + index}`) ? 1 : 0).reduce((count, value) => count + value, 0), 0);
  return { done, total, percent: total ? Math.round(done / total * 100) : 0 };
}

function MissionBriefing({ manifest, progress, start, close }: { manifest: BibleManifest | null; progress: PlayerProgress; start: () => void; close: () => void }) {
  const next = nextMainMission(manifest, progress);
  const context = next ? missionForChapter(next.slug, next.chapter) : null;
  if (!next || !context) return null;
  const narrative = narrativeForMission(context.mission);
  const missionIndex = context.act.missions.findIndex((mission) => mission.title === context.mission.title) + 1;
  const progressInAct = actProgress(context.act, progress.completed);
  const book = manifest?.books.find((item) => item.slug === next.slug);
  return <div className="mission-briefing-backdrop" role="dialog" aria-modal="true" aria-label="Abertura da jornada"><section className="mission-briefing"><button className="mission-briefing-close" onClick={close} aria-label="Fechar">×</button><PixelDisciple /><p>JORNADA: A GRANDE HISTÓRIA</p><span>ATO {context.act.number} · {context.act.title}</span><h1>Capítulo {missionIndex} — {context.mission.title}</h1><div className="mission-progress"><span>{progressInAct.done} de {progressInAct.total} capítulos neste ato</span><i><b style={{ width: `${progressInAct.percent}%` }} /></i></div><blockquote>{narrative.introduction}</blockquote><div className="mission-briefing-ref"><small>LEITURA DE HOJE</small><b>{book?.name || next.slug} {next.chapter}</b></div><button className="mission-begin-button" onClick={start}>Começar jornada <b>→</b></button></section></div>;
}

function MissionStoryPanel({ context, progress }: { context: ReturnType<typeof missionForChapter>; progress: PlayerProgress }) {
  if (!context) return null;
  const narrative = narrativeForMission(context.mission);
  const index = context.act.missions.findIndex((mission) => mission.title === context.mission.title) + 1;
  const progressInAct = actProgress(context.act, progress.completed);
  return <aside className="mission-story-panel"><div><p>CAPÍTULO {index} DE {context.act.missions.length} · ATO {context.act.number}</p><h2>{context.mission.title}</h2><span>{narrative.introduction}</span></div><div className="mission-story-progress"><b>{progressInAct.done}/{progressInAct.total}</b><i><em style={{ width: `${progressInAct.percent}%` }} /></i></div><blockquote><small>MOMENTO DE REFLEXÃO</small>{narrative.reflection}</blockquote></aside>;
}

function RewardModal({ reward, level, close }: { reward: ChapterReward; level: number; close: () => void }) {
  const completedMission = reward.missionTitle ? campaignActs.flatMap((act) => act.missions).find((mission) => mission.title === reward.missionTitle) : undefined;
  const narrative = completedMission ? narrativeForMission(completedMission) : null;
  return <div className="reward-backdrop"><div className="reward-modal" role="dialog" aria-modal="true" aria-label="Recompensa da missão"><div className="reward-rays" /><span className="reward-chest">♛</span><p>{reward.actCompleted ? `ATO CONCLUÍDO · ${reward.actTitle}` : reward.missionCompleted ? `MISSÃO CONCLUÍDA · ${reward.missionTitle}` : reward.levelUp ? "NOVO NÍVEL ALCANÇADO" : "CAPÍTULO CONCLUÍDO"}</p><h2>{reward.levelUp ? `Nível ${level}` : "Recompensa obtida"}</h2><div><b>+{reward.xp}<small>XP</small></b><b>+{reward.coins}<small>MOEDAS</small></b></div>{narrative && <blockquote className="mission-reveal"><b>{narrative.discovery}</b><span>{narrative.next}</span></blockquote>}{reward.unlocked.length > 0 && <em>✦ Nova conquista desbloqueada</em>}<button onClick={close}>Continuar jornada</button></div></div>;
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
  const copyVerse = async () => {
    await navigator.clipboard?.writeText(`João 3:16 — ${verseText}`);
    notify("Versículo copiado");
  };
  const shareVerse = async () => {
    if (navigator.share) await navigator.share({ title: "João 3:16", text: `João 3:16 — ${verseText}` });
    else await copyVerse();
  };
  const toggleStudyFavorite = () => {
    const favorites = JSON.parse(localStorage.getItem("verbo-mobile-favorites") || "[]") as string[];
    const nextFavorites = saved ? favorites.filter((item) => item !== "joao:3:16") : [...new Set([...favorites, "joao:3:16"])];
    localStorage.setItem("verbo-mobile-favorites", JSON.stringify(nextFavorites));
    setSaved(!saved);
    notify(saved ? "Removido dos favoritos" : "Versículo salvo");
  };
  return (
    <section className="study-page page-in">
      <div className="study-hero">
        <p className="eyebrow light">VERSÍCULO IDENTIFICADO</p>
        <div className="study-ref"><h1>João 3:16</h1><select value={translation} onChange={(e) => setTranslation(e.target.value as Translation)}><option value="BLIVRE">BLIVRE</option><option value="ALMEIDA1819">Almeida 1819</option><option disabled>NAA · licença</option><option disabled>NVI · licença</option></select></div>
        <blockquote>“{verseText}”</blockquote>
        <div className="study-actions"><button onClick={toggleStudyFavorite}>{saved ? "♥ Salvo" : "♡ Salvar"}</button><button onClick={() => void copyVerse()}>⧉ Copiar</button><button onClick={() => void shareVerse()}>↗ Compartilhar</button></div>
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

function isCampaignMissionComplete(mission: (typeof campaignActs)[number]["missions"][number], completed: string[]) {
  const completedSet = new Set(completed);
  for (let chapter = mission.from; chapter <= mission.to; chapter += 1) {
    if (!completedSet.has(`${mission.slug}:${chapter}`)) return false;
  }
  return true;
}

function StudiesPage({ manifest, progress, onStart }: { manifest: BibleManifest | null; progress: PlayerProgress; onStart: () => void }) {
  const activeActIndex = campaignActs.findIndex((act) => !isActComplete(act, progress.completed));
  const actIndex = activeActIndex === -1 ? campaignActs.length - 1 : activeActIndex;
  const act = campaignActs[actIndex];
  const nextAct = campaignActs[actIndex + 1];
  const activeMission = nextMainMission(manifest, progress);
  const actChapters = act.ranges.map((range) => {
    const name = manifest?.books.find((book) => book.slug === range.slug)?.name ?? range.slug;
    return `${name} ${range.from}${range.from === range.to ? "" : `–${range.to}`}`;
  }).join(" · ");
  const missionChapters = (mission: (typeof campaignActs)[number]["missions"][number]) => {
    const name = manifest?.books.find((book) => book.slug === mission.slug)?.name ?? mission.slug;
    return `${name} ${mission.from}${mission.from === mission.to ? "" : `–${mission.to}`}`;
  };

  return <section className="generic-page missions-page page-in">
    <div className="missions-intro"><p className="eyebrow">SUA TRILHA DE APRENDIZADO</p><h1>Missão principal</h1><p className="lead">Avance pela história completa das Escrituras, lendo cada capítulo e registrando seu progresso.</p></div>
    <section className="campaign-overview">
      <div className="campaign-heading"><div><p className="eyebrow">ATO {act.number} · {actChapters}</p><h2>{act.title}</h2></div><span className="campaign-status">{isActComplete(act, progress.completed) ? "CONCLUÍDO" : "EM ANDAMENTO"}</span></div>
      <p className="campaign-lead">{act.number === 1 ? "A beleza da criação encontra a ruptura, a violência e a dispersão. Descubra por que a promessa precisa começar novamente." : "Continue avançando pela Grande História, capítulo a capítulo, até completar este ato da campanha."}</p>
      <div className="campaign-missions">{act.missions.map((mission, index) => {
        const complete = isCampaignMissionComplete(mission, progress.completed);
        const previousComplete = index === 0 || isCampaignMissionComplete(act.missions[index - 1], progress.completed);
        const current = !complete && previousComplete;
        return <article key={mission.title} className={`campaign-mission ${complete ? "complete" : current ? "current" : "locked"}`}>
          <span>{complete ? "✓" : String(index + 1).padStart(2, "0")}</span><div><small>{complete ? "MISSÃO CONCLUÍDA" : current ? "MISSÃO ATUAL" : "BLOQUEADA"} · {missionChapters(mission)}</small><h3>{mission.title}</h3><p>{current && activeMission ? `Comece em ${activeMission.name} ${activeMission.chapter} para avançar nesta missão.` : complete ? "Todos os capítulos desta missão foram concluídos." : "Conclua a missão anterior para liberar este trecho."}</p></div><b>{complete ? "CONCLUÍDA" : current ? "EM ANDAMENTO" : "BLOQUEADA"}</b>
        </article>;
      })}</div>
      <button className="journey-cta mission-current-cta" onClick={onStart} disabled={!activeMission}> {activeMission ? `Abrir missão atual · ${activeMission.name} ${activeMission.chapter}` : "Campanha concluída"} <b>→</b></button>
      {nextAct && <div className="campaign-next"><span>PRÓXIMO ATO</span><b>{nextAct.title}</b><small>Desbloqueado após a conclusão de {actChapters}.</small></div>}
    </section>
    <section className="secondary-missions"><div className="campaign-heading"><div><p className="eyebrow">CONTEÚDO OPCIONAL</p><h2>Missões secundárias</h2></div><span className="campaign-status">BLOQUEADO</span></div><p>A campanha principal é o foco atual. Histórias opcionais e conteúdos paralelos serão liberados ao final da Grande História.</p><button disabled>Bloqueado até o fim da campanha</button></section>
  </section>;
}

function PlansPage() {
  return <section className="generic-page page-in"><p className="eyebrow">CRESÇA UM DIA DE CADA VEZ</p><h1>Planos</h1><p className="lead">Leituras breves para criar constância e aprofundar sua fé.</p><div className="progress-card"><span>PLANO ATUAL</span><h2>João em 21 dias</h2><p>Dia 4 de 21 · João 3</p><div><i style={{ width: "19%" }} /></div><button>Continuar leitura →</button></div><h3 className="list-heading">Para começar</h3><div className="plan-list"><article><i>7</i><div><b>Uma semana com os Salmos</b><span>7 dias · 8 min/dia</span></div><button>＋</button></article><article><i>14</i><div><b>Aprendendo a confiar</b><span>14 dias · 10 min/dia</span></div><button>＋</button></article></div></section>;
}

function ProfilePage({ dark, setDark, progress, manifest, onOpenFavorite }: { dark: boolean; setDark: (value: boolean) => void; progress: PlayerProgress; manifest: BibleManifest | null; onOpenFavorite: (reference: string) => void }) {
  const xpProgress = getXpProgress(progress.xp);
  const [expanded, setExpanded] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const achievements = [
    { icon: "✦", name: "Primeiro passo", unlocked: progress.completed.length >= 1 },
    { icon: "🔥", name: "Leitor fiel", unlocked: progress.completed.length >= 5 },
    { icon: "♜", name: "Guardião", unlocked: progress.completed.length >= 10 },
    ...[10, 50, 100, 365].map((days) => ({ icon: "🔥", name: `${days} dias consecutivos`, unlocked: progress.streak >= days })),
    ...campaignActs.map((act) => ({ icon: act.number === 7 ? "★" : "✦", name: `Ato ${act.number} concluído`, unlocked: isActComplete(act, progress.completed) })),
    ...[10, 20, 30, 40, 50].map((level) => ({ icon: "◆", name: `Nível ${level}`, unlocked: xpProgress.level >= level })),
  ];
  const favorites = progress.favorites || [];
  const visibleAchievements = expanded ? achievements : achievements.slice(0, 3);
  return <section className="generic-page profile-page page-in">
    <div className="profile-heading"><div><p className="eyebrow">SUA JORNADA</p><h1>Perfil</h1><p className="lead">Acompanhe sua constância, suas conquistas e o próximo passo na Palavra.</p></div><span className="profile-status"><i />Jornada ativa</span></div>
    <section className="profile-summary"><div className="profile-avatar">{progress.profilePhoto ? <ProfilePhoto src={progress.profilePhoto} /> : xpProgress.level}</div><div className="profile-identity"><p className="eyebrow">DISCÍPULO</p><h2>{progress.displayName || "Seu Discípulo"}</h2><p className="profile-rank">Nível {xpProgress.level} <span>·</span> {discipleTitle(xpProgress.level)}</p><div className="profile-xp-meta"><span>{progress.xp.toLocaleString("pt-BR")} XP acumulados</span><b>{xpProgress.isMaxLevel ? "NÍVEL MÁXIMO · 50" : `${xpProgress.current - xpProgress.currentLevelXp} / ${xpProgress.needed} XP`}</b></div><div className="profile-xp"><i style={{ width: `${xpProgress.progress}%` }} /></div><small>{xpProgress.isMaxLevel ? "Você completou toda a progressão disponível." : `Faltam ${xpProgress.remaining} XP para o nível ${xpProgress.level + 1}`}</small></div><div className="profile-next"><span>PRÓXIMO MARCO</span><b>{xpProgress.isMaxLevel ? "NÍVEL MÁXIMO" : `NÍVEL ${xpProgress.level + 1}`}</b><i>Continue lendo<br />para avançar</i></div></section>
    <section className="profile-stats"><article><span>✦</span><div><b>{progress.completed.length}</b><small>capítulos lidos</small></div></article><article><span>🔥</span><div><b>{progress.streak}</b><small>dias de sequência</small></div></article><article><span>◆</span><div><b>{progress.coins}</b><small>moedas guardadas</small></div></article><article><span>◎</span><div><b>50</b><small>níveis disponíveis</small></div></article></section>
    <section className="profile-panel"><div className="profile-section-heading"><div><p className="eyebrow">CONQUISTAS</p><h2>Marcos da jornada</h2></div><span>{achievements.filter((item) => item.unlocked).length} de {achievements.length} conquistadas</span></div><div className="achievement-row">{visibleAchievements.map((item) => <article key={item.name} className={item.unlocked ? "earned" : ""}><i>{item.icon}</i><b>{item.name}</b></article>)}</div><button className="profile-action" onClick={() => setExpanded(!expanded)}>{expanded ? "Exibir menos" : "Exibir mais conquistas"}</button></section>
    <section className="profile-panel"><div className="profile-section-heading"><div><p className="eyebrow">BIBLIOTECA</p><h2>Seu acervo</h2></div><span>Leitura</span></div><div className="library-items"><div><i>♡</i><span>Versículos favoritos<small><b>{favorites.length}</b> salvos para revisitar</small></span></div><div><i>▥</i><span>Capítulos concluídos<small><b>{progress.completed.length}</b> registrados na jornada</small></span></div></div><button className="profile-action" onClick={() => setFavoritesOpen(!favoritesOpen)}>Abrir favoritos <b>→</b></button>{favoritesOpen && <div className="favorites-list">{favorites.length ? favorites.map((reference) => { const [slug, chapter, verse] = reference.split(":"); const book = manifest?.books.find((item) => item.slug === slug); return <button key={reference} onClick={() => onOpenFavorite(reference)}><span>♡</span><div><b>{book?.name || slug} {chapter}:{verse}</b><small>Abrir na Bíblia</small></div><em>›</em></button>; }) : <p>Você ainda não salvou versículos.</p>}</div>}</section>
    <h3 className="list-heading">Preferências</h3><div className="settings-list"><button onClick={() => setDark(!dark)}><i>{dark ? "☾" : "☀"}</i><span>Aparência<small>{dark ? "Modo escuro" : "Modo claro"}</small></span><em className={`switch ${dark ? "on" : ""}`}><u /></em></button><button><i>⇩</i><span>Conteúdo bíblico<small>2 traduções · 66 livros cada</small></span><b>›</b></button><button><i>©</i><span>Créditos das traduções<small>Domínio público + CC BY</small></span><b>›</b></button></div>
  </section>;
}

function ProfilePhoto({ src }: { src: string }) {
  // O endereço é definido pelo próprio usuário no perfil e pode ser externo.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Foto do perfil" />;
}

function PixelDisciple() {
  // Sprite fornecido para o personagem da campanha; mantém os pixels nítidos em qualquer tela.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="pixel-disciple" src="/characters/homem-50lvl-idle-south.png" alt="" aria-hidden="true" />;
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

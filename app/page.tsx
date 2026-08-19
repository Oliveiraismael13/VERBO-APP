"use client";

import { useEffect, useRef, useState } from "react";

type Screen = "bible" | "plans" | "camera" | "studies" | "profile" | "result";

const verses = [
  [14, "E, assim como Moisés levantou a serpente no deserto, assim também é necessário que o Filho do Homem seja levantado,"],
  [15, "para que todo o que nele crê tenha a vida eterna."],
  [16, "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo o que nele crê não pereça, mas tenha a vida eterna."],
  [17, "Pois Deus enviou o seu Filho ao mundo, não para que julgasse o mundo, mas para que o mundo fosse salvo por ele."],
  [18, "Quem nele crê não é julgado; mas quem não crê já está julgado, porque não crê no nome do unigênito Filho de Deus."],
] as const;

const topics = [
  { icon: "♡", title: "Amor de Deus", count: "42 passagens", color: "rose" },
  { icon: "✦", title: "Salvação", count: "36 passagens", color: "gold" },
  { icon: "◉", title: "Fé", count: "58 passagens", color: "blue" },
  { icon: "⌂", title: "Vida eterna", count: "29 passagens", color: "green" },
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("bible");
  const [dark, setDark] = useState(false);
  const [fontSize, setFontSize] = useState(19);
  const [translation, setTranslation] = useState("Demo");
  const [saved, setSaved] = useState(false);
  const [marked, setMarked] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [readerMenu, setReaderMenu] = useState(false);
  const [cameraState, setCameraState] = useState<"idle" | "live" | "scanning" | "found" | "denied">("idle");
  const [toast, setToast] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("verbo-theme");
    if (savedTheme === "dark") setDark(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("verbo-theme", dark ? "dark" : "light");
  }, [dark]);

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
              <p className="eyebrow">NOVO TESTAMENTO</p>
              <h1>João <button className="chapter-pill">3 <span>⌄</span></button></h1>
            </div>
            <div className="reader-actions">
              <select className="translation" value={translation} onChange={(event) => setTranslation(event.target.value)} aria-label="Tradução">
                <option>Demo</option><option disabled>NVI · requer licença</option><option disabled>NAA · requer licença</option><option disabled>ARA · requer licença</option>
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
            <button>‹ <span>João 2</span></button>
            <p>36 versículos</p>
            <button><span>João 4</span> ›</button>
          </div>

          <div className="license-note"><span>i</span> Texto demonstrativo. Traduções bíblicas são adicionadas somente com licença.</div>

          <article className="scripture" style={{ "--reader-size": `${fontSize}px` } as React.CSSProperties}>
            {verses.map(([number, text]) => (
              <button key={number} className={`verse ${number === 16 && marked ? "highlighted" : ""}`} onClick={() => number === 16 && setMarked(!marked)}>
                <sup>{number}</sup>{text}
              </button>
            ))}
          </article>

          <div className="verse-tools">
            <p><b>João 3:16</b><span>selecionado</span></p>
            <div>
              <button onClick={() => setMarked(!marked)} aria-label="Destacar">◒</button>
              <button onClick={() => { setSaved(!saved); notify(saved ? "Removido dos favoritos" : "Versículo salvo"); }} className={saved ? "active" : ""} aria-label="Favoritar">{saved ? "♥" : "♡"}</button>
              <button onClick={() => notify("Anotação pronta para editar")} aria-label="Criar anotação">▱</button>
              <button onClick={() => navigator.clipboard?.writeText("João 3:16 — Porque Deus amou o mundo...").then(() => notify("Versículo copiado"))} aria-label="Copiar">⧉</button>
              <button onClick={() => openResult()} aria-label="Estudar">↗</button>
            </div>
          </div>
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

      {searchOpen && <SearchOverlay close={() => setSearchOpen(false)} open={() => { setSearchOpen(false); go("result"); }} />}
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}

function StudyResult({ translation, setTranslation, saved, setSaved, notify }: { translation: string; setTranslation: (value: string) => void; saved: boolean; setSaved: (value: boolean) => void; notify: (value: string) => void }) {
  const [tab, setTab] = useState("resumo");
  return (
    <section className="study-page page-in">
      <div className="study-hero">
        <p className="eyebrow light">VERSÍCULO IDENTIFICADO</p>
        <div className="study-ref"><h1>João 3:16</h1><select value={translation} onChange={(e) => setTranslation(e.target.value)}><option>Demo</option><option disabled>NAA · licença</option><option disabled>NVI · licença</option></select></div>
        <blockquote>“Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito...”</blockquote>
        <div className="study-actions"><button onClick={() => { setSaved(!saved); notify(saved ? "Removido dos favoritos" : "Versículo salvo"); }}>{saved ? "♥ Salvo" : "♡ Salvar"}</button><button onClick={() => notify("Versículo copiado")}>⧉ Copiar</button><button onClick={() => notify("Menu de compartilhamento")}>↗ Compartilhar</button></div>
      </div>
      <div className="study-tabs"><button className={tab === "resumo" ? "active" : ""} onClick={() => setTab("resumo")}>Resumo</button><button className={tab === "comparar" ? "active" : ""} onClick={() => setTab("comparar")}>Comparar</button><button className={tab === "contexto" ? "active" : ""} onClick={() => setTab("contexto")}>Contexto</button></div>
      <div className="study-content">
        {tab === "resumo" && <>
          <section><div className="section-title"><div><span className="mini-icon">◈</span><h3>Compreenda o versículo</h3></div><button>Ver tudo</button></div><div className="insight-card"><p>CONTEXTO LITERÁRIO</p><h4>Uma conversa que muda tudo</h4><span>Jesus conversa com Nicodemos sobre o novo nascimento e revela o propósito central de sua vinda: oferecer vida por meio da fé.</span><button>Ler estudo completo <b>→</b></button></div></section>
          <section><div className="section-title"><div><span className="mini-icon">✦</span><h3>Temas relacionados</h3></div></div><div className="topic-row">{topics.map((topic) => <button key={topic.title} className={topic.color}><i>{topic.icon}</i><span>{topic.title}</span></button>)}</div></section>
          <section><div className="section-title"><div><span className="mini-icon">▷</span><h3>Pregações</h3></div><button>Ver mais</button></div><div className="media-card"><div className="media-thumb sermon"><span>28:14</span><i>▶</i></div><div><small>CONTEÚDO EXTERNO</small><b>O amor que alcança o mundo</b><p>Canal parceiro · YouTube</p></div></div></section>
          <section><div className="section-title"><div><span className="mini-icon">◉</span><h3>Podcasts</h3></div><button>Ver mais</button></div><div className="podcast-card"><div className="podcast-art">V</div><div><small>EPISÓDIO 24 · 32 MIN</small><b>Amados antes de tudo</b><p>Verbo — conversas sobre a fé</p></div><button>▶</button></div></section>
        </>}
        {tab === "comparar" && <div className="compare-list"><p className="license-note"><span>i</span> A comparação será ativada quando as traduções forem licenciadas.</p>{["NAA", "NVI", "ARA"].map((name) => <article key={name}><b>{name}<small>LICENÇA NECESSÁRIA</small></b><p>O texto desta tradução será exibido aqui após a integração autorizada.</p></article>)}</div>}
        {tab === "contexto" && <div className="context-list"><article><span>15</span><p>Para que todo o que nele crê tenha a vida eterna.</p></article><article className="current"><span>16</span><p>Porque Deus amou o mundo de tal maneira...</p></article><article><span>17</span><p>Pois Deus enviou o seu Filho ao mundo, não para que julgasse o mundo...</p></article><button>Abrir capítulo completo →</button></div>}
      </div>
    </section>
  );
}

function StudiesPage({ onOpen }: { onOpen: () => void }) {
  return <section className="generic-page page-in"><p className="eyebrow">EXPLORE A PALAVRA</p><h1>Estudos</h1><p className="lead">Aprofunde a leitura por temas, livros e perguntas essenciais.</p><div className="featured-study" onClick={onOpen} role="button" tabIndex={0}><span>ESTUDO EM DESTAQUE</span><h2>O amor que transforma</h2><p>De João 3 ao coração do Evangelho</p><button>Começar estudo →</button></div><h3 className="list-heading">Temas populares</h3><div className="topic-grid">{topics.map((topic) => <button key={topic.title} onClick={onOpen} className={topic.color}><i>{topic.icon}</i><div><b>{topic.title}</b><span>{topic.count}</span></div><em>›</em></button>)}</div></section>;
}

function PlansPage() {
  return <section className="generic-page page-in"><p className="eyebrow">CRESÇA UM DIA DE CADA VEZ</p><h1>Planos</h1><p className="lead">Leituras breves para criar constância e aprofundar sua fé.</p><div className="progress-card"><span>PLANO ATUAL</span><h2>João em 21 dias</h2><p>Dia 4 de 21 · João 3</p><div><i style={{ width: "19%" }} /></div><button>Continuar leitura →</button></div><h3 className="list-heading">Para começar</h3><div className="plan-list"><article><i>7</i><div><b>Uma semana com os Salmos</b><span>7 dias · 8 min/dia</span></div><button>＋</button></article><article><i>14</i><div><b>Aprendendo a confiar</b><span>14 dias · 10 min/dia</span></div><button>＋</button></article></div></section>;
}

function ProfilePage({ dark, setDark }: { dark: boolean; setDark: (value: boolean) => void }) {
  return <section className="generic-page page-in"><div className="profile-card"><div className="profile-avatar">M</div><h2>Minha jornada</h2><p>Seu espaço de leitura e estudo</p><div><span><b>12</b>dias lendo</span><span><b>8</b>favoritos</span><span><b>3</b>anotações</span></div></div><h3 className="list-heading">Biblioteca</h3><div className="settings-list"><button><i>♡</i><span>Versículos favoritos<small>8 salvos</small></span><b>›</b></button><button><i>▱</i><span>Minhas anotações<small>3 anotações</small></span><b>›</b></button><button><i>◴</i><span>Histórico de leitura<small>Últimos 30 dias</small></span><b>›</b></button></div><h3 className="list-heading">Preferências</h3><div className="settings-list"><button onClick={() => setDark(!dark)}><i>{dark ? "☾" : "☀"}</i><span>Aparência<small>{dark ? "Modo escuro" : "Modo claro"}</small></span><em className={`switch ${dark ? "on" : ""}`}><u /></em></button><button><i>⇩</i><span>Conteúdo offline<small>Nenhuma tradução baixada</small></span><b>›</b></button></div></section>;
}

function SearchOverlay({ close, open }: { close: () => void; open: () => void }) {
  const [query, setQuery] = useState("");
  return <div className="search-overlay page-in"><div className="search-box"><button onClick={close}>‹</button><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busque um versículo, palavra ou tema" /><span>⌕</span></div><p className="eyebrow">{query ? "RESULTADOS" : "BUSCAS RECENTES"}</p>{query ? <div className="search-results"><button onClick={open}><small>REFERÊNCIA</small><b>João 3:16</b><p>Porque Deus amou o mundo de tal maneira...</p><span>›</span></button><button onClick={open}><small>TEMA</small><b>Amor de Deus</b><p>42 passagens e 8 estudos relacionados</p><span>›</span></button></div> : <div className="recent-searches"><button onClick={() => setQuery("João 3:16")}>◴ <span>João 3:16</span> ×</button><button onClick={() => setQuery("amor de Deus")}>◴ <span>amor de Deus</span> ×</button><div className="search-tip"><b>Dica</b><p>Você pode buscar por referências, como “Salmo 23”, ou por frases que lembra.</p></div></div>}</div>;
}

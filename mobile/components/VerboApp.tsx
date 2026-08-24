"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { discipleTitle, getXpProgress } from "../lib/xp";
import { campaignActs, missionForChapter, narrativeForMission } from "../lib/campaign";
import { resizeProfilePhoto } from "../lib/profile-photo";
import { findBiblePassages, parseBibleReference, recognizePortugueseText, type BibleOcrCandidate } from "../lib/bible-ocr";
import { secondaryMissionById, secondaryMissions, secondaryMissionProgress, type SecondaryMission } from "../lib/secondary-missions";
import { mainMissionScrollForChapter } from "../lib/main-mission-scrolls";

type Screen = "journey" | "bible" | "plans" | "camera" | "studies" | "social" | "result";
type BibleVerse = { number: number; text: string };
type BibleBook = { slug: string; name: string; longName: string; abbreviation: string; testament: "old" | "new"; isDeuterocanonical?: boolean; chapters: BibleVerse[][] };
type ManifestBook = Omit<BibleBook, "chapters"> & { code: string; chapterCount: number; verseCount: number };
type BibleManifest = { translation: string; code: string; canon: string; bookCount: number; verseCount: number; books: ManifestBook[] };

const translations = {
  BLIVRE: {
    label: "BLIVRE",
    path: "/bible",
    note: "Bíblia Livre (BLIVRE), edição Textus Receptus · CC BY 3.0 Brasil.",
    license: "CC BY 3.0 BR",
    canon: "protestant-66",
    missions: true,
  },
  ALMEIDA1819: {
    label: "Almeida 1819",
    path: "/bible/almeida1819",
    note: "Almeida 1819 (Bíblia Livre) · domínio público · fonte: Midvash Bible Data.",
    license: "DOMÍNIO PÚBLICO",
    canon: "protestant-66",
    missions: true,
  },
  CHAMADAFE: {
    label: "Chama da Fé · 73",
    path: "/bible/chamadafe",
    note: "Edição Chama da Fé · cânon católico de 73 livros · CC BY 3.0 BR + domínio público.",
    license: "CC BY 3.0 BR + DOMÍNIO PÚBLICO",
    canon: "catholic-73",
    missions: false,
  },
} as const;

type Translation = keyof typeof translations;
type LastReading = { bookSlug: string; chapter: number };
type PlayerProgress = { xp: number; level: number; coins: number; streak: number; completed: string[]; achievements: string[]; dailyNoteCompleted?: boolean; xpBonusPercent?: number; missedStreakDays?: number; displayName?: string; profilePhoto?: string; favorites?: string[]; highlights?: Record<string, string>; notes?: Record<string, string>; noteDates?: Record<string, number>; plans?: string[]; shared?: string[]; foundScrolls?: string[]; lastReading?: LastReading | null };
type ChapterReward = { xp: number; coins: number; levelUp: boolean; unlocked: string[]; scrollsUnlocked?: number; scrollXp?: number; firstScrollDiscovery?: boolean; missionCompleted?: boolean; missionTitle?: string; secondaryMissionCompleted?: boolean; replayCompleted?: boolean; actCompleted?: boolean; actTitle?: string };
type ScrollDiscovery = { count: number; xp: number; first: boolean };
type DeveloperGift = { id: number; amount: number; message: string };
type SecondaryMissionStatus = { id: string; unlocked: boolean; active: boolean; completed: boolean; replaying: boolean; replayChapters: string[]; done: number; total: number };

const emptyProgress: PlayerProgress = { xp: 0, level: 1, coins: 0, streak: 0, completed: [], achievements: [], dailyNoteCompleted: false };

function secondaryStatusProgress(mission: SecondaryMission, progress: PlayerProgress, status?: SecondaryMissionStatus | null) {
  if (status?.replaying) {
    const done = status.replayChapters.length;
    return { done, total: mission.to - mission.from + 1, percent: Math.round(done / (mission.to - mission.from + 1) * 100) };
  }
  return secondaryMissionProgress(mission, progress.completed);
}

function isSecondaryMissionChapterUnlocked(mission: SecondaryMission, progress: PlayerProgress, status: SecondaryMissionStatus | null, chapter: number) {
  if (chapter < mission.from || chapter > mission.to) return false;
  const completed = new Set(status?.replaying ? status.replayChapters : progress.completed);
  for (let current = mission.from; current < chapter; current += 1) {
    if (!completed.has(`${mission.bookSlug}:${current}`)) return false;
  }
  return true;
}

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
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);
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
  const [cameraState, setCameraState] = useState<"idle" | "live" | "scanning" | "found" | "uncertain" | "retry" | "denied">("idle");
  const [cameraError, setCameraError] = useState("");
  const [recognizedPassage, setRecognizedPassage] = useState<BibleOcrCandidate | null>(null);
  const [recognitionOptions, setRecognitionOptions] = useState<BibleOcrCandidate[]>([]);
  const [ocrPreview, setOcrPreview] = useState("");
  const [manualReference, setManualReference] = useState("");
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [toast, setToast] = useState("");
  const [progress, setProgress] = useState<PlayerProgress>(emptyProgress);
  const [secondaryMissionStates, setSecondaryMissionStates] = useState<SecondaryMissionStatus[]>([]);
  const [secondaryBriefingId, setSecondaryBriefingId] = useState<string | null>(null);
  const [leaveMissionDialog, setLeaveMissionDialog] = useState(false);
  const [pendingScreen, setPendingScreen] = useState<Screen | null>(null);
  const [reward, setReward] = useState<ChapterReward | null>(null);
  const [scrollDiscovery, setScrollDiscovery] = useState<ScrollDiscovery | null>(null);
  const [developerGift, setDeveloperGift] = useState<DeveloperGift | null>(null);
  const [savingChapter, setSavingChapter] = useState(false);
  const [lastReadingReady, setLastReadingReady] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastReadingRef = useRef<LastReading | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const connectCameraPreview = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    const stream = streamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    void video.play().catch(() => {
      stopCamera();
      setCameraError("Não foi possível iniciar a prévia da câmera. Tente novamente.");
      setCameraState("denied");
    });
  }, [stopCamera]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("verbo-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tema salvo só existe no navegador
    if (savedTheme === "dark") setDark(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("verbo-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const restoreFrame = window.requestAnimationFrame(() => {
      const saved = JSON.parse(localStorage.getItem("verbo-last-reading") || "null") as unknown;
      if (!saved || typeof saved !== "object") return;
      const reading = saved as Partial<LastReading>;
      if (typeof reading.bookSlug === "string" && /^[a-z0-9]+$/.test(reading.bookSlug) && Number.isInteger(reading.chapter) && reading.chapter! >= 1) {
        lastReadingRef.current = { bookSlug: reading.bookSlug, chapter: reading.chapter };
        setBookSlug(reading.bookSlug);
        setChapter(reading.chapter);
        setSelectedVerse(1);
      }
    });
    return () => window.cancelAnimationFrame(restoreFrame);
  }, []);

  const loadSecondaryMissions = useCallback(async () => {
    const response = await fetch("/api/secondary-missions");
    if (!response.ok) return;
    const data = await response.json() as { coins: number; missions: SecondaryMissionStatus[] };
    setSecondaryMissionStates(data.missions || []);
    setProgress((current) => ({ ...current, coins: data.coins }));
  }, []);

  useEffect(() => { void loadSecondaryMissions(); }, [loadSecondaryMissions]);

  const activeSecondaryStatus = secondaryMissionStates.find((mission) => mission.active) || null;
  const activeSecondaryMission = activeSecondaryStatus ? secondaryMissionById(activeSecondaryStatus.id) : null;
  const replayingSecondaryMission = Boolean(activeSecondaryStatus?.replaying);
  const replayChapterComplete = Boolean(replayingSecondaryMission && activeSecondaryStatus?.replayChapters.includes(`${bookSlug}:${chapter}`));
  const insightMission = secondaryMissions.find((mission) => mission.bookSlug === bookSlug && Boolean(mission.insights[chapter]));
  const secondaryChapterInsights = insightMission ? [...insightMission.insights[chapter], ...(insightMission.hiddenInsight?.chapter === chapter ? [insightMission.hiddenInsight.insight] : [])] : [];
  const primaryMissionScroll = book && missionForChapter(bookSlug, chapter) ? mainMissionScrollForChapter(bookSlug, chapter, book.testament) : null;
  const secondaryScrollKeys = insightMission ? secondaryChapterInsights.map((_, index) => `secondary:${insightMission.id}:${chapter}:${index}`) : [];
  const discoveredSecondaryChapterInsights = secondaryChapterInsights.filter((_, index) => progress.foundScrolls?.includes(secondaryScrollKeys[index]));
  const activeSecondaryHiddenInsight = Boolean(activeSecondaryMission && !replayingSecondaryMission && activeSecondaryMission.bookSlug === bookSlug && activeSecondaryMission.hiddenInsight?.chapter === chapter) ? activeSecondaryMission.hiddenInsight : null;
  const secondaryHiddenScrollKey = activeSecondaryMission && activeSecondaryHiddenInsight ? `secondary:${activeSecondaryMission.id}:${chapter}:${activeSecondaryMission.insights[chapter].length}` : null;
  const primaryScrollKey = `primary:${bookSlug}:${chapter}`;
  const primaryScrollUnlocked = Boolean(primaryMissionScroll && progress.foundScrolls?.includes(primaryScrollKey));

  const verseKey = `${bookSlug}:${chapter}:${selectedVerse}`;
  const selectedVerseKeys = useMemo(() => selectedVerses.map((number) => `${bookSlug}:${chapter}:${number}`), [bookSlug, chapter, selectedVerses]);
  useEffect(() => {
    const storedFavorites = (progress.favorites || JSON.parse(localStorage.getItem("verbo-mobile-favorites") || "[]")) as string[];
    const storedHighlights = (progress.highlights || JSON.parse(localStorage.getItem("verbo-mobile-highlights") || "{}")) as Record<string, string>;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- favoritos e destaques vêm do armazenamento do navegador
    setSaved(selectedVerseKeys.length > 0 && selectedVerseKeys.every((key) => storedFavorites.includes(key)));
    setMarked(selectedVerseKeys.length > 0 && selectedVerseKeys.every((key) => Boolean(storedHighlights[key])));
    setHighlightColor(storedHighlights[verseKey] || "yellow");
  }, [verseKey, selectedVerseKeys, progress.favorites, progress.highlights]);

  useEffect(() => {
    Promise.all([fetch("/api/progress"), fetch("/api/profile"), fetch("/api/library"), fetch("/api/gifts")]).then(async ([progressResponse, profileResponse, libraryResponse, giftsResponse]) => {
      const data = await progressResponse.json();
      const profile = profileResponse.ok ? await profileResponse.json() : {};
      const library = libraryResponse.ok ? await libraryResponse.json() : {};
      const gifts = giftsResponse.ok ? await giftsResponse.json() as { gift?: DeveloperGift | null } : {};
      if (!data.error) {
        setProgress({ ...data, ...profile, ...library });
        const reading = library.lastReading as LastReading | null | undefined;
        if (reading && typeof reading.bookSlug === "string" && /^[a-z0-9]+$/.test(reading.bookSlug) && Number.isInteger(reading.chapter) && reading.chapter >= 1) {
          lastReadingRef.current = reading;
          setBookSlug(reading.bookSlug);
          setChapter(reading.chapter);
          setSelectedVerse(1);
        }
      }
      if (gifts.gift) setDeveloperGift(gifts.gift);
    }).catch(() => undefined).finally(() => setLastReadingReady(true));
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

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (screen !== "bible" || !recognizedPassage || recognizedPassage.bookSlug !== bookSlug || recognizedPassage.chapter !== chapter || !book) return;
    const timer = window.setTimeout(() => document.querySelector(`[data-verse="${recognizedPassage.startVerse}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    return () => window.clearTimeout(timer);
  }, [screen, recognizedPassage, bookSlug, chapter, book]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  const saveRemoteLibrary = async (next: Partial<Pick<PlayerProgress, "favorites" | "highlights" | "notes" | "noteDates" | "plans" | "shared" | "foundScrolls">>, base = progress) => {
    await fetch("/api/library", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ favorites: base.favorites || [], highlights: base.highlights || {}, notes: base.notes || {}, noteDates: base.noteDates || {}, plans: base.plans || [], shared: base.shared || [], foundScrolls: base.foundScrolls || [], lastReading: lastReadingRef.current, ...next }) }).catch(() => undefined);
  };

  const claimDeveloperGift = async () => {
    if (!developerGift) return;
    const gift = developerGift;
    setDeveloperGift(null);
    await fetch("/api/gifts", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "claim", id: gift.id }) }).catch(() => undefined);
  };

  const awardScrollXp = async (scrollKeys: string[]) => {
    if (!scrollKeys.length) return { progress: null as PlayerProgress | null, xp: 0, levelUp: false };
    try {
      const response = await fetch("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "scroll", scrollKeys }) });
      const data = await response.json() as PlayerProgress & { reward?: { xp?: number; levelUp?: boolean } | null };
      if (!response.ok) throw new Error("scroll-reward");
      const { reward: scrollReward, ...remoteProgress } = data;
      return { progress: remoteProgress, xp: scrollReward?.xp || 0, levelUp: Boolean(scrollReward?.levelUp) };
    } catch {
      return { progress: null as PlayerProgress | null, xp: 0, levelUp: false };
    }
  };

  const primaryRequirementMet = (candidate: PlayerProgress) => {
    if (!primaryMissionScroll) return false;
    const versePrefix = `${bookSlug}:${chapter}:`;
    if (primaryMissionScroll.requirement === "complete") return candidate.completed.includes(`${bookSlug}:${chapter}`);
    if (primaryMissionScroll.requirement === "favorite") return Boolean(candidate.favorites?.some((key) => key.startsWith(versePrefix)));
    if (primaryMissionScroll.requirement === "highlight-one") return Object.keys(candidate.highlights || {}).some((key) => key.startsWith(versePrefix));
    if (primaryMissionScroll.requirement === "highlight-three") return Object.keys(candidate.highlights || {}).filter((key) => key.startsWith(versePrefix)).length >= 3;
    if (primaryMissionScroll.requirement === "note") return Object.keys(candidate.notes || {}).some((key) => key.startsWith(versePrefix) && Boolean(candidate.notes?.[key]?.trim()));
    return candidate.shared?.includes(`${bookSlug}:${chapter}`) || false;
  };

  const unlockPrimaryScrollIfReady = async (candidate: PlayerProgress) => {
    if (!missionMode || !primaryMissionScroll || candidate.foundScrolls?.includes(primaryScrollKey) || !primaryRequirementMet(candidate)) return;
    const firstDiscovery = !(candidate.foundScrolls?.length);
    const foundScrolls = Array.from(new Set([...(candidate.foundScrolls || []), primaryScrollKey]));
    const scrollReward = await awardScrollXp([primaryScrollKey]);
    const updated = { ...candidate, ...(scrollReward.progress || {}), foundScrolls };
    setProgress(updated);
    void saveRemoteLibrary({ foundScrolls }, updated);
    setScrollDiscovery({ count: 1, xp: scrollReward.xp || 20, first: firstDiscovery });
  };

  const unlockSecondaryHiddenScrollIfReady = async (candidate: PlayerProgress) => {
    if (!secondaryHiddenScrollKey || candidate.foundScrolls?.includes(secondaryHiddenScrollKey)) return;
    const prefix = `${bookSlug}:${chapter}:`;
    const hasFavorite = candidate.favorites?.some((key) => key.startsWith(prefix));
    const noteCount = Object.entries(candidate.notes || {}).filter(([key, note]) => key.startsWith(prefix) && Boolean(note.trim())).length;
    if (!hasFavorite && noteCount < 2) return;
    const firstDiscovery = !(candidate.foundScrolls?.length);
    const scrollReward = await awardScrollXp([secondaryHiddenScrollKey]);
    if (!scrollReward.xp) return;
    const foundScrolls = Array.from(new Set([...(candidate.foundScrolls || []), secondaryHiddenScrollKey]));
    const updated = { ...candidate, ...(scrollReward.progress || {}), foundScrolls };
    setProgress(updated);
    void saveRemoteLibrary({ foundScrolls }, updated);
    setScrollDiscovery({ count: 1, xp: scrollReward.xp, first: firstDiscovery });
  };

  useEffect(() => {
    if (!lastReadingReady) return;
    const reading = { bookSlug, chapter };
    lastReadingRef.current = reading;
    localStorage.setItem("verbo-last-reading", JSON.stringify(reading));
    const timer = window.setTimeout(() => { void saveRemoteLibrary({}); }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a leitura deve ser salva somente ao trocar de livro ou capítulo
  }, [bookSlug, chapter, lastReadingReady]);

  const updateProfilePhoto = async (file: File) => {
    try {
      const profilePhoto = await resizeProfilePhoto(file);
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: progress.displayName || "Discípulo", profilePhoto }) });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || "Não foi possível salvar a foto.");
      setProgress((current) => ({ ...current, ...updated }));
      notify("Foto do perfil atualizada");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível atualizar a foto");
    }
  };

  const updateDisplayName = async (displayName: string) => {
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName, profilePhoto: progress.profilePhoto || "" }) });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || "Não foi possível salvar o nome.");
      setProgress((current) => ({ ...current, ...updated }));
      notify("Nome do perfil atualizado");
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível atualizar o nome");
      return false;
    }
  };

  const navigate = (next: Screen) => {
    if (next !== "camera") {
      stopCamera();
      setCameraState("idle");
    }
    setScreen(next);
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const go = (next: Screen) => {
    if (screen === "bible" && next !== "bible" && (missionMode || activeSecondaryMission)) {
      setPendingScreen(next);
      setLeaveMissionDialog(true);
      return false;
    }
    navigate(next);
    return true;
  };

  const openCamera = async () => {
    try {
      stopCamera();
      if (!window.isSecureContext) throw new Error("A câmera só funciona em uma conexão segura (HTTPS).");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador não oferece acesso à câmera.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
      streamRef.current = stream;
      setCameraError("");
      setCameraState("live");
    } catch (error) {
      const message = error instanceof DOMException && error.name === "NotAllowedError"
        ? "Permita o uso da câmera nas configurações do navegador."
        : error instanceof DOMException && error.name === "NotFoundError"
          ? "Nenhuma câmera foi encontrada neste dispositivo."
          : error instanceof DOMException && error.name === "NotReadableError"
            ? "A câmera está sendo usada por outro aplicativo."
            : error instanceof Error ? error.message : "Não foi possível abrir a câmera.";
      setCameraError(message);
      setCameraState("denied");
    }
  };

  const captureCameraFrame = () => new Promise<Blob>((resolve, reject) => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return reject(new Error("A câmera ainda está sendo preparada."));
    const canvas = document.createElement("canvas");
    const cropTop = Math.round(video.videoHeight * 0.2);
    const cropHeight = Math.round(video.videoHeight * 0.56);
    canvas.width = video.videoWidth;
    canvas.height = cropHeight;
    const context = canvas.getContext("2d");
    if (!context) return reject(new Error("Não foi possível preparar a imagem da câmera."));
    context.drawImage(video, 0, cropTop, video.videoWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível capturar a imagem.")), "image/jpeg", 0.92);
  });

  const scan = async (file?: File) => {
    if (!manifest) {
      notify("A Bíblia ainda está sendo carregada");
      return;
    }
    setCameraState("scanning");
    setRecognizedPassage(null);
    setRecognitionOptions([]);
    try {
      const source = file || await captureCameraFrame();
      const ocr = await recognizePortugueseText(source);
      setOcrPreview(ocr.text);
      if (ocr.text.trim().length < 12) {
        setCameraState("retry");
        return;
      }
      const candidates = await findBiblePassages(ocr.text, translations[translation].path, manifest.books);
      if (!candidates.length) {
        setCameraState("retry");
        return;
      }
      const [best, ...alternatives] = candidates;
      setRecognizedPassage(best);
      setRecognitionOptions(alternatives);
      setManualReference(`${best.bookName} ${best.chapter}:${best.startVerse}${best.endVerse > best.startVerse ? `-${best.endVerse}` : ""}`);
      setCameraState(best.confidence >= 88 && ocr.confidence >= 55 ? "found" : "uncertain");
    } catch (error) {
      setCameraState("retry");
      notify(error instanceof Error ? error.message : "Não foi possível ler a imagem");
    }
  };

  const openRecognizedPassage = useCallback((candidate = recognizedPassage) => {
    if (!candidate) return;
    stopCamera();
    setCameraState("idle");
    setMissionMode(false);
    setBookSlug(candidate.bookSlug);
    setChapter(candidate.chapter);
    setSelectedVerse(candidate.startVerse);
    setSelectedVerses(Array.from({ length: candidate.endVerse - candidate.startVerse + 1 }, (_, index) => candidate.startVerse + index));
    setVerseSelected(true);
    setHighlightPickerOpen(false);
    setScreen("bible");
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [recognizedPassage, stopCamera]);

  const confirmManualReference = () => {
    if (!manifest) return;
    const parsed = parseBibleReference(manualReference, manifest.books);
    if (!parsed || parsed.chapter < 1 || parsed.chapter > parsed.book.chapterCount || parsed.startVerse < 1 || parsed.endVerse < parsed.startVerse) {
      notify("Use um formato como João 3:16");
      return;
    }
    const candidate: BibleOcrCandidate = { bookSlug: parsed.book.slug, bookName: parsed.book.name, chapter: parsed.chapter, startVerse: parsed.startVerse, endVerse: parsed.endVerse, confidence: recognizedPassage?.confidence || 0, excerpt: recognizedPassage?.excerpt || "" };
    openRecognizedPassage(candidate);
  };

  useEffect(() => {
    if (cameraState !== "found" || !recognizedPassage) return;
    const timer = window.setTimeout(() => openRecognizedPassage(), 1800);
    return () => window.clearTimeout(timer);
  }, [cameraState, recognizedPassage, openRecognizedPassage]);

  const completeChapter = async () => {
    const secondaryChapterActive = Boolean(activeSecondaryMission && activeSecondaryMission.bookSlug === bookSlug && chapter >= activeSecondaryMission.from && chapter <= activeSecondaryMission.to);
    if (!missionMode && !secondaryChapterActive) {
      notify("Entre na missão para registrar este capítulo");
      return;
    }
    if ((replayingSecondaryMission ? replayChapterComplete : progress.completed.includes(`${bookSlug}:${chapter}`)) || savingChapter) return;
    setSavingChapter(true);
    try {
      if (replayingSecondaryMission && activeSecondaryMission) {
        const response = await fetch("/api/secondary-missions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionId: activeSecondaryMission.id, action: "record-replay", chapter }) });
        const data = await response.json() as { missions?: SecondaryMissionStatus[]; replayCompleted?: boolean; error?: string };
        if (!response.ok) throw new Error(data.error || "Não foi possível registrar a releitura.");
        setSecondaryMissionStates(data.missions || []);
        if (data.replayCompleted) setReward({ xp: 0, coins: 0, levelUp: false, unlocked: [], missionCompleted: true, missionTitle: activeSecondaryMission.title, replayCompleted: true });
        else advanceToNextChapter(progress);
        return;
      }
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookSlug, chapter }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const { reward: earned, ...nextProgress } = data;
      const secondaryScrolls = secondaryChapterActive && activeSecondaryMission ? activeSecondaryMission.insights[chapter].map((_, index) => `secondary:${activeSecondaryMission.id}:${chapter}:${index}`) : [];
      const primaryScrollFoundOnCompletion = Boolean(missionMode && primaryMissionScroll?.requirement === "complete" && !progress.foundScrolls?.includes(primaryScrollKey) && nextProgress.completed.includes(`${bookSlug}:${chapter}`));
      const foundOnCompletion = [...secondaryScrolls, ...(primaryScrollFoundOnCompletion ? [primaryScrollKey] : [])];
      const firstScrollDiscovery = foundOnCompletion.length > 0 && !(progress.foundScrolls?.length);
      const initialProgress = { ...progress, ...nextProgress, foundScrolls: Array.from(new Set([...(progress.foundScrolls || []), ...foundOnCompletion])) };
      const scrollReward = await awardScrollXp(foundOnCompletion);
      const updatedProgress = { ...initialProgress, ...(scrollReward.progress || {}), foundScrolls: initialProgress.foundScrolls };
      setProgress(updatedProgress);
      if (earned) {
        earned.xp += scrollReward.xp;
        earned.levelUp ||= scrollReward.levelUp;
        earned.scrollsUnlocked = foundOnCompletion.length;
        earned.scrollXp = scrollReward.xp;
        earned.firstScrollDiscovery = firstScrollDiscovery;
        setReward(earned);
        if (foundOnCompletion.length) void saveRemoteLibrary({ foundScrolls: updatedProgress.foundScrolls }, updatedProgress);
        unlockPrimaryScrollIfReady(updatedProgress);
        if (earned.secondaryMissionCompleted) void loadSecondaryMissions();
        advanceToNextChapter(updatedProgress);
      }
    } catch {
      notify("Não foi possível salvar o progresso");
    } finally {
      setSavingChapter(false);
    }
  };

  const selectVerse = (number: number) => {
    if (selectedVerses.includes(number)) {
      const remaining = selectedVerses.filter((item) => item !== number);
      setSelectedVerses(remaining);
      setVerseSelected(remaining.length > 0);
      setSelectedVerse(remaining.at(-1) ?? number);
      if (!remaining.length) setHighlightPickerOpen(false);
      return;
    }
    setSelectedVerses([...selectedVerses, number]);
    setSelectedVerse(number);
    setVerseSelected(true);
    setHighlightPickerOpen(true);
  };

  const toggleFavorite = async () => {
    const favorites = JSON.parse(localStorage.getItem("verbo-mobile-favorites") || "[]") as string[];
    const keys = selectedVerseKeys.length ? selectedVerseKeys : [verseKey];
    const allSaved = keys.every((key) => favorites.includes(key));
    const nextFavorites = allSaved ? favorites.filter((item) => !keys.includes(item)) : Array.from(new Set([...favorites, ...keys]));
    localStorage.setItem("verbo-mobile-favorites", JSON.stringify(nextFavorites));
    setSaved(!allSaved);
    const updated = { ...progress, favorites: nextFavorites };
    setProgress(updated);
    await saveRemoteLibrary({ favorites: nextFavorites }, updated);
    unlockPrimaryScrollIfReady(updated);
    if (!allSaved) void unlockSecondaryHiddenScrollIfReady(updated);
    notify(allSaved ? "Removido dos favoritos" : keys.length > 1 ? "Versículos salvos" : "Versículo salvo");
  };

  const chooseHighlight = (color: string) => {
    const highlights = JSON.parse(localStorage.getItem("verbo-mobile-highlights") || "{}") as Record<string, string>;
    const keys = selectedVerseKeys.length ? selectedVerseKeys : [verseKey];
    keys.forEach((key) => { highlights[key] = color; });
    localStorage.setItem("verbo-mobile-highlights", JSON.stringify(highlights));
    setHighlightColor(color);
    setMarked(true);
    const updated = { ...progress, highlights };
    setProgress(updated);
    void saveRemoteLibrary({ highlights }, updated);
    unlockPrimaryScrollIfReady(updated);
    setHighlightPickerOpen(false);
    notify(keys.length > 1 ? "Versículos marcados" : "Versículo marcado");
  };

  const clearHighlight = () => {
    const highlights = JSON.parse(localStorage.getItem("verbo-mobile-highlights") || "{}") as Record<string, string>;
    const keys = selectedVerseKeys.length ? selectedVerseKeys : [verseKey];
    keys.forEach((key) => delete highlights[key]);
    localStorage.setItem("verbo-mobile-highlights", JSON.stringify(highlights));
    setMarked(false);
    setProgress((current) => ({ ...current, highlights }));
    void saveRemoteLibrary({ highlights });
    setHighlightPickerOpen(false);
    notify(keys.length > 1 ? "Marcações removidas" : "Marcação removida");
  };

  const openNoteEditor = () => {
    const keys = selectedVerseKeys.length ? selectedVerseKeys : [verseKey];
    setNoteDraft(progress.notes?.[keys[0]] || localStorage.getItem(`verbo-mobile-note-${keys[0]}`) || "");
    setNoteEditorOpen(true);
  };

  const awardDailyNoteXp = async () => {
    const response = await fetch("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "note" }) }).catch(() => null);
    if (!response?.ok) return 0;
    const data = await response.json() as PlayerProgress & { reward?: { xp?: number } | null };
    setProgress((current) => ({ ...current, ...data }));
    return data.reward?.xp || 0;
  };

  const restoreStreak = async () => {
    try {
      const response = await fetch("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "restore-streak" }) });
      const data = await response.json() as PlayerProgress & { error?: string; restoration?: { nextDay: number } };
      if (!response.ok) throw new Error(data.error || "Não foi possível restaurar os dias perdidos.");
      const { restoration, ...nextProgress } = data;
      setProgress((current) => ({ ...current, ...nextProgress }));
      notify(`Dias restaurados. Amanhã você seguirá no dia ${restoration?.nextDay ?? progress.streak + 1}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível restaurar os dias perdidos.");
    }
  };

  const saveNote = async () => {
    const keys = selectedVerseKeys.length ? selectedVerseKeys : [verseKey];
    const notes = { ...(progress.notes || JSON.parse(localStorage.getItem("verbo-mobile-notes") || "{}")) } as Record<string, string>;
    const noteDates = { ...(progress.noteDates || {}) } as Record<string, number>;
    const savedNote = noteDraft.trim();
    keys.forEach((key) => {
      if (savedNote) { notes[key] = savedNote; noteDates[key] ||= Date.now(); }
      else { delete notes[key]; delete noteDates[key]; }
    });
    localStorage.setItem("verbo-mobile-notes", JSON.stringify(notes));
    const updated = { ...progress, notes, noteDates };
    setProgress(updated);
    await saveRemoteLibrary({ notes, noteDates }, updated);
    unlockPrimaryScrollIfReady(updated);
    if (savedNote) void unlockSecondaryHiddenScrollIfReady(updated);
    setNoteEditorOpen(false);
    const earnedXp = savedNote ? await awardDailyNoteXp() : 0;
    notify(savedNote ? earnedXp ? `Anotação salva · +${earnedXp} XP` : "Anotação salva" : "Anotação removida");
  };

  const shareSelection = async () => {
    const selected = currentVerses.filter((verse) => selectedVerseKeys.includes(`${bookSlug}:${chapter}:${verse.number}`));
    const content = selected.length ? selected.map((verse) => `${verse.number}. ${verse.text}`).join(" ") : currentVerses.find((verse) => verse.number === selectedVerse)?.text || "";
    const reference = `${book?.name} ${chapter}:${selectedVerses[0] || selectedVerse}${selectedVerses.length > 1 ? `-${selectedVerses.at(-1)}` : ""}`;
    try {
      if (navigator.share) await navigator.share({ title: reference, text: `${reference} — ${content}` });
      else {
        await navigator.clipboard?.writeText(`${reference} — ${content}`);
        notify("Passagem copiada para compartilhar");
      }
      const shared = Array.from(new Set([...(progress.shared || []), `${bookSlug}:${chapter}`]));
      const updated = { ...progress, shared };
      setProgress(updated);
      void saveRemoteLibrary({ shared }, updated);
      unlockPrimaryScrollIfReady(updated);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) notify("Não foi possível compartilhar agora");
    }
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
    if (activeSecondaryMission && (slug !== activeSecondaryMission.bookSlug || !isSecondaryMissionChapterUnlocked(activeSecondaryMission, progress, activeSecondaryStatus, nextChapter))) {
      notify("Conclua o capítulo atual para liberar o próximo da missão");
      return;
    }
    setBookSlug(slug);
    setChapter(nextChapter);
    setSelectedVerse(1);
    setSelectedVerses([]);
    setVerseSelected(false);
    setHighlightPickerOpen(false);
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
    setSelectedVerses([nextVerse]);
    setVerseSelected(true);
    go("bible");
  };

  const openMissionBriefing = () => {
    if (nextMainMission(manifest, progress)) setMissionBriefingOpen(true);
  };

  const beginMission = () => {
    const mission = nextMainMission(manifest, progress);
    if (!mission) return;
    if (!translations[translation].missions) {
      changeTranslation("BLIVRE");
      notify("As missões usam a Bíblia Livre e o cânon protestante de 66 livros");
    }
    chooseBook(mission.slug, mission.chapter);
    setMissionMode(true);
    setMissionBriefingOpen(false);
    go("bible");
  };

  const unlockSecondaryMission = async (missionId: string) => {
    const mission = secondaryMissionById(missionId);
    if (!mission) return;
    if (!window.confirm(`Desbloquear “${mission.title}” por ${mission.cost} siclos de prata?`)) return;
    try {
      const response = await fetch("/api/secondary-missions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionId }) });
      const data = await response.json() as { coins?: number; missions?: SecondaryMissionStatus[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível desbloquear a missão.");
      setSecondaryMissionStates(data.missions || []);
      setProgress((current) => ({ ...current, coins: data.coins ?? current.coins }));
      setSecondaryBriefingId(missionId);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível desbloquear a missão.");
    }
  };

  const restartSecondaryMission = async (mission: SecondaryMission) => {
    try {
      const response = await fetch("/api/secondary-missions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionId: mission.id }) });
      const data = await response.json() as { missions?: SecondaryMissionStatus[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível reiniciar a missão.");
      setSecondaryMissionStates(data.missions || []);
      setSecondaryBriefingId(mission.id);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível reiniciar a missão.");
    }
  };

  const beginSecondaryMission = (mission: SecondaryMission) => {
    if (!translations[translation].missions) changeTranslation("BLIVRE");
    setMissionMode(false);
    chooseBook(mission.bookSlug, mission.from);
    setSecondaryBriefingId(null);
    go("bible");
  };

  const leaveActiveMission = async () => {
    const next = pendingScreen;
    setLeaveMissionDialog(false);
    setPendingScreen(null);
    setMissionMode(false);
    if (activeSecondaryStatus) {
      const missionId = activeSecondaryStatus.id;
      setSecondaryMissionStates((current) => current.map((mission) => mission.id === missionId ? { ...mission, active: false, replaying: false } : mission));
      try {
        const response = await fetch("/api/secondary-missions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionId, action: "pause" }) });
        const data = await response.json() as { missions?: SecondaryMissionStatus[] };
        if (response.ok) setSecondaryMissionStates(data.missions || []);
      } catch {
        notify("Não foi possível pausar a missão agora.");
      }
    }
    if (next) navigate(next);
  };

  const changeTranslation = (next: Translation) => {
    if ((missionMode || activeSecondaryMission) && !translations[next].missions) {
      notify("A Edição Chama da Fé não é usada nas missões");
      return;
    }
    if (next !== "CHAMADAFE" && manifest?.books.find((item) => item.slug === bookSlug)?.isDeuterocanonical) {
      setBookSlug("joao");
      setChapter(3);
      setSelectedVerse(16);
    } else if (next !== "CHAMADAFE" && bookSlug === "est" && chapter > 10) {
      setChapter(10);
      setSelectedVerse(1);
    } else if (next !== "CHAMADAFE" && bookSlug === "dan" && chapter > 12) {
      setChapter(12);
      setSelectedVerse(1);
    }
    setBook(null);
    setManifest(null);
    setSelectedVerses([]);
    setVerseSelected(false);
    setHighlightPickerOpen(false);
    setTranslation(next);
  };

  const moveChapter = (direction: -1 | 1) => {
    if (!book || !manifest) return;
    const target = chapter + direction;
    if (target >= 1 && target <= book.chapters.length) {
      if (missionMode && direction > 0 && !isMainChapterUnlocked(manifest, progress, bookSlug, target)) {
        notify("Conclua este capítulo para liberar o próximo");
        return;
      }
      if (activeSecondaryMission && (bookSlug !== activeSecondaryMission.bookSlug || !isSecondaryMissionChapterUnlocked(activeSecondaryMission, progress, activeSecondaryStatus, target))) {
        notify("Conclua o capítulo atual para liberar o próximo da missão");
        return;
      }
      setChapter(target);
      setSelectedVerse(1);
      setSelectedVerses([]);
      setVerseSelected(false);
      setHighlightPickerOpen(false);
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
      if (activeSecondaryMission && (bookSlug !== activeSecondaryMission.bookSlug || target > activeSecondaryMission.to)) return;
      setChapter(target);
      setSelectedVerse(1);
      setSelectedVerses([]);
      setVerseSelected(false);
      setHighlightPickerOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const index = manifest.books.findIndex((item) => item.slug === book.slug);
    const nextBook = manifest.books[index + 1];
    if (!nextBook || (missionMode && !isMainChapterUnlocked(manifest, updatedProgress, nextBook.slug, 1))) return;
    setBookSlug(nextBook.slug);
    setChapter(1);
    setSelectedVerse(1);
    setSelectedVerses([]);
    setVerseSelected(false);
    setHighlightPickerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const currentVerses = book?.chapters[chapter - 1] ?? [];
  const catholicEdition = translations[translation].canon === "catholic-73";
  const oldTestamentBookCount = catholicEdition ? 46 : 39;
  return (
    <main className={`app-shell rpg-shell ${dark ? "dark" : ""} ${missionMode || activeSecondaryMission ? "mission-active" : ""} ${screen === "journey" ? "journey-surface" : screen === "social" ? "social-surface" : ""}`}>
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
            <button className="avatar level-avatar" onClick={() => go("social")} aria-label={`Abrir Social, nível ${progress.level}`}><b>{progress.level}</b></button>
          </div>
        </header>
      )}

      {screen === "journey" && <JourneyPage manifest={manifest} progress={progress} activeSecondaryMission={activeSecondaryMission} activeSecondaryStatus={activeSecondaryStatus} replayingSecondaryMission={replayingSecondaryMission} onContinue={openMissionBriefing} onContinueSecondary={beginSecondaryMission} onOpenBible={() => { setMissionMode(false); go("bible"); }} onRestoreStreak={() => void restoreStreak()} />}

      {screen === "bible" && (
        <section className="reader page-in" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onClick={(event) => { if (!(event.target as HTMLElement).closest("[data-verse], .verse-tools")) { setSelectedVerses([]); setVerseSelected(false); setHighlightPickerOpen(false); } }}>
          {(missionMode || activeSecondaryMission) && <div className="mission-mode-banner"><div className="mission-disciple" aria-label="Seu Discípulo caminhando"><PixelDisciple level={progress.level} /><small>DISCÍPULO</small></div><div className="mission-reference"><b>{activeSecondaryMission ? replayingSecondaryMission ? "RELEITURA ATIVA" : "MISSÃO SECUNDÁRIA ATIVA" : "JORNADA PRINCIPAL ATIVA"}</b><strong>{activeSecondaryMission ? activeSecondaryMission.title : `${book?.name ?? "Carregando"} ${chapter}`}</strong><small>{activeSecondaryMission ? replayingSecondaryMission ? `Releia Mateus ${activeSecondaryMission.from}–${activeSecondaryMission.to}, sem recompensas adicionais.` : `${activeSecondaryMission.subtitle} · Mateus ${activeSecondaryMission.from}–${activeSecondaryMission.to}` : "Conclua este capítulo para liberar o próximo."}</small></div><button onClick={() => activeSecondaryMission ? go("studies") : (setMissionMode(false), notify("Você voltou à Bíblia livre"))}>{activeSecondaryMission ? "Ver missão" : "Sair da missão"}</button></div>}
          {missionMode && <MissionStoryPanel context={missionForChapter(bookSlug, chapter)} progress={progress} />}
          {activeSecondaryMission && <SecondaryMissionStoryPanel mission={activeSecondaryMission} progress={progress} status={activeSecondaryStatus} />}
          <div className="reference-row">
            <div>
              <p className="eyebrow">{book?.testament === "old" ? `ANTIGO TESTAMENTO · ${oldTestamentBookCount} LIVROS` : "NOVO TESTAMENTO · 27 LIVROS"}</p>
              <h1><button className="reference-button" onClick={() => setBookPicker(true)}>{book?.name ?? "Carregando"} <span>{chapter}⌄</span></button></h1>
            </div>
            <div className="reader-actions">
              <select className="translation" value={translation} onChange={(event) => changeTranslation(event.target.value as Translation)} aria-label="Tradução">
                <option value="BLIVRE">BLIVRE</option><option value="ALMEIDA1819">Almeida 1819</option><option value="CHAMADAFE" disabled={missionMode || Boolean(activeSecondaryMission)}>Chama da Fé · 73</option><option disabled>NVI · licença</option><option disabled>NAA · licença</option><option disabled>ARA · licença</option>
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

          <div className={`canon-note ${catholicEdition ? "catholic" : ""}`}><b>✦ {catholicEdition ? "Cânon católico" : "Cânon protestante"}</b><span>{catholicEdition ? "73 livros · inclui deuterocanônicos" : "66 livros · sem deuterocanônicos"}</span></div>
{book?.isDeuterocanonical && <aside className="deuterocanonical-note" role="note"><b>Livro deuterocanônico</b><span>Este livro integra o cânon católico, mas não o cânon protestante de 66 livros.</span></aside>}
          <div className="license-note"><span>i</span> {translations[translation].note}</div>

          <article className="scripture" style={{ "--reader-size": `${fontSize}px` } as React.CSSProperties}>
            {!book && <div className="reader-loading">Carregando as Escrituras…</div>}
            {currentVerses.map(({ number, text }) => {
              const savedHighlight = progress.highlights?.[`${bookSlug}:${chapter}:${number}`];
              const isSelected = verseSelected && selectedVerses.includes(number);
              const isToolbarAnchor = isSelected && number === selectedVerse;
              const isCameraDetected = recognizedPassage?.bookSlug === bookSlug && recognizedPassage.chapter === chapter && number >= recognizedPassage.startVerse && number <= recognizedPassage.endVerse;
              return <div key={number} className="verse-row">
                {isToolbarAnchor && <div className="verse-tools" aria-label={`Ferramentas para ${book?.name} ${chapter}:${number}`}>
                  <p><b>{selectedVerses.length > 1 ? `${selectedVerses.length} versículos` : `${book?.name} ${chapter}:${number}`}</b><span>{selectedVerses.length > 1 ? "selecionados" : "selecionado"}</span></p>
                  <div>
                    <button onClick={() => setHighlightPickerOpen(!highlightPickerOpen)} className={marked ? "active" : ""} aria-label="Escolher cor da marcação">◒</button>
                    <button onClick={toggleFavorite} className={saved ? "active" : ""} aria-label="Favoritar">{saved ? "♥" : "♡"}</button>
                    <button onClick={openNoteEditor} aria-label="Criar anotação">▱</button>
                    <button onClick={() => navigator.clipboard?.writeText(`${book?.name} ${chapter}:${number} — ${text}`).then(() => notify("Versículo copiado"))} aria-label="Copiar">⧉</button>
                    <button onClick={() => void shareSelection()} aria-label="Compartilhar">↗</button>
                  </div>
                  {highlightPickerOpen && <div className="mobile-highlight-colors" aria-label="Cores da marcação">
                    {[["yellow", "Amarelo"], ["green", "Verde"], ["blue", "Azul"], ["rose", "Rosa"]].map(([color, label]) => <button key={color} className={`mobile-color ${color} ${highlightColor === color && marked ? "active" : ""}`} onClick={() => chooseHighlight(color)} aria-label={`Marcar em ${label.toLowerCase()}`} />)}
                    <button className="mobile-clear-highlight" onClick={clearHighlight}>Limpar</button>
                  </div>}
                </div>}
                <button data-verse={number} className={`verse ${isSelected ? "selected" : ""} ${isCameraDetected ? "camera-detected" : ""} ${savedHighlight ? `marked marked-${savedHighlight}` : ""}`} onClick={() => selectVerse(number)}>
                  <sup>{number}</sup>{text}
                </button>
              </div>;
            })}
          </article>

          {primaryMissionScroll && primaryScrollUnlocked && <MissionInsights insights={[primaryMissionScroll]} chapter={chapter} source="primary" language={book?.testament === "old" ? "hebraico bíblico" : "grego bíblico"} />}
          {insightMission && discoveredSecondaryChapterInsights.length > 0 && <MissionInsights insights={discoveredSecondaryChapterInsights} chapter={chapter} source="secondary" language="grego bíblico" />}

          {(missionMode || Boolean(activeSecondaryMission && activeSecondaryMission.bookSlug === bookSlug && chapter >= activeSecondaryMission.from && chapter <= activeSecondaryMission.to)) && <button className={`chapter-complete ${(replayingSecondaryMission ? replayChapterComplete : progress.completed.includes(`${bookSlug}:${chapter}`)) ? "done" : ""}`} onClick={completeChapter} disabled={savingChapter || (replayingSecondaryMission ? replayChapterComplete : progress.completed.includes(`${bookSlug}:${chapter}`))}>
            <span>{replayingSecondaryMission ? replayChapterComplete ? "✓" : "⚔" : progress.completed.includes(`${bookSlug}:${chapter}`) ? "✓" : "⚔"}</span>
            <div><b>{replayingSecondaryMission ? replayChapterComplete ? "Capítulo relido" : "Marcar capítulo como relido" : progress.completed.includes(`${bookSlug}:${chapter}`) ? "Capítulo concluído" : "Marcar capítulo como lido"}</b><small>{replayingSecondaryMission ? replayChapterComplete ? "Releitura registrada" : "Sem XP ou siclos adicionais" : progress.completed.includes(`${bookSlug}:${chapter}`) ? "Recompensa conquistada" : "+40 XP · +4 siclos de prata"}</small></div>
            <em>{savingChapter ? "…" : "›"}</em>
          </button>}

          <div className="chapter-nav chapter-nav-bottom" aria-label="Navegação no fim do capítulo">
            <button onClick={() => moveChapter(-1)} aria-label="Capítulo anterior">‹ <span>{chapter > 1 ? `${book?.name} ${chapter - 1}` : "Livro anterior"}</span></button>
            <p>Fim do capítulo</p>
            <button onClick={() => moveChapter(1)} aria-label="Próximo capítulo"><span>{book && chapter < book.chapters.length ? `${book.name} ${chapter + 1}` : "Próximo livro"}</span> ›</button>
          </div>

        </section>
      )}

      {screen === "camera" && (
        <section className="camera-screen page-in">
          <div className="camera-head">
            <button onClick={() => go("bible")} aria-label="Fechar">×</button>
            <div><b>Identificar versículo</b><span>OCR · visão bíblica</span></div>
            <HelpButton title="Identificar versículo" text="Enquadre de uma a quatro linhas com boa luz. Você poderá revisar a referência antes de abrir o texto bíblico." />
          </div>
          <div className="viewfinder">
            {cameraState === "live" && <video ref={connectCameraPreview} autoPlay muted playsInline />}
            {(cameraState === "idle" || cameraState === "denied") && (
              <div className="camera-empty"><span>⌁</span><b>{cameraState === "denied" ? "Não foi possível abrir a câmera" : "Encontre a referência em segundos"}</b><p>{cameraState === "denied" ? cameraError || "Envie uma foto da página ou permita o uso da câmera nas configurações." : "Aponte para um trecho bíblico impresso ou em outra tela."}</p><button onClick={openCamera}>Ativar câmera</button></div>
            )}
            {cameraState === "scanning" && <div className="scanning"><i /><b>Lendo o texto...</b><span>Comparando com a base bíblica</span></div>}
            {(cameraState === "found" || cameraState === "uncertain") && recognizedPassage && (
              <div className="found-card">
                <span className="check">✓</span><p>{cameraState === "found" ? "PASSAGEM IDENTIFICADA" : "CONFIRME A PASSAGEM"}</p><h2>{recognizedPassage.bookName} {recognizedPassage.chapter}:{recognizedPassage.startVerse}{recognizedPassage.endVerse > recognizedPassage.startVerse ? `-${recognizedPassage.endVerse}` : ""}</h2><blockquote>“{recognizedPassage.excerpt}”</blockquote><div className="confidence"><span>Correspondência</span><b>{recognizedPassage.confidence}%</b></div>
                {cameraState === "found" ? <><button onClick={() => openRecognizedPassage()}>Abrir na Bíblia</button><small>Abrindo automaticamente… toque para continuar agora</small></> : <><label className="manual-reference"><span>Referência correta</span><input value={manualReference} onChange={(event) => setManualReference(event.target.value)} placeholder="Ex.: João 3:16" /></label><button onClick={confirmManualReference}>Confirmar passagem</button>{recognitionOptions.length > 0 && <div className="ocr-options">{recognitionOptions.map((candidate) => <button key={`${candidate.bookSlug}:${candidate.chapter}:${candidate.startVerse}`} className="secondary" onClick={() => openRecognizedPassage(candidate)}>{candidate.bookName} {candidate.chapter}:{candidate.startVerse}</button>)}</div>}</>}
              </div>
            )}
            {cameraState === "uncertain" && !recognizedPassage && (
              <div className="found-card manual-card"><span className="check">⌕</span><p>INFORME A REFERÊNCIA</p><h2>Vamos abrir o trecho certo</h2><blockquote>Digite o livro, capítulo e versículo que você está lendo.</blockquote><label className="manual-reference"><span>Referência bíblica</span><input value={manualReference} onChange={(event) => setManualReference(event.target.value)} placeholder="Ex.: João 3:16-17" autoFocus /></label><button onClick={confirmManualReference}>Abrir na Bíblia</button></div>
            )}
            {cameraState === "retry" && <div className="found-card retry-card"><span className="check">!</span><p>NÃO CONSEGUIMOS LER COM SEGURANÇA</p><h2>Tente novamente</h2><blockquote>Melhore a luz, aproxime o texto e mantenha a página imóvel.</blockquote>{ocrPreview && <small className="ocr-preview">Texto lido: “{ocrPreview.slice(0, 95)}”</small>}<button onClick={() => setCameraState("live")}>Tentar de novo</button><button className="secondary" onClick={() => setCameraState("uncertain")}>Informar referência</button></div>}
            {cameraState === "live" && <div className="focus-corners"><i /><i /><i /><i /></div>}
            {cameraState === "live" && <div className="scan-hint">Enquadre apenas o trecho principal</div>}
          </div>
          <div className="camera-controls">
            <label className="upload">▧<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void scan(file); }} /><span>Galeria</span></label>
            <button className="shutter" onClick={() => void scan()} disabled={cameraState !== "live"}><i /></button>
          </div>
          <p className="prototype-note">O texto é processado no seu dispositivo e comparado com a Bíblia disponível no app.</p>
        </section>
      )}

      {screen === "result" && <StudyResult translation={translation} setTranslation={changeTranslation} saved={saved} setSaved={setSaved} notify={notify} />}
      {screen === "studies" && <StudiesPage manifest={manifest} progress={progress} secondaryMissionStates={secondaryMissionStates} onStart={openMissionBriefing} onUnlockSecondary={unlockSecondaryMission} onContinueSecondary={beginSecondaryMission} onRestartSecondary={restartSecondaryMission} />}
      {screen === "plans" && <PlansPage />}
      {screen === "social" && <SocialPage notify={notify} dark={dark} setDark={setDark} progress={progress} manifest={manifest} onOpenFavorite={openFavorite} onProfilePhotoChange={updateProfilePhoto} onDisplayNameChange={updateDisplayName} />}

      {screen !== "camera" && (
        <nav className="bottom-nav" aria-label="Navegação principal">
          <button className={screen === "journey" ? "selected" : ""} onClick={() => go("journey")}><span>♜</span>Jornada</button>
          <button className={screen === "bible" ? "selected" : ""} onClick={() => go("bible")}><span>▥</span>Bíblia</button>
          <button className="camera" onClick={() => { if (go("camera")) void openCamera(); }}><i>⌁</i><span>Câmera</span></button>
          <button className={`social-nav ${screen === "social" ? "selected" : ""}`} onClick={() => go("social")}><span className="social-nav-icon" aria-hidden="true"><i /><i /></span>Social</button>
          <button className={screen === "studies" || screen === "result" ? "selected" : ""} onClick={() => go("studies")}><span>✧</span>Missões</button>
        </nav>
      )}

      {bookPicker && manifest && <BookPicker manifest={manifest} currentSlug={bookSlug} currentChapter={chapter} close={() => setBookPicker(false)} choose={chooseBook} />}
      {searchOpen && <SearchOverlay manifest={manifest} close={() => setSearchOpen(false)} choose={chooseBook} open={() => { setSearchOpen(false); go("result"); }} />}
      {missionBriefingOpen && <MissionBriefing manifest={manifest} progress={progress} start={beginMission} close={() => setMissionBriefingOpen(false)} />}
      {secondaryBriefingId && secondaryMissionById(secondaryBriefingId) && <SecondaryMissionBriefing mission={secondaryMissionById(secondaryBriefingId)!} progress={progress} status={secondaryMissionStates.find((mission) => mission.id === secondaryBriefingId)} start={beginSecondaryMission} close={() => setSecondaryBriefingId(null)} />}
      {leaveMissionDialog && <div className="leave-mission-backdrop" role="presentation"><section className="leave-mission-dialog" role="dialog" aria-modal="true" aria-label="Sair da missão"><p>MISSÃO EM ANDAMENTO</p><h2>Deseja sair da missão?</h2><span>Seu progresso fica salvo e você poderá continuar mais tarde pela aba Missões.</span><div><button className="secondary" onClick={() => { setLeaveMissionDialog(false); setPendingScreen(null); }}>Continuar missão</button><button onClick={() => void leaveActiveMission()}>Sair da missão</button></div></section></div>}
      {noteEditorOpen && <div className="note-overlay" role="dialog" aria-modal="true" aria-label="Nova anotação"><section><button className="note-close" onClick={() => setNoteEditorOpen(false)} aria-label="Fechar">×</button><p className="eyebrow">ANOTAÇÃO PESSOAL</p><h2>{book?.name} {chapter}:{selectedVerses[0] || selectedVerse}{selectedVerses.length > 1 ? `-${selectedVerses.at(-1)}` : ""}</h2><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="O que Deus falou com você neste trecho?" autoFocus /><div><button className="secondary-note" onClick={() => { setNoteDraft(""); }}>Limpar</button><button className="save-note" onClick={saveNote}>Salvar anotação</button></div></section></div>}
      {toast && <div className="toast">✓ {toast}</div>}
      {developerGift && <DeveloperGiftModal gift={developerGift} close={() => void claimDeveloperGift()} />}
      {scrollDiscovery && <ScrollDiscoveryModal discovery={scrollDiscovery} close={() => setScrollDiscovery(null)} />}
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

function JourneyPage({ manifest, progress, activeSecondaryMission, activeSecondaryStatus, replayingSecondaryMission, onContinue, onContinueSecondary, onOpenBible, onRestoreStreak }: { manifest: BibleManifest | null; progress: PlayerProgress; activeSecondaryMission: SecondaryMission | null; activeSecondaryStatus: SecondaryMissionStatus | null; replayingSecondaryMission: boolean; onContinue: () => void; onContinueSecondary: (mission: SecondaryMission) => void; onOpenBible: () => void; onRestoreStreak: () => void }) {
  const completedCount = progress.completed.length;
  const noteCompleted = Boolean(progress.dailyNoteCompleted);
  const xpProgress = getXpProgress(progress.xp);
  const mission = nextMainMission(manifest, progress);
  const secondaryProgress = activeSecondaryMission ? secondaryStatusProgress(activeSecondaryMission, progress, activeSecondaryStatus) : null;
  const milestones = campaignActs.map((act, index) => {
    const complete = isActComplete(act, progress.completed);
    const previousComplete = index === 0 || isActComplete(campaignActs[index - 1], progress.completed);
    return { name: `Ato ${act.number}`, icon: index === campaignActs.length - 1 ? "★" : "✦", state: complete ? "complete" : previousComplete ? "current" : "locked", detail: act.title };
  });
  return <section className="journey-page page-in">
    <div className="player-hud">
      <div className="crest-wrap"><div className="crest">{progress.profilePhoto ? <ProfilePhoto src={progress.profilePhoto} /> : <span aria-label="Foto do perfil não adicionada">{(progress.displayName || "?").slice(0, 1).toUpperCase()}</span>}</div><i className="crest-level">{progress.level}</i></div>
      <div className="player-level"><p>{discipleTitle(xpProgress.level).toUpperCase()} · NÍVEL {xpProgress.level}</p><h1>Sua jornada na Palavra</h1><div className="xp-track"><i style={{ width: `${xpProgress.progress}%` }} /></div><small>{xpProgress.isMaxLevel ? "NÍVEL MÁXIMO · 50" : `${xpProgress.current - xpProgress.currentLevelXp} / ${xpProgress.needed} XP para o próximo nível`}</small></div>
      <div className="streak"><b>🔥 {progress.streak}</b><span>dias</span></div>
    </div>

    <article className={`active-quest ${activeSecondaryMission ? "secondary-active-quest" : ""}`}>
      <div className="quest-glow" />
      <p><span>{activeSecondaryMission ? replayingSecondaryMission ? "RELEITURA ATIVA" : "MISSÃO SECUNDÁRIA ATIVA" : "MISSÃO ATUAL"}</span><b>{activeSecondaryMission ? replayingSecondaryMission ? "SEM NOVO XP" : `+${activeSecondaryMission.completionXp} XP` : "+40 XP"}</b></p>
      <h2>{activeSecondaryMission?.title || "A Grande História"}</h2>
      <blockquote>{activeSecondaryMission ? activeSecondaryMission.subtitle : mission ? `Continue pela Palavra em ${mission.name} ${mission.chapter}.` : "Você concluiu a missão principal."}</blockquote>
      <div><span>{activeSecondaryMission && secondaryProgress ? `${secondaryProgress.done}/${secondaryProgress.total} capítulos · ${activeSecondaryMission.bookSlug === "mat" ? "Mateus" : activeSecondaryMission.bookSlug} ${activeSecondaryMission.from}–${activeSecondaryMission.to}` : mission ? `${mission.name} ${mission.chapter} · próximo capítulo` : "Missão concluída"}</span><button onClick={() => activeSecondaryMission ? onContinueSecondary(activeSecondaryMission) : onContinue()} disabled={!activeSecondaryMission && !mission}>{activeSecondaryMission ? "Continuar missão" : mission ? "Continuar missão" : "Jornada concluída"} →</button></div>
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
      <article className={progress.missedStreakDays ? "streak-paused" : ""}><i>🔥</i><div><b>Mantenha a chama acesa <HelpButton title="Como funciona a chama" text="Conclua pelo menos um capítulo por dia. A cada 10 dias de leitura, você ganha mais 1% de XP em todas as recompensas, até +30%. Se perder dias, o bônus zera; restaure-os por 100 siclos de prata cada." /></b><span>{progress.streak} {progress.streak === 1 ? "dia consecutivo" : "dias consecutivos"} de leitura{progress.missedStreakDays ? <small>{progress.missedStreakDays} {progress.missedStreakDays === 1 ? "dia perdido" : "dias perdidos"} · 100 siclos de prata por dia</small> : null}</span></div>{progress.missedStreakDays ? <button className="streak-restore" onClick={onRestoreStreak}>Restaurar<br /><b>◆ {progress.missedStreakDays * 100}</b></button> : <strong>+{progress.xpBonusPercent ?? 0}% XP</strong>}</article>
      <article className={noteCompleted ? "complete" : ""}><i>✎</i><div><b>Medite na Palavra</b><span>{noteCompleted ? "1/1 concluído" : "Crie uma anotação"}<u><em style={{ width: noteCompleted ? "100%" : "0%" }} /></u></span></div><strong>+15 XP</strong></article>
    </div>
  </section>;
}

function actProgress(act: (typeof campaignActs)[number], completed: string[]) {
  const completedSet = new Set(completed);
  const total = act.ranges.reduce((sum, range) => sum + range.to - range.from + 1, 0);
  const done = act.ranges.reduce((sum, range) => sum + Array.from({ length: range.to - range.from + 1 }, (_, index) => completedSet.has(`${range.slug}:${range.from + index}`) ? 1 : 0).reduce((count, value) => count + value, 0), 0);
  return { done, total, percent: total ? Math.round(done / total * 100) : 0 };
}

function stageProgress(mission: (typeof campaignActs)[number]["missions"][number], completed: string[]) {
  const completedSet = new Set(completed);
  const total = mission.to - mission.from + 1;
  const done = Array.from({ length: total }, (_, index) => completedSet.has(`${mission.slug}:${mission.from + index}`) ? 1 : 0).reduce((count, value) => count + value, 0);
  return { done, total, percent: total ? Math.round(done / total * 100) : 0 };
}

function MissionBriefing({ manifest, progress, start, close }: { manifest: BibleManifest | null; progress: PlayerProgress; start: () => void; close: () => void }) {
  const next = nextMainMission(manifest, progress);
  const context = next ? missionForChapter(next.slug, next.chapter) : null;
  if (!next || !context) return null;
  const narrative = narrativeForMission(context.mission);
  const missionIndex = context.act.missions.findIndex((mission) => mission.title === context.mission.title) + 1;
  const progressInAct = actProgress(context.act, progress.completed);
  const progressInStage = stageProgress(context.mission, progress.completed);
  const book = manifest?.books.find((item) => item.slug === next.slug);
  return <div className="mission-briefing-backdrop" role="dialog" aria-modal="true" aria-label="Abertura da jornada"><section className="mission-briefing"><button className="mission-briefing-close" onClick={close} aria-label="Fechar">×</button><PixelDisciple level={progress.level} /><p>JORNADA: A GRANDE HISTÓRIA</p><span>ATO {context.act.number} · {context.act.title}</span><h1>Missão {missionIndex} — {context.mission.title}</h1><div className="mission-progress mission-progress-stage"><span>MISSÃO ATUAL · {progressInStage.done} de {progressInStage.total} capítulos bíblicos</span><i><b style={{ width: `${progressInStage.percent}%` }} /></i></div><div className="mission-progress"><span>ATO · {progressInAct.done} de {progressInAct.total} capítulos bíblicos</span><i><b style={{ width: `${progressInAct.percent}%` }} /></i></div><blockquote>{narrative.introduction}</blockquote><div className="mission-briefing-ref"><small>LEITURA DE HOJE</small><b>{book?.name || next.slug} {next.chapter}</b></div><button className="mission-begin-button" onClick={start}>Começar jornada <b>→</b></button></section></div>;
}

function SecondaryMissionBriefing({ mission, progress, status, start, close }: { mission: SecondaryMission; progress: PlayerProgress; status?: SecondaryMissionStatus; start: (mission: SecondaryMission) => void; close: () => void }) {
  const replaying = Boolean(status?.replaying);
  const missionProgress = secondaryStatusProgress(mission, progress, status);
  return <div className="mission-briefing-backdrop" role="dialog" aria-modal="true" aria-label={`Abertura da missão ${mission.title}`}><section className="mission-briefing secondary-mission-briefing"><button className="mission-briefing-close" onClick={close} aria-label="Fechar">×</button><PixelDisciple level={progress.level} /><p>{replaying ? "JORNADA ESPECIAL · RELEITURA" : "JORNADA ESPECIAL · 400 SICLOS DE PRATA"}</p><span>{mission.subtitle}</span><h1>{mission.title}</h1><div className="mission-progress mission-progress-stage"><span>CAPÍTULOS PARA CONCLUSÃO · {missionProgress.done} de {missionProgress.total}</span><i><b style={{ width: `${missionProgress.percent}%` }} /></i></div><blockquote>{mission.introduction}</blockquote><div className="mission-briefing-ref"><small>{replaying ? "RELEITURA DA MISSÃO" : "RECOMPENSA DA MISSÃO"}</small><b>{replaying ? "Reviva toda a jornada · sem XP ou siclos adicionais" : `+${mission.completionXp} XP · +${mission.completionCoins} siclos`}</b></div><div className="secondary-briefing-note"><b>O que você vai encontrar</b><span>Bem-aventuranças, oração, confiança no Pai e a vida construída sobre a rocha.</span></div><button className="mission-begin-button" onClick={() => start(mission)}>{replaying ? "Começar releitura" : "Começar Sermão do Monte"} <b>→</b></button></section></div>;
}

function MissionStoryPanel({ context, progress }: { context: ReturnType<typeof missionForChapter>; progress: PlayerProgress }) {
  if (!context) return null;
  const narrative = narrativeForMission(context.mission);
  const index = context.act.missions.findIndex((mission) => mission.title === context.mission.title) + 1;
  const progressInAct = actProgress(context.act, progress.completed);
  const progressInStage = stageProgress(context.mission, progress.completed);
  return <aside className="mission-story-panel"><div><p>MISSÃO {index} DE {context.act.missions.length} · ATO {context.act.number}</p><h2>{context.mission.title}</h2><span>{narrative.introduction}</span></div><div className="mission-story-progress"><div className="mission-stage-progress"><small>CAPÍTULOS PARA CONCLUSÃO <HelpButton title="Capítulos para conclusão" text="Marque os capítulos da missão como lidos para avançar. Ao concluir todos, a próxima missão é liberada." /></small><b>{progressInStage.done}/{progressInStage.total}</b><i><em style={{ width: `${progressInStage.percent}%` }} /></i></div><div><small>ATO</small><b>{progressInAct.done}/{progressInAct.total}</b><i><em style={{ width: `${progressInAct.percent}%` }} /></i></div></div><blockquote><small>CONTEXTO HISTÓRICO</small>{narrative.historicalContext}</blockquote></aside>;
}

function MissionInsights({ insights, chapter, source, language }: { insights: SecondaryMission["insights"][number]; chapter: number; source: "primary" | "secondary"; language: "hebraico bíblico" | "grego bíblico" }) {
  const [open, setOpen] = useState(false);
  const collection = source === "primary" ? "GRANDE JORNADA" : "MISSÃO SECUNDÁRIA";
  return <aside className={`mission-insights mission-scrolls ${source}-scroll ${open ? "open" : ""}`}><button onClick={() => setOpen(!open)} aria-expanded={open}><span className="scroll-mark">▤</span><div><small>PERGAMINHOS · {collection} · CAPÍTULO {chapter}</small><b>{open ? "Recolher pergaminhos" : `${insights.length} ${insights.length === 1 ? "pergaminho descoberto" : "pergaminhos descobertos"}`}</b></div><i>{open ? "−" : "+"}</i></button>{open && <div className="mission-insight-list">{insights.map((insight) => <article key={insight.title} className="original-word"><small>{insight.kind} · {insight.reference}</small><h3>{insight.title}</h3><div className="original-language"><b>{insight.original}</b><span>Transliteração · {insight.transliteration}</span><em><small>Significado no {language}</small>{insight.meaning}</em></div><p>{insight.content}</p></article>)}</div>}</aside>;
}

function SecondaryMissionStoryPanel({ mission, progress, status }: { mission: SecondaryMission; progress: PlayerProgress; status: SecondaryMissionStatus | null }) {
  const missionProgress = secondaryStatusProgress(mission, progress, status);
  const replaying = Boolean(status?.replaying);
  return <aside className="mission-story-panel secondary-mission-story"><div><p>{replaying ? "JORNADA ESPECIAL · RELEITURA" : "JORNADA ESPECIAL · MISSÃO SECUNDÁRIA"}</p><h2>{mission.title}</h2><span>{mission.introduction}</span></div><div className="mission-story-progress"><div className="mission-stage-progress"><small>CAPÍTULOS PARA CONCLUSÃO <HelpButton title="Missão secundária" text={replaying ? `Leia novamente Mateus ${mission.from} a ${mission.to}. Esta releitura não concede XP nem siclos adicionais.` : `Leia Mateus ${mission.from} a ${mission.to}. Ao concluir os ${missionProgress.total} capítulos, você recebe a recompensa especial de +${mission.completionXp} XP.`} /></small><b>{missionProgress.done}/{missionProgress.total}</b><i><em style={{ width: `${missionProgress.percent}%` }} /></i></div></div><blockquote><small>CONTEXTO DA JORNADA</small>{mission.historicalContext}</blockquote></aside>;
}

function RewardModal({ reward, level, close }: { reward: ChapterReward; level: number; close: () => void }) {
  const completedMission = reward.missionTitle ? campaignActs.flatMap((act) => act.missions).find((mission) => mission.title === reward.missionTitle) : undefined;
  const secondaryMission = reward.secondaryMissionCompleted || reward.replayCompleted ? secondaryMissions.find((mission) => mission.title === reward.missionTitle) : undefined;
  const narrative = completedMission ? narrativeForMission(completedMission) : secondaryMission || null;
  return <div className="reward-backdrop"><div className="reward-modal" role="dialog" aria-modal="true" aria-label="Recompensa da missão"><div className="reward-rays" /><span className="reward-chest">♛</span><p>{reward.replayCompleted ? `RELEITURA CONCLUÍDA · ${reward.missionTitle}` : reward.actCompleted ? `ATO CONCLUÍDO · ${reward.actTitle}` : reward.missionCompleted ? `MISSÃO CONCLUÍDA · ${reward.missionTitle}` : reward.levelUp ? "NOVO NÍVEL ALCANÇADO" : "CAPÍTULO CONCLUÍDO"}</p><h2>{reward.replayCompleted ? "Jornada revisitada" : reward.levelUp ? `Nível ${level}` : "Recompensa obtida"}</h2>{reward.replayCompleted ? <div><b>SEM<small>XP ADICIONAL</small></b><b>SEM<small>SICLOS ADICIONAIS</small></b></div> : <div><b>+{reward.xp}<small>XP</small></b><b>+{reward.coins}<small>SICLOS DE PRATA</small></b></div>}{reward.scrollsUnlocked ? <blockquote className="mission-reveal scroll-discovery-reveal"><b>{reward.firstScrollDiscovery ? "Seu primeiro pergaminho foi encontrado!" : `${reward.scrollsUnlocked} ${reward.scrollsUnlocked === 1 ? "pergaminho foi encontrado" : "pergaminhos foram encontrados"}!`}</b><span>{reward.firstScrollDiscovery ? "Há diversos pergaminhos de estudo espalhados pela Bíblia. Continue sua jornada e permita que novas descobertas se revelem." : `+${reward.scrollXp || reward.scrollsUnlocked * 20} XP · A descoberta foi guardada na sua Bíblia.`}</span></blockquote> : null}{narrative && <blockquote className="mission-reveal"><b>{narrative.discovery}</b><span>{narrative.next}</span></blockquote>}{reward.unlocked.length > 0 && <em>✦ Nova conquista desbloqueada</em>}<button onClick={close}>Continuar jornada</button></div></div>;
}

function ScrollDiscoveryModal({ discovery, close }: { discovery: ScrollDiscovery; close: () => void }) {
  return <div className="reward-backdrop"><div className="reward-modal" role="dialog" aria-modal="true" aria-label="Pergaminho encontrado"><div className="reward-rays" /><span className="reward-chest">▤</span><p>PERGAMINHO DESCOBERTO</p><h2>{discovery.first ? "Uma descoberta começa" : "Nova descoberta guardada"}</h2><div><b>+{discovery.xp}<small>XP</small></b></div><blockquote className="mission-reveal scroll-discovery-reveal"><b>{discovery.count === 1 ? "Um pergaminho foi encontrado!" : `${discovery.count} pergaminhos foram encontrados!`}</b><span>{discovery.first ? "Há diversos pergaminhos de estudo espalhados pela Bíblia. Continue sua jornada e permita que novas descobertas se revelem." : "Este pergaminho agora está disponível na sua Bíblia."}</span></blockquote><button onClick={close}>Guardar descoberta</button></div></div>;
}

function DeveloperGiftModal({ gift, close }: { gift: DeveloperGift; close: () => void }) {
  return <div className="reward-backdrop"><div className="reward-modal" role="dialog" aria-modal="true" aria-label="Presente do desenvolvedor"><div className="reward-rays" /><span className="reward-chest">✦</span><p>PRESENTE DO DESENVOLVEDOR</p><h2>Você ganhou {gift.amount.toLocaleString("pt-BR")} siclos de prata!</h2><div><b>+{gift.amount.toLocaleString("pt-BR")}<small>SICLOS DE PRATA</small></b></div><blockquote className="mission-reveal"><b>Obrigado por usar o VERBO.</b><span>{gift.message}</span></blockquote><button onClick={close}>Receber com gratidão</button></div></div>;
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
        <div className="study-ref"><h1>João 3:16</h1><select value={translation} onChange={(e) => setTranslation(e.target.value as Translation)}><option value="BLIVRE">BLIVRE</option><option value="ALMEIDA1819">Almeida 1819</option><option value="CHAMADAFE">Chama da Fé · 73</option><option disabled>NAA · licença</option><option disabled>NVI · licença</option></select></div>
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
        {tab === "comparar" && <div className="compare-list"><p className="license-note"><span>i</span> Três edições abertas disponíveis para comparação.</p>{(Object.keys(translations) as Translation[]).map((code) => <article key={code}><b>{translations[code].label}<small>{translations[code].license}</small></b><p>{comparison?.[code] ?? "Carregando…"}</p></article>)}</div>}
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

function StudiesPage({ manifest, progress, secondaryMissionStates, onStart, onUnlockSecondary, onContinueSecondary, onRestartSecondary }: { manifest: BibleManifest | null; progress: PlayerProgress; secondaryMissionStates: SecondaryMissionStatus[]; onStart: () => void; onUnlockSecondary: (missionId: string) => void; onContinueSecondary: (mission: SecondaryMission) => void; onRestartSecondary: (mission: SecondaryMission) => void }) {
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
  const currentMissionIndex = act.missions.findIndex((mission) => !isCampaignMissionComplete(mission, progress.completed));
  const currentMission = act.missions[currentMissionIndex === -1 ? act.missions.length - 1 : currentMissionIndex];

  return <section className="generic-page missions-page page-in">
    <div className="missions-intro"><p className="eyebrow">SUA TRILHA DE APRENDIZADO</p><h1>Missão principal</h1><p className="lead">Avance pela história completa das Escrituras, lendo cada capítulo e registrando seu progresso.</p></div>
    <section className="campaign-overview">
      <div className="campaign-heading"><div><p className="eyebrow">MISSÃO ATUAL · {missionChapters(currentMission)}</p><h2>{currentMission.title}</h2></div><span className="campaign-status">{isActComplete(act, progress.completed) ? "CONCLUÍDO" : "EM ANDAMENTO"}</span></div>
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
    <section className="secondary-missions"><div className="campaign-heading"><div><p className="eyebrow">CONTEÚDO OPCIONAL</p><h2>Missões secundárias</h2></div><span className="campaign-status">ESPECIAIS</span></div><p>Jornadas curtas, cuidadosamente preparadas para aprofundar grandes trechos das Escrituras. Desbloqueie com siclos de prata e receba a mesma recompensa de conclusão da missão principal.</p><div className="secondary-mission-list">{secondaryMissions.map((mission) => { const state = secondaryMissionStates.find((item) => item.id === mission.id); const status = secondaryStatusProgress(mission, progress, state); const active = Boolean(state?.active); const complete = Boolean(state?.completed); const replaying = Boolean(state?.replaying); return <article key={mission.id} className={`${active ? "active" : ""} ${complete ? "complete" : ""}`}><div className="secondary-mission-icon">✦</div><div><small>{replaying ? "RELEITURA ATIVA · SEM NOVO XP" : active ? "MISSÃO ATIVA" : complete ? "JORNADA CONCLUÍDA · RELEITURA DISPONÍVEL" : state?.unlocked ? "DESBLOQUEADA" : `DESBLOQUEAR · ◆ ${mission.cost}`}</small><h3>{mission.title}</h3><p>{mission.subtitle}</p><span>Mateus {mission.from}–{mission.to} · {status.total} capítulos · {complete ? "releitura sem recompensa adicional" : `+${mission.completionXp} XP na primeira conclusão`}</span>{(state?.unlocked || complete) && <i><em style={{ width: `${status.percent}%` }} /></i>}</div><button onClick={() => !state?.unlocked ? onUnlockSecondary(mission.id) : complete && !active ? onRestartSecondary(mission) : onContinueSecondary(mission)}>{replaying ? "Continuar releitura" : active ? "Continuar" : complete ? "Reler missão" : "Iniciar"}</button></article>; })}</div></section>
  </section>;
}

function PlansPage() {
  return <section className="generic-page page-in"><p className="eyebrow">CRESÇA UM DIA DE CADA VEZ</p><h1>Planos</h1><p className="lead">Leituras breves para criar constância e aprofundar sua fé.</p><div className="progress-card"><span>PLANO ATUAL</span><h2>João em 21 dias</h2><p>Dia 4 de 21 · João 3</p><div><i style={{ width: "19%" }} /></div><button>Continuar leitura →</button></div><h3 className="list-heading">Para começar</h3><div className="plan-list"><article><i>7</i><div><b>Uma semana com os Salmos</b><span>7 dias · 8 min/dia</span></div><button>＋</button></article><article><i>14</i><div><b>Aprendendo a confiar</b><span>14 dias · 10 min/dia</span></div><button>＋</button></article></div></section>;
}

type SocialContact = { publicHandle: string; displayName: string; profilePhoto: string };
type FriendRequest = SocialContact & { id: number; createdAt: number };
type SharedSocialNote = { id: number; activityId: number; reference: string; text: string; createdAt: number; noteCreatedAt: number; reactions: { amen: number; celebrate: number; viewer?: "amen" | "celebrate" } };
type SocialProfile = {
  publicHandle: string;
  relationship: "self" | "friend" | "none";
  profileVisible: boolean;
  canSendFriendRequest: boolean;
  displayName?: string;
  profilePhoto?: string;
  progress?: { level: number; xp: number; streak: number };
  campaign?: { actNumber: number; actTitle: string; missionTitle: string; done: number; total: number; percent: number; completedActs: number; totalActs: number; completedChapters: number; totalChapters: number };
  stats?: { completedChapters: number; favoriteVerses: number; notes: number };
  favorites?: string[];
  secondaryMissions?: { completed: number; total: number; xp: number; missions: { id: string; title: string; completedAt: number }[] };
  notes?: SharedSocialNote[];
};
type SocialData = { friends: SocialContact[]; requests: { incoming: FriendRequest[]; outgoing: FriendRequest[] } };
type FeedActivity = { id: number; kind: "mission_completed" | "chapter_completed" | "streak_milestone" | "achievement_unlocked"; category?: "note_shared"; title: string; detail: string; reference?: string; createdAt: number; actor: SocialContact; reactions: { amen: number; celebrate: number; viewer?: "amen" | "celebrate" } };
type SocialPrivacy = { publicHandle: string; showActivities: boolean; profileVisibility: "friends" | "private"; showProgress: boolean; showFavorites: boolean; showNotes: boolean; showStats: boolean; allowFriendRequests: boolean };
type SocialNotification = { id: number; kind: "friend_request" | "friend_accepted" | "reaction"; createdAt: number; read: boolean; actor: SocialContact; activityTitle?: string };

const emptySocial: SocialData = { friends: [], requests: { incoming: [], outgoing: [] } };

function SocialAvatar({ contact, small = false }: { contact: Pick<SocialContact, "displayName" | "profilePhoto">; small?: boolean }) {
  return <span className={`social-avatar ${small ? "small" : ""}`}>{contact.profilePhoto ? <ProfilePhoto src={contact.profilePhoto} /> : contact.displayName.slice(0, 1).toUpperCase()}</span>;
}

function socialReference(reference: string, manifest: BibleManifest | null) {
  const [slug, chapter, verse] = reference.split(":");
  return `${manifest?.books.find((book) => book.slug === slug)?.name || slug} ${chapter}:${verse}`;
}

function SharedNotesManager({ notes, sharedNotes, manifest, working, onShare, onOpen }: { notes: [string, string][]; sharedNotes: SharedSocialNote[]; manifest: BibleManifest | null; working: boolean; onShare: (reference: string, action: "share" | "unshare") => void; onOpen: (reference: string) => void }) {
  const shared = new Set(sharedNotes.map((note) => note.reference));
  return <section className="social-note-manager"><div className="social-section-title"><div><p className="eyebrow">ANOTAÇÕES COMPARTILHADAS</p><h2>Palavras que edificam</h2></div><span>{shared.size}</span></div><p>Escolha reflexões da sua biblioteca para que seus amigos possam ler, abrir o trecho bíblico e reagir.</p>{notes.length ? <div>{notes.map(([reference, text]) => <article key={reference}><button className="social-shared-note-copy" onClick={() => onOpen(reference)}><small>{socialReference(reference, manifest)}</small><b>{text}</b><span>Abrir na Bíblia ›</span></button><button className={shared.has(reference) ? "shared" : ""} disabled={working} onClick={() => onShare(reference, shared.has(reference) ? "unshare" : "share")}>{shared.has(reference) ? "Remover" : "Compartilhar"}</button></article>)}</div> : <div className="social-notes-empty">Suas anotações pessoais aparecerão aqui quando você as criar na Bíblia.</div>}</section>;
}

function SocialPage({ notify, dark, setDark, progress, manifest, onOpenFavorite, onProfilePhotoChange, onDisplayNameChange }: { notify: (message: string) => void; dark: boolean; setDark: (value: boolean) => void; progress: PlayerProgress; manifest: BibleManifest | null; onOpenFavorite: (reference: string) => void; onProfilePhotoChange: (file: File) => void; onDisplayNameChange: (displayName: string) => Promise<boolean> }) {
  const [data, setData] = useState<SocialData>(emptySocial);
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<SocialContact[]>([]);
  const [sharedNotes, setSharedNotes] = useState<SharedSocialNote[]>([]);
  const [privacy, setPrivacy] = useState<SocialPrivacy | null>(null);
  const [publicHandle, setPublicHandle] = useState("");
  const [query, setQuery] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<SocialProfile | null>(null);
  const [accountView, setAccountView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [feedOrder, setFeedOrder] = useState<"recent" | "celebrated">("recent");

  const loadSocial = useCallback(async () => {
    const [friendsResponse, privacyResponse, feedResponse, notificationsResponse, blocksResponse, notesResponse] = await Promise.all([fetch("/api/social/friends"), fetch("/api/social/privacy"), fetch("/api/social/feed"), fetch("/api/social/notifications"), fetch("/api/social/blocks"), fetch("/api/social/notes")]);
    if (friendsResponse.ok) setData(await friendsResponse.json() as SocialData);
    if (privacyResponse.ok) {
      const nextPrivacy = await privacyResponse.json() as SocialPrivacy;
      setPrivacy(nextPrivacy);
      setPublicHandle(nextPrivacy.publicHandle || "");
    }
    if (feedResponse.ok) setActivities((await feedResponse.json() as { activities?: FeedActivity[] }).activities || []);
    if (notificationsResponse.ok) setNotifications((await notificationsResponse.json() as { notifications?: SocialNotification[] }).notifications || []);
    if (blocksResponse.ok) setBlockedUsers((await blocksResponse.json() as { blocked?: SocialContact[] }).blocked || []);
    if (notesResponse.ok) setSharedNotes((await notesResponse.json() as { notes?: SharedSocialNote[] }).notes || []);
  }, []);

  useEffect(() => {
    void loadSocial().catch(() => undefined).finally(() => setLoading(false));
  }, [loadSocial]);

  const openProfile = async (handle: string) => {
    const normalized = handle.trim().toLowerCase();
    if (!normalized) return;
    if (normalized === publicHandle) {
      setAccountView(true);
      return;
    }
    setWorking(true);
    setProfileError("");
    try {
      const response = await fetch(`/api/social/profiles/${encodeURIComponent(normalized)}`);
      const next = await response.json() as SocialProfile & { error?: string };
      if (!response.ok) throw new Error(next.error || "Perfil não encontrado");
      setSelectedProfile(next);
    } catch (error) {
      setSelectedProfile(null);
      setProfileError(error instanceof Error ? error.message : "Perfil não encontrado");
    } finally {
      setWorking(false);
    }
  };

  const sendRequest = async (handle: string) => {
    setWorking(true);
    try {
      const response = await fetch("/api/social/friends", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ publicHandle: handle }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar o pedido");
      notify("Pedido de amizade enviado");
      await loadSocial();
      if (selectedProfile) await openProfile(selectedProfile.publicHandle);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível enviar o pedido");
    } finally {
      setWorking(false);
    }
  };

  const answerRequest = async (requestId: number, action: "accept" | "decline" | "cancel") => {
    setWorking(true);
    try {
      const response = await fetch(`/api/social/friends/requests/${requestId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o pedido");
      notify(action === "accept" ? "Amizade confirmada" : action === "decline" ? "Pedido recusado" : "Pedido cancelado");
      await loadSocial();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível atualizar o pedido");
    } finally {
      setWorking(false);
    }
  };

  const copyHandle = async () => {
    try {
      await navigator.clipboard?.writeText(publicHandle);
      notify("Identificador copiado");
    } catch {
      notify("Copie seu identificador: " + publicHandle);
    }
  };

  const reactToActivity = async (activity: FeedActivity, reaction: "amen" | "celebrate") => {
    setWorking(true);
    try {
      const nextReaction = activity.reactions.viewer === reaction ? null : reaction;
      const response = await fetch(`/api/social/activities/${activity.id}/reaction`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ reaction: nextReaction }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível registrar a reação");
      await loadSocial();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível registrar a reação");
    } finally {
      setWorking(false);
    }
  };

  const updateActivityPrivacy = async (showActivities: boolean) => {
    setWorking(true);
    try {
      const response = await fetch("/api/social/privacy", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ showActivities }) });
      const next = await response.json() as SocialPrivacy & { error?: string };
      if (!response.ok) throw new Error(next.error || "Não foi possível salvar a preferência");
      setPrivacy(next);
      notify(showActivities ? "Novas atividades serão compartilhadas com amigos" : "Novas atividades ficarão privadas");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível salvar a preferência");
    } finally {
      setWorking(false);
    }
  };

  const reactToSharedNote = async (note: SharedSocialNote, reaction: "amen" | "celebrate") => {
    setWorking(true);
    try {
      const nextReaction = note.reactions.viewer === reaction ? null : reaction;
      const response = await fetch(`/api/social/activities/${note.activityId}/reaction`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ reaction: nextReaction }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível registrar a reação");
      if (selectedProfile) await openProfile(selectedProfile.publicHandle);
      await loadSocial();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível registrar a reação");
    } finally {
      setWorking(false);
    }
  };

  const updateNotesPrivacy = async (showNotes: boolean) => {
    setWorking(true);
    try {
      const response = await fetch("/api/social/privacy", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ showNotes }) });
      const next = await response.json() as SocialPrivacy & { error?: string };
      if (!response.ok) throw new Error(next.error || "Não foi possível salvar a preferência");
      setPrivacy(next);
      notify(showNotes ? "Anotações selecionadas poderão ser compartilhadas com amigos" : "Suas anotações compartilhadas ficaram privadas");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível salvar a preferência");
    } finally {
      setWorking(false);
    }
  };

  const updateProfilePrivacy = async (update: Partial<Pick<SocialPrivacy, "showProgress" | "showFavorites" | "showStats">>, message: string) => {
    setWorking(true);
    try {
      const response = await fetch("/api/social/privacy", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(update) });
      const next = await response.json() as SocialPrivacy & { error?: string };
      if (!response.ok) throw new Error(next.error || "Não foi possível salvar a preferência");
      setPrivacy(next);
      notify(message);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível salvar a preferência");
    } finally {
      setWorking(false);
    }
  };

  const shareNote = async (reference: string, action: "share" | "unshare") => {
    setWorking(true);
    try {
      const response = await fetch("/api/social/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reference }) });
      const result = await response.json() as { notes?: SharedSocialNote[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar a anotação");
      setSharedNotes(result.notes || []);
      if (selectedProfile) await openProfile(selectedProfile.publicHandle);
      await loadSocial();
      notify(action === "share" ? "Anotação compartilhada com amigos" : "Anotação removida do perfil social");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível atualizar a anotação");
    } finally {
      setWorking(false);
    }
  };

  const removeFriend = async (handle: string) => {
    if (!window.confirm("Remover esta pessoa da sua lista de amigos?")) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/social/friends/${encodeURIComponent(handle)}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível remover a amizade");
      setSelectedProfile(null);
      await loadSocial();
      notify("Amizade removida");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível remover a amizade");
    } finally {
      setWorking(false);
    }
  };

  const blockProfile = async (handle: string) => {
    if (!window.confirm("Bloquear este perfil? A amizade e os pedidos pendentes serão encerrados.")) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/social/blocks/${encodeURIComponent(handle)}`, { method: "POST" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível bloquear este perfil");
      setSelectedProfile(null);
      await loadSocial();
      notify("Perfil bloqueado");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível bloquear este perfil");
    } finally {
      setWorking(false);
    }
  };

  const unblockProfile = async (handle: string) => {
    setWorking(true);
    try {
      const response = await fetch(`/api/social/blocks/${encodeURIComponent(handle)}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível desbloquear este perfil");
      await loadSocial();
      notify("Perfil desbloqueado");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível desbloquear este perfil");
    } finally {
      setWorking(false);
    }
  };

  const markNotificationsRead = async () => {
    setWorking(true);
    try {
      const response = await fetch("/api/social/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "mark-read" }) });
      if (!response.ok) throw new Error("Não foi possível atualizar as notificações");
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível atualizar as notificações");
    } finally {
      setWorking(false);
    }
  };

  const notificationText = (notification: SocialNotification) => notification.kind === "friend_request"
    ? "enviou um pedido de amizade"
    : notification.kind === "friend_accepted"
      ? "aceitou seu pedido de amizade"
      : `reagiu${notification.activityTitle ? ` à atividade “${notification.activityTitle}”` : " à sua atividade"}`;
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;
  const orderedActivities = useMemo(() => [...activities].sort((first, second) => feedOrder === "recent"
    ? second.createdAt - first.createdAt
    : (second.reactions.amen + second.reactions.celebrate) - (first.reactions.amen + first.reactions.celebrate)), [activities, feedOrder]);
  const activityLabel = (activity: FeedActivity) => activity.category === "note_shared" ? "ANOTAÇÃO" : activity.kind === "mission_completed" ? "MISSÃO" : activity.kind === "chapter_completed" ? "LEITURA" : activity.kind === "streak_milestone" ? "CHAMA ACESA" : "CONQUISTA";

  if (accountView) {
    const personalNotes = Object.entries(progress.notes || {}).filter(([, note]) => note.trim());
    return <>
      <ProfilePage dark={dark} setDark={setDark} progress={progress} manifest={manifest} onOpenFavorite={onOpenFavorite} onProfilePhotoChange={onProfilePhotoChange} onDisplayNameChange={onDisplayNameChange} />
      <section className="generic-page social-page social-account-page page-in">
        <button className="social-back" onClick={() => setAccountView(false)}>‹ Voltar à comunidade</button>
        <section className="social-handle"><p>SEU IDENTIFICADOR PÚBLICO</p><b>{publicHandle ? `@${publicHandle}` : "Preparando seu identificador…"}</b><button onClick={() => void copyHandle()} disabled={!publicHandle}>Copiar</button><small>Compartilhe somente este código para receber pedidos. Seu e-mail nunca aparece.</small></section>
        {privacy && <section className="social-detail social-privacy"><p className="eyebrow">PRIVACIDADE DAS ATIVIDADES</p><label><span><b>Compartilhar conquistas</b><small>Missões e marcos de leitura aparecem para seus amigos.</small></span><input type="checkbox" checked={privacy.showActivities} disabled={working} onChange={(event) => void updateActivityPrivacy(event.target.checked)} /></label></section>}
        {privacy && <section className="social-detail social-privacy social-profile-privacy"><p className="eyebrow">O QUE AMIGOS VEEM</p><label><span><b>Jornada e missões</b><small>Nível, XP, chama acesa, missão principal e missões secundárias.</small></span><input type="checkbox" checked={privacy.showProgress} disabled={working} onChange={(event) => void updateProfilePrivacy({ showProgress: event.target.checked }, event.target.checked ? "Sua jornada ficará visível para amigos" : "Sua jornada ficará privada")} /></label><label><span><b>Estatísticas do acervo</b><small>Capítulos lidos, favoritos e quantidade de anotações.</small></span><input type="checkbox" checked={privacy.showStats} disabled={working} onChange={(event) => void updateProfilePrivacy({ showStats: event.target.checked }, event.target.checked ? "Estatísticas compartilhadas" : "Estatísticas privadas")} /></label><label><span><b>Versículos favoritos</b><small>Lista de referências salvas na sua biblioteca.</small></span><input type="checkbox" checked={privacy.showFavorites} disabled={working} onChange={(event) => void updateProfilePrivacy({ showFavorites: event.target.checked }, event.target.checked ? "Favoritos compartilhados" : "Favoritos privados")} /></label></section>}
        {privacy && <section className="social-detail social-privacy"><p className="eyebrow">PRIVACIDADE DAS ANOTAÇÕES</p><label><span><b>Permitir anotações compartilhadas</b><small>Você escolhe cada anotação; só as selecionadas aparecem para seus amigos.</small></span><input type="checkbox" checked={privacy.showNotes} disabled={working} onChange={(event) => void updateNotesPrivacy(event.target.checked)} /></label></section>}
        <SharedNotesManager notes={personalNotes} sharedNotes={sharedNotes} manifest={manifest} working={working} onShare={(reference, action) => void shareNote(reference, action)} onOpen={onOpenFavorite} />
        {blockedUsers.length > 0 && <section className="social-detail social-blocked"><p className="eyebrow">PERFIS BLOQUEADOS</p>{blockedUsers.map((contact) => <div key={contact.publicHandle}><span><b>{contact.displayName}</b><small>@{contact.publicHandle}</small></span><button disabled={working} onClick={() => void unblockProfile(contact.publicHandle)}>Desbloquear</button></div>)}</section>}
        <button type="button" className="social-logout" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }}>Sair da conta</button>
      </section>
    </>;
  }

  if (selectedProfile) {
    const profileContact = { displayName: selectedProfile.displayName || "Perfil protegido", profilePhoto: selectedProfile.profilePhoto || "" };
    const recentProfileActivities = activities.filter((activity) => activity.actor.publicHandle === selectedProfile.publicHandle).slice(0, 2);
    return <section className="generic-page social-page page-in">
      <button className="social-back" onClick={() => { setSelectedProfile(null); setProfileError(""); }}>‹ Voltar ao Social</button>
      <section className="social-profile-card">
        {selectedProfile.profileVisible ? <div className="social-profile-identity"><SocialAvatar contact={profileContact} /><div><p className="eyebrow social-disciple-label">DISCÍPULO <span aria-hidden="true"><PixelDisciple level={selectedProfile.progress?.level} turning /></span></p><h1>{profileContact.displayName}</h1>{selectedProfile.progress && <p className="social-profile-rank">Nível {selectedProfile.progress.level} <span>·</span> {discipleTitle(selectedProfile.progress.level)}</p>}<small>@{selectedProfile.publicHandle}</small></div></div> : <><SocialAvatar contact={profileContact} /><p className="eyebrow">PERFIL DO VERBO</p><h1>Perfil protegido</h1><span>@{selectedProfile.publicHandle}</span></>}
        {!selectedProfile.profileVisible && <p className="social-private">Este perfil fica visível apenas para amigos. Você ainda pode enviar um pedido se a pessoa permitir.</p>}
        {selectedProfile.canSendFriendRequest && <button className="social-primary" disabled={working} onClick={() => void sendRequest(selectedProfile.publicHandle)}>Adicionar amigo <b>＋</b></button>}
        {selectedProfile.relationship === "friend" && <div className="social-danger-actions"><button disabled={working} onClick={() => void removeFriend(selectedProfile.publicHandle)}>Remover amigo</button><button disabled={working} onClick={() => void blockProfile(selectedProfile.publicHandle)}>Bloquear</button></div>}
        {selectedProfile.relationship === "none" && <div className="social-danger-actions"><button disabled={working} onClick={() => void blockProfile(selectedProfile.publicHandle)}>Bloquear perfil</button></div>}
      </section>
      {selectedProfile.profileVisible && <>
        {selectedProfile.progress && <section className="social-stats social-journey-stats"><article><b>{selectedProfile.progress.level}</b><small>nível</small></article><article><b>{selectedProfile.progress.xp.toLocaleString("pt-BR")}</b><small>XP total</small></article><article><b>{selectedProfile.progress.streak}</b><small>chama acesa</small></article></section>}
        {selectedProfile.campaign && <section className="social-detail social-campaign social-journey-progress"><p className="eyebrow">JORNADA PRINCIPAL</p><div><span>{selectedProfile.campaign.percent}% DA GRANDE JORNADA · {selectedProfile.campaign.completedActs} de {selectedProfile.campaign.totalActs} atos concluídos</span><b>{selectedProfile.campaign.missionTitle}</b><small>Missão atual · {selectedProfile.campaign.done} de {selectedProfile.campaign.total} capítulos · {selectedProfile.campaign.completedChapters} de {selectedProfile.campaign.totalChapters} no total</small><i><u style={{ width: `${selectedProfile.campaign.percent}%` }} /></i></div></section>}
        {selectedProfile.stats && <section className="social-detail social-profile-library"><p className="eyebrow">ACERVO BÍBLICO</p><div><span>▥ Capítulos concluídos</span><b>{selectedProfile.stats.completedChapters}</b></div><div><span>♡ Versículos favoritos</span><b>{selectedProfile.stats.favoriteVerses}</b></div><div><span>✎ Anotações realizadas</span><b>{selectedProfile.stats.notes}</b></div></section>}
        {selectedProfile.favorites && <section className="social-detail social-favorite-list"><p className="eyebrow">FAVORITOS COMPARTILHADOS · {selectedProfile.favorites.length}</p>{selectedProfile.favorites.length ? <div className="social-favorites">{selectedProfile.favorites.map((favorite) => <button key={favorite} onClick={() => onOpenFavorite(favorite)}>♡ {socialReference(favorite, manifest)} <em>›</em></button>)}</div> : <small>Nenhum favorito compartilhado.</small>}</section>}
        {selectedProfile.secondaryMissions && <section className="social-detail social-secondary-summary"><p className="eyebrow">MISSÕES SECUNDÁRIAS</p><div><span>✦ Missões concluídas</span><b>{selectedProfile.secondaryMissions.completed} de {selectedProfile.secondaryMissions.total}</b></div><div><span>◆ XP obtido nas missões</span><b>{selectedProfile.secondaryMissions.xp.toLocaleString("pt-BR")}</b></div>{selectedProfile.secondaryMissions.missions.length > 0 && <ul>{selectedProfile.secondaryMissions.missions.map((mission) => <li key={mission.id}><span>{mission.title}</span><small>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(mission.completedAt))}</small></li>)}</ul>}</section>}
        {selectedProfile.notes && <section className="social-detail social-profile-notes"><p className="eyebrow">ANOTAÇÕES COMPARTILHADAS · {selectedProfile.notes.length}</p>{selectedProfile.notes.length ? <div>{selectedProfile.notes.map((note) => <article key={note.id}><button className="social-shared-note-copy" onClick={() => onOpenFavorite(note.reference)}><small>{profileContact.displayName} · {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(note.noteCreatedAt))}</small><b>{note.text}</b><span>{socialReference(note.reference, manifest)} · Abrir trecho ›</span></button><div className="social-reactions"><button className={note.reactions.viewer === "amen" ? "active" : ""} disabled={working} onClick={() => void reactToSharedNote(note, "amen")}>🙏 <span>{note.reactions.amen || "Amém"}</span></button><button className={note.reactions.viewer === "celebrate" ? "active" : ""} disabled={working} onClick={() => void reactToSharedNote(note, "celebrate")}>✦ <span>{note.reactions.celebrate || "Celebrar"}</span></button></div></article>)}</div> : <small>Este amigo ainda não compartilhou anotações.</small>}</section>}
        {recentProfileActivities.length > 0 && <section className="social-detail social-profile-activities"><p className="eyebrow">ÚLTIMAS CONQUISTAS</p>{recentProfileActivities.map((activity) => <div key={activity.id}><b>{activity.title}</b>{activity.detail && <small>{activity.detail}</small>}</div>)}</section>}
        {selectedProfile.relationship === "self" && privacy && <section className="social-detail social-privacy"><p className="eyebrow">PRIVACIDADE DAS ATIVIDADES</p><label><span><b>Compartilhar conquistas</b><small>Missões e marcos de leitura aparecem para seus amigos.</small></span><input type="checkbox" checked={privacy.showActivities} disabled={working} onChange={(event) => void updateActivityPrivacy(event.target.checked)} /></label></section>}
        {selectedProfile.relationship === "self" && blockedUsers.length > 0 && <section className="social-detail social-blocked"><p className="eyebrow">PERFIS BLOQUEADOS</p>{blockedUsers.map((contact) => <div key={contact.publicHandle}><span><b>{contact.displayName}</b><small>@{contact.publicHandle}</small></span><button disabled={working} onClick={() => void unblockProfile(contact.publicHandle)}>Desbloquear</button></div>)}</section>}
      </>}
    </section>;
  }

  return <section className="generic-page social-page social-home page-in">
    <header className="social-topbar"><button className="social-wordmark" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Ir ao início do Social">VERBO <i>social</i></button><div><button className="social-top-icon" onClick={() => setAccountView(true)} aria-label="Abrir meu perfil">◎</button><button className="social-top-icon social-notification-button" onClick={() => document.getElementById("social-notifications")?.scrollIntoView({ behavior: "smooth", block: "start" })} aria-label="Ver notificações">♢{unreadNotifications > 0 && <i>{unreadNotifications > 9 ? "9+" : unreadNotifications}</i>}</button></div></header>
    <section className="social-self-card"><button onClick={() => setAccountView(true)}><SocialAvatar contact={{ displayName: progress.displayName?.trim() || "Usuário do VERBO", profilePhoto: progress.profilePhoto || "" }} /><span><small>SUA JORNADA</small><b>{progress.displayName?.trim() || "Usuário do VERBO"}</b><em>Nível {progress.level} · {progress.streak} dias de leitura</em></span><strong>Ver perfil ›</strong></button></section>
    <section className="social-stories" aria-label="Jornadas da comunidade"><div className="social-stories-heading"><span>JORNADAS</span><button onClick={() => document.getElementById("social-community")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Ver amigos</button></div><div className="social-stories-rail"><button className="social-story social-story-self" onClick={() => setAccountView(true)}><span className="social-story-ring"><SocialAvatar contact={{ displayName: progress.displayName?.trim() || "Você", profilePhoto: progress.profilePhoto || "" }} /><i>+</i></span><small>Sua jornada</small></button>{data.friends.map((friend) => <button className="social-story" key={friend.publicHandle} onClick={() => void openProfile(friend.publicHandle)}><span className="social-story-ring"><SocialAvatar contact={friend} /></span><small>{friend.displayName}</small></button>)}</div></section>
    <form className="social-search" onSubmit={(event) => { event.preventDefault(); void openProfile(query); }}><label htmlFor="social-handle">ENCONTRAR ALGUÉM</label><div><input id="social-handle" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busque pelo identificador de um amigo" autoCapitalize="none" autoCorrect="off" /><button type="submit" disabled={working}>{working ? "…" : "Buscar"}</button></div>{profileError && <small className="social-error">{profileError}</small>}</form>
    <form className="social-search" onSubmit={(event) => { event.preventDefault(); void openProfile(query); }}><label htmlFor="social-handle">ENCONTRAR ALGUÉM</label><div><input id="social-handle" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: verbo-abc123def4" autoCapitalize="none" autoCorrect="off" /><button type="submit" disabled={working}>{working ? "…" : "Buscar"}</button></div>{profileError && <small className="social-error">{profileError}</small>}</form>
    {loading ? <p className="social-loading">Carregando suas conexões…</p> : <>
      {notifications.length > 0 && <section id="social-notifications" className="social-section social-notifications"><div className="social-section-title"><div><p className="eyebrow">NOTIFICAÇÕES</p><h2>Novidades para você</h2></div>{unreadNotifications > 0 ? <button className="social-mark-read" disabled={working} onClick={() => void markNotificationsRead()}>Marcar lidas</button> : <span>✓</span>}</div><div className="social-notification-list">{notifications.map((notification) => <button key={notification.id} className={notification.read ? "read" : ""} onClick={() => void openProfile(notification.actor.publicHandle)}><SocialAvatar contact={notification.actor} small /><span><b>{notification.actor.displayName}</b><small>{notificationText(notification)}</small></span>{!notification.read && <i />}</button>)}</div></section>}
      <section className="social-section social-feed"><div className="social-section-title social-feed-title"><div><p className="eyebrow">COMUNIDADE</p><h2>Para você</h2></div><span>{activities.length}</span></div><div className="social-feed-tabs" role="tablist" aria-label="Ordenar atividades"><button role="tab" aria-selected={feedOrder === "recent"} className={feedOrder === "recent" ? "active" : ""} onClick={() => setFeedOrder("recent")}>Recentes</button><button role="tab" aria-selected={feedOrder === "celebrated"} className={feedOrder === "celebrated" ? "active" : ""} onClick={() => setFeedOrder("celebrated")}>Celebradas</button></div>{orderedActivities.length ? <div className="social-feed-list">{orderedActivities.map((activity) => <article key={activity.id}><button className="social-activity-head" onClick={() => void openProfile(activity.actor.publicHandle)}><SocialAvatar contact={activity.actor} small /><span><b>{activity.actor.displayName}</b><small>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(activity.createdAt))}</small></span><em>•••</em></button><div className="social-activity-copy"><i>{activityLabel(activity)}</i><p>{activity.title}</p>{activity.detail && <small>{activity.detail}</small>}{activity.reference && <span>▥ {activity.reference}</span>}</div><div className="social-reactions"><button className={activity.reactions.viewer === "amen" ? "active" : ""} disabled={working} onClick={() => void reactToActivity(activity, "amen")}>🙏 <span>{activity.reactions.amen || "Amém"}</span></button><button className={activity.reactions.viewer === "celebrate" ? "active" : ""} disabled={working} onClick={() => void reactToActivity(activity, "celebrate")}>✦ <span>{activity.reactions.celebrate || "Celebrar"}</span></button></div></article>)}</div> : <div className="social-feed-empty"><span>✦</span><p>As atividades da sua jornada aparecerão aqui. Ative o compartilhamento no seu perfil social para que amigos também possam acompanhá-las.</p></div>}</section>
      {data.requests.incoming.length > 0 && <section className="social-section"><div className="social-section-title"><div><p className="eyebrow">PEDIDOS RECEBIDOS</p><h2>Quer caminhar com você</h2></div><span>{data.requests.incoming.length}</span></div>{data.requests.incoming.map((request) => <article className="social-request" key={request.id}><SocialAvatar contact={request} small /><div><b>{request.displayName}</b><small>@{request.publicHandle}</small></div><div className="social-request-actions"><button disabled={working} onClick={() => void answerRequest(request.id, "accept")}>Aceitar</button><button disabled={working} onClick={() => void answerRequest(request.id, "decline")}>×</button></div></article>)}</section>}
      {data.friends.length > 0 ? <section id="social-community" className="social-section"><div className="social-section-title"><div><p className="eyebrow">SUA COMUNIDADE</p><h2>Amigos no Verbo</h2></div><span>{data.friends.length}</span></div><div className="social-friends">{data.friends.map((friend) => <button key={friend.publicHandle} onClick={() => void openProfile(friend.publicHandle)}><SocialAvatar contact={friend} small /><span><b>{friend.displayName}</b><small>@{friend.publicHandle}</small></span><em>›</em></button>)}</div></section> : <section id="social-community" className="social-empty"><span className="social-empty-community-icon" aria-hidden="true"><i /><i /></span><h2>Comece sua comunidade</h2><p>Envie seu identificador para alguém de confiança ou busque o código que recebeu.</p></section>}
      {data.requests.outgoing.length > 0 && <section className="social-section social-outgoing"><div className="social-section-title"><div><p className="eyebrow">AGUARDANDO RESPOSTA</p><h2>Pedidos enviados</h2></div><span>{data.requests.outgoing.length}</span></div>{data.requests.outgoing.map((request) => <article className="social-request" key={request.id}><SocialAvatar contact={request} small /><div><b>{request.displayName}</b><small>@{request.publicHandle}</small></div><button className="social-cancel" disabled={working} onClick={() => void answerRequest(request.id, "cancel")}>Cancelar</button></article>)}</section>}
    </>}
  </section>;
}

function ProfilePage({ dark, setDark, progress, manifest, onOpenFavorite, onProfilePhotoChange, onDisplayNameChange }: { dark: boolean; setDark: (value: boolean) => void; progress: PlayerProgress; manifest: BibleManifest | null; onOpenFavorite: (reference: string) => void; onProfilePhotoChange: (file: File) => void; onDisplayNameChange: (displayName: string) => Promise<boolean> }) {
  const xpProgress = getXpProgress(progress.xp);
  const [expanded, setExpanded] = useState(false);
  const [libraryView, setLibraryView] = useState<"favorites" | "notes" | null>(null);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(progress.displayName || "");
  const [savingName, setSavingName] = useState(false);
  const achievements = [
    { icon: "✦", name: "Primeiro passo", unlocked: progress.completed.length >= 1 },
    { icon: "🔥", name: "Leitor fiel", unlocked: progress.completed.length >= 5 },
    { icon: "♜", name: "Guardião", unlocked: progress.completed.length >= 10 },
    ...[10, 50, 100, 365].map((days) => ({ icon: "🔥", name: `${days} dias consecutivos`, unlocked: progress.streak >= days })),
    ...campaignActs.map((act) => ({ icon: act.number === 7 ? "★" : "✦", name: `Ato ${act.number} concluído`, unlocked: isActComplete(act, progress.completed) })),
    ...[10, 20, 30, 40, 50].map((level) => ({ icon: "◆", name: `Nível ${level}`, unlocked: xpProgress.level >= level })),
  ];
  const favorites = progress.favorites || [];
  const notes = Object.entries(progress.notes || {}).filter(([, note]) => note.trim());
  const visibleAchievements = expanded ? achievements : achievements.slice(0, 3);
  return <section className="generic-page profile-page social-profile-page page-in">
    <div className="profile-heading"><div><p className="eyebrow">SUA JORNADA</p><h1>Perfil</h1><p className="lead">Acompanhe sua constância, suas conquistas e o próximo passo na Palavra.</p></div><span className="profile-status"><i />Jornada ativa</span></div>
    <section className="profile-summary"><span className="profile-avatar">{progress.profilePhoto ? <ProfilePhoto src={progress.profilePhoto} /> : xpProgress.level}</span><div className="profile-identity"><p className="eyebrow profile-disciple-label">DISCÍPULO <span aria-hidden="true"><PixelDisciple level={xpProgress.level} turning /></span></p><h2>{progress.displayName?.trim() || "Nome da sua conta"}</h2><button type="button" className="profile-name-trigger" onClick={() => { setNameDraft(progress.displayName || ""); setProfileEditorOpen(true); }}>Editar perfil</button><p className="profile-rank">Nível {xpProgress.level} <span>·</span> {discipleTitle(xpProgress.level)}</p><div className="profile-xp-meta"><span>{progress.xp.toLocaleString("pt-BR")} XP acumulados</span><b>{xpProgress.isMaxLevel ? "NÍVEL MÁXIMO · 50" : `${xpProgress.current - xpProgress.currentLevelXp} / ${xpProgress.needed} XP`}</b></div><div className="profile-xp"><i style={{ width: `${xpProgress.progress}%` }} /></div><small>{xpProgress.isMaxLevel ? "Você completou toda a progressão disponível." : `Faltam ${xpProgress.remaining} XP para o nível ${xpProgress.level + 1}`}</small></div><div className="profile-next"><span>PRÓXIMO MARCO</span><b>{xpProgress.isMaxLevel ? "NÍVEL MÁXIMO" : `NÍVEL ${xpProgress.level + 1}`}</b><i>Continue lendo<br />para avançar</i></div></section>
    {profileEditorOpen && <section className="profile-panel profile-edit-panel"><div className="profile-section-heading"><div><p className="eyebrow">SEU PERFIL</p><h2>Editar perfil</h2></div><button type="button" className="profile-editor-close" onClick={() => setProfileEditorOpen(false)} aria-label="Fechar edição do perfil">×</button></div><div className="profile-edit-photo"><label className="profile-avatar profile-avatar-picker profile-editor-avatar">{progress.profilePhoto ? <ProfilePhoto src={progress.profilePhoto} /> : xpProgress.level}<input type="file" accept="image/*" aria-label="Escolher nova foto de perfil" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onProfilePhotoChange(file); }} /><small>Trocar foto</small></label><span><b>Foto do perfil</b><small>Toque na imagem para escolher outra foto.</small></span></div><form className="profile-name-edit" onSubmit={async (event) => { event.preventDefault(); setSavingName(true); const saved = await onDisplayNameChange(nameDraft.trim()); setSavingName(false); if (saved) setProfileEditorOpen(false); }}><label htmlFor="profile-display-name">Nome do perfil</label><div><input id="profile-display-name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} minLength={2} maxLength={24} required autoFocus /><button disabled={savingName}>{savingName ? "Salvando…" : "Salvar"}</button><button type="button" onClick={() => { setNameDraft(progress.displayName || ""); setProfileEditorOpen(false); }} disabled={savingName}>Cancelar</button></div><small>De 2 a 24 caracteres.</small></form><p className="profile-edit-note">Suas preferências de privacidade e aparência ficam logo abaixo, na área de preferências.</p></section>}
    <section className="profile-stats"><article><span>✦</span><div><b>{progress.completed.length}</b><small>capítulos lidos</small></div></article><article><span>🔥</span><div><b>{progress.streak}</b><small>dias de sequência</small></div></article><article><span>◆</span><div><b>{progress.coins}</b><small>siclos de prata</small></div></article><article><span>▤</span><div><b>{progress.foundScrolls?.length || 0}</b><small>pergaminhos encontrados</small></div></article></section>
    <section className="profile-panel"><div className="profile-section-heading"><div><p className="eyebrow">CONQUISTAS</p><h2>Marcos da jornada</h2></div><span>{achievements.filter((item) => item.unlocked).length} de {achievements.length} conquistadas</span></div><div className="achievement-row">{visibleAchievements.map((item) => <article key={item.name} className={item.unlocked ? "earned" : ""}><i>{item.icon}</i><b>{item.name}</b></article>)}</div><button className="profile-action" onClick={() => setExpanded(!expanded)}>{expanded ? "Exibir menos" : "Exibir mais conquistas"}</button></section>
    <section className="profile-panel"><div className="profile-section-heading"><div><p className="eyebrow">BIBLIOTECA</p><h2>Seu acervo</h2></div><span>Leitura</span></div><div className="library-items"><div><i>♡</i><span>Versículos favoritos<small><b>{favorites.length}</b> salvos para revisitar</small></span></div><div><i>✎</i><span>Anotações<small><b>{notes.length}</b> reflexões salvas na Bíblia</small></span></div><div><i>▥</i><span>Capítulos concluídos<small><b>{progress.completed.length}</b> registrados na jornada</small></span></div></div><div className="library-actions"><button className="profile-action" onClick={() => setLibraryView(libraryView === "favorites" ? null : "favorites")}>{libraryView === "favorites" ? "Fechar favoritos" : "Abrir favoritos"} <b>→</b></button><button className="profile-action" onClick={() => setLibraryView(libraryView === "notes" ? null : "notes")}>{libraryView === "notes" ? "Fechar anotações" : "Abrir anotações"} <b>→</b></button></div>{libraryView === "favorites" && <div className="favorites-list">{favorites.length ? favorites.map((reference) => { const [slug, chapter, verse] = reference.split(":"); const book = manifest?.books.find((item) => item.slug === slug); return <button key={reference} onClick={() => onOpenFavorite(reference)}><span>♡</span><div><b>{book?.name || slug} {chapter}:{verse}</b><small>Abrir na Bíblia</small></div><em>›</em></button>; }) : <p>Você ainda não salvou versículos.</p>}</div>}{libraryView === "notes" && <div className="favorites-list notes-list">{notes.length ? notes.map(([reference, note]) => { const [slug, chapter, verse] = reference.split(":"); const book = manifest?.books.find((item) => item.slug === slug); return <button key={reference} onClick={() => onOpenFavorite(reference)}><span>✎</span><div><b>{book?.name || slug} {chapter}:{verse}</b><small>{note}</small></div><em>›</em></button>; }) : <p>Suas anotações salvas aparecerão aqui.</p>}</div>}</section>
    <h3 className="list-heading">Preferências</h3><div className="settings-list"><button onClick={() => setDark(!dark)}><i>{dark ? "☾" : "☀"}</i><span>Aparência<small>{dark ? "Modo escuro" : "Modo claro"}</small></span><em className={`switch ${dark ? "on" : ""}`}><u /></em></button><button><i>⇩</i><span>Conteúdo bíblico<small>3 traduções · cânones de 66 e 73 livros</small></span><b>›</b></button><button><i>©</i><span>Créditos das traduções<small>Domínio público + CC BY</small></span><b>›</b></button></div>
  </section>;
}

function HelpButton({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  return <span className="help-wrap"><button type="button" className="help-button" onClick={() => setOpen(!open)} aria-label={`Como funciona: ${title}`} aria-expanded={open}>?</button>{open && <span className="help-popover" role="dialog" aria-label={title}><button type="button" className="help-close" onClick={() => setOpen(false)} aria-label="Fechar ajuda">×</button><b>{title}</b><small>{text}</small></span>}</span>;
}

function ProfilePhoto({ src }: { src: string }) {
  // O endereço é definido pelo próprio usuário no perfil e pode ser externo.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Foto do perfil" />;
}

function PixelDisciple({ level = 1, turning = false }: { level?: number; turning?: boolean }) {
  // Sprites fornecidos para o personagem da campanha; mantém os pixels nítidos em qualquer tela.
  const tier = level >= 50 ? 50 : level >= 40 ? 40 : 30;
  if (turning) {
    const directions = ["south", "south-west", "west", "north-west", "north", "north-east", "east", "south-east"];
    return <span className="pixel-disciple-turn">{directions.map((direction, index) => <img key={direction} src={`/characters/homem-${tier}lvl-idle-${direction}.png`} alt="" aria-hidden="true" style={{ animationDelay: `${-index * 0.4}s` }} />)}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="pixel-disciple" src={`/characters/homem-${tier}lvl-idle-south.png`} alt="" aria-hidden="true" />;
}

function BookPicker({ manifest, currentSlug, currentChapter, close, choose }: { manifest: BibleManifest; currentSlug: string; currentChapter: number; close: () => void; choose: (slug: string, chapter: number) => void }) {
  const [testament, setTestament] = useState<"old" | "new">("old");
  const [selectedBook, setSelectedBook] = useState<ManifestBook | null>(null);
  const books = manifest.books.filter((book) => book.testament === testament);
  const oldBookCount = manifest.books.filter((book) => book.testament === "old").length;
  const newBookCount = manifest.books.filter((book) => book.testament === "new").length;
  const catholicEdition = manifest.canon === "catholic-73";
  if (selectedBook) {
    return <div className="book-picker page-in"><div className="picker-head"><button onClick={() => setSelectedBook(null)} aria-label="Voltar para os livros">‹</button><div><p>ESCOLHA UM CAPÍTULO</p><h2>{selectedBook.name}</h2></div><span>{selectedBook.abbreviation}</span></div><div className="chapter-picker-intro"><b>{selectedBook.longName}</b><span>{selectedBook.chapterCount} {selectedBook.chapterCount === 1 ? "capítulo disponível" : "capítulos disponíveis"}</span></div><div className="chapter-grid" aria-label={`Capítulos de ${selectedBook.name}`}>{Array.from({ length: selectedBook.chapterCount }, (_, index) => index + 1).map((number) => <button key={number} className={currentSlug === selectedBook.slug && currentChapter === number ? "current" : ""} onClick={() => choose(selectedBook.slug, number)} aria-label={`${selectedBook.name}, capítulo ${number}`}>{number}</button>)}</div><footer><b>{manifest.code}</b><span>{manifest.translation}</span></footer></div>;
  }
  return <div className="book-picker page-in"><div className="picker-head"><button onClick={close} aria-label="Fechar seleção de livros">×</button><div><p>ESCOLHA UM LIVRO</p><h2>Bíblia Sagrada</h2></div><span>{manifest.bookCount}</span></div><div className="canon-banner"><b>{catholicEdition ? "Cânon católico" : "Cânon protestante reformado"}</b><span>{oldBookCount} livros no Antigo Testamento · {newBookCount} no Novo{catholicEdition ? " · inclui deuterocanônicos" : ""}</span></div><div className="testament-tabs"><button className={testament === "old" ? "active" : ""} onClick={() => setTestament("old")}>Antigo Testamento <small>{oldBookCount}</small></button><button className={testament === "new" ? "active" : ""} onClick={() => setTestament("new")}>Novo Testamento <small>{newBookCount}</small></button></div><div className="book-grid">{books.map((book) => <button key={book.slug} className={`${currentSlug === book.slug ? "current " : ""}${book.isDeuterocanonical ? "deuterocanonical-book" : ""}`} onClick={() => setSelectedBook(book)}><i>{book.abbreviation}</i><span><b>{book.name}</b><small>{book.isDeuterocanonical ? "Deuterocanônico" : `${book.chapterCount} ${book.chapterCount === 1 ? "capítulo" : "capítulos"}`}</small></span><em>›</em></button>)}</div><footer><b>{manifest.code}</b><span>{manifest.translation}</span></footer></div>;
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
  const catholicEdition = manifest?.canon === "catholic-73";
  return <div className="search-overlay page-in"><div className="search-box"><button onClick={close}>‹</button><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busque um livro ou referência" /><span>⌕</span></div><p className="eyebrow">{query ? "RESULTADOS NA TRADUÇÃO SELECIONADA" : "BUSCAS RECENTES"}</p>{query ? <div className="search-results">{referencedBook && reference && Number(reference[2]) <= referencedBook.chapterCount && <button onClick={() => choose(referencedBook.slug, Number(reference[2]))}><small>REFERÊNCIA</small><b>{referencedBook.name} {reference[2]}{reference[3] ? `:${reference[3]}` : ""}</b><p>Abrir na tradução selecionada</p><span>›</span></button>}{bookMatches.map((book) => <button key={book.slug} onClick={() => choose(book.slug)}><small>{book.isDeuterocanonical ? "LIVRO DEUTEROCANÔNICO" : book.testament === "old" ? "ANTIGO TESTAMENTO" : "NOVO TESTAMENTO"}</small><b>{book.name}</b><p>{book.chapterCount} capítulos · {book.verseCount} versículos</p><span>›</span></button>)}{normalized.includes("amor") && <button onClick={open}><small>ESTUDO REFORMADO</small><b>O amor soberano de Deus</b><p>Graça, eleição e redenção em Cristo</p><span>›</span></button>}{!referencedBook && bookMatches.length === 0 && !normalized.includes("amor") && <div className="empty-search"><b>Nenhum livro encontrado</b><p>Tente uma referência como “Romanos 8” ou “Salmo 23”. A busca por frases em todos os {manifest?.verseCount.toLocaleString("pt-BR")} versículos será a próxima etapa.</p></div>}</div> : <div className="recent-searches"><button onClick={() => setQuery("João 3:16")}>◴ <span>João 3:16</span> ×</button><button onClick={() => setQuery("Romanos 8")}>◴ <span>Romanos 8</span> ×</button><div className="search-tip"><b>{manifest?.bookCount ?? 66} livros nesta edição</b><p>{catholicEdition ? "Esta edição inclui os livros deuterocanônicos e não é utilizada nas missões." : "Todo o cânon protestante está disponível, de Gênesis a Apocalipse, sem livros deuterocanônicos."}</p></div></div>}</div>;
}

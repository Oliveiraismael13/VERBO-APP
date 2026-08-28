export type OcrBook = {
  slug: string;
  name: string;
  abbreviation: string;
  chapterCount: number;
};

export type OcrVerse = { number: number; text: string };
export type OcrBookText = OcrBook & { chapters: OcrVerse[][] };
export type OcrProgress = { stage: "preparing" | "loading" | "reading" | "matching"; progress?: number };
export type OcrProgressCallback = (progress: OcrProgress) => void;
export type OcrTranslationHint = { code: string; label: string; aliases: string[] };

export type BibleOcrCandidate = {
  bookSlug: string;
  bookName: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  confidence: number;
  excerpt: string;
};

type OcrIndexEntry = [bookSlug: string, chapter: number, verse: number, text: string];
type OcrIndex = { version: number; entries: OcrIndexEntry[] };
type TesseractWorker = {
  recognize: (image: Blob) => Promise<{ data: { text: string; confidence: number } }>;
  setParameters: (parameters: Record<string, string>) => Promise<void>;
};

const bookCache = new Map<string, Promise<OcrBookText>>();
const fullBibleCache = new Map<string, Promise<OcrBookText[]>>();
const indexCache = new Map<string, Promise<OcrIndex>>();
const stopWords = new Set(["a", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os", "ou", "para", "por", "que", "se", "um", "uma"]);
let tesseractWorkerPromise: Promise<TesseractWorker> | null = null;
let activeProgressReporter: OcrProgressCallback | null = null;

export function normalizeBibleText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[–—-]/g, " ate ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function recognizeBibleTranslation(text: string, hints: OcrTranslationHint[]) {
  const normalized = normalizeBibleText(text);
  let detected: { code: string; score: number } | null = null;
  for (const hint of hints) {
    for (const alias of hint.aliases) {
      const normalizedAlias = normalizeBibleText(alias);
      if (normalizedAlias.length < 3) continue;
      const exact = new RegExp(`(^| )${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?= |$)`).test(normalized);
      if (!exact) continue;
      const score = normalizedAlias === normalizeBibleText(hint.code) ? 100 : normalizedAlias.length;
      if (!detected || score > detected.score) detected = { code: hint.code, score };
    }
  }
  return detected?.code || null;
}

function report(stage: OcrProgress["stage"], progress?: number) {
  activeProgressReporter?.({ stage, progress });
}

async function portugueseWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      const { createWorker, OEM } = await import("tesseract.js");
      const worker = await createWorker("por", OEM.LSTM_ONLY, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/tesseract-core-lstm.wasm.js",
        langPath: "/ocr",
        gzip: true,
        logger: (message: { status?: string; progress?: number }) => {
          if (message.status?.includes("language")) report("loading", message.progress);
          else if (message.status?.includes("recognizing")) report("reading", message.progress);
        },
      });
      await worker.setParameters({ tessedit_pageseg_mode: "6" });
      return worker as TesseractWorker;
    })().catch((error) => {
      tesseractWorkerPromise = null;
      throw error;
    });
  }
  return tesseractWorkerPromise;
}

export async function prepareOcrImage(image: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return image;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(image);
  } catch {
    return image;
  }
  try {
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return image;
    context.filter = "grayscale(1) contrast(1.45)";
    context.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob || image), "image/jpeg", 0.94));
  } finally {
    bitmap.close();
  }
}

export async function recognizePortugueseText(image: Blob, onProgress?: OcrProgressCallback): Promise<{ text: string; confidence: number }> {
  activeProgressReporter = onProgress || null;
  try {
    report("preparing");
    const NativeTextDetector = (window as Window & { TextDetector?: new () => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).TextDetector;
    if (NativeTextDetector && typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(image);
        try {
          const blocks = await new NativeTextDetector().detect(bitmap);
          const text = blocks.map((block) => block.rawValue).join("\n").trim();
          if (text) return { text, confidence: 90 };
        } finally {
          bitmap.close();
        }
      } catch {
        // Alguns navegadores expõem TextDetector, mas não o disponibilizam para imagens da câmera.
      }
    }

    const prepared = await prepareOcrImage(image);
    report("loading");
    const worker = await portugueseWorker();
    report("reading");
    const result = await worker.recognize(prepared);
    return { text: result.data.text.trim(), confidence: Math.round(result.data.confidence) };
  } finally {
    activeProgressReporter = null;
  }
}

async function bibleBook(path: string, book: OcrBook, privateSource = false) {
  const cacheKey = `${path}:${privateSource ? "private" : "public"}:${book.slug}`;
  const cached = bookCache.get(cacheKey);
  if (cached) return cached;
  const request = fetch(`${path}/${book.slug}${privateSource ? "" : ".json"}`).then(async (response) => {
    if (!response.ok) throw new Error("Não foi possível consultar a Bíblia selecionada.");
    return response.json() as Promise<OcrBookText>;
  });
  bookCache.set(cacheKey, request);
  return request;
}

async function bibleBooks(path: string, manifestBooks: OcrBook[], privateSource = false) {
  const cacheKey = `${path}:${privateSource ? "private" : "public"}`;
  const cached = fullBibleCache.get(cacheKey);
  if (cached) return cached;
  const books = Promise.all(manifestBooks.map((book) => bibleBook(path, book, privateSource)));
  fullBibleCache.set(cacheKey, books);
  return books;
}

async function bibleIndex(path: string, privateSource = false) {
  const cacheKey = `${path}:${privateSource ? "private" : "public"}`;
  const cached = indexCache.get(cacheKey);
  if (cached) return cached;
  const resource = privateSource ? "ocrindex" : "ocr-index.json";
  const index = fetch(`${path}/${resource}`).then(async (response) => {
    if (!response.ok) throw new Error("Índice OCR indisponível.");
    const value = await response.json() as Partial<OcrIndex>;
    if (value.version !== 1 || !Array.isArray(value.entries)) throw new Error("Índice OCR inválido.");
    return value as OcrIndex;
  });
  indexCache.set(cacheKey, index);
  return index;
}

function explicitReference(text: string, books: OcrBook[]) {
  const normalized = normalizeBibleText(text);
  const ordered = [...books].sort((a, b) => Math.max(normalizeBibleText(b.name).length, normalizeBibleText(b.abbreviation).length) - Math.max(normalizeBibleText(a.name).length, normalizeBibleText(a.abbreviation).length));
  for (const book of ordered) {
    const labels = [book.name, book.abbreviation].map(normalizeBibleText);
    for (const label of labels) {
      const match = normalized.match(new RegExp(`(?:^|\\s)${label.replace(/\s/g, "\\s+")}\\s+(\\d{1,3})\\s+(\\d{1,3})(?:\\s+(?:a|ate)\\s*(\\d{1,3}))?`));
      if (match) return { book, chapter: Number(match[1]), startVerse: Number(match[2]), endVerse: Number(match[3] || match[2]) };
    }
  }
  return null;
}

export function parseBibleReference(text: string, books: OcrBook[]) {
  return explicitReference(text, books);
}

function score(text: string, verse: string) {
  const query = Array.from(new Set(normalizeBibleText(text).split(" ").filter((word) => word.length > 2 && !stopWords.has(word))));
  const candidate = new Set(normalizeBibleText(verse).split(" "));
  if (query.length < 3) return 0;
  const matches = query.filter((word) => candidate.has(word)).length;
  const phrase = query.slice(0, Math.min(5, query.length)).join(" ");
  const containsPhrase = normalizeBibleText(verse).includes(phrase);
  return Math.min(100, matches / Math.min(query.length, 16) * 88 + (containsPhrase ? 12 : 0));
}

function candidatesFromEntries(ocrText: string, entries: OcrIndexEntry[], manifestBooks: OcrBook[]) {
  const books = new Map(manifestBooks.map((book) => [book.slug, book]));
  const candidates: BibleOcrCandidate[] = [];
  for (const [bookSlug, chapter, verse, text] of entries) {
    const confidence = Math.round(score(ocrText, text));
    const book = books.get(bookSlug);
    if (book && confidence >= 38) candidates.push({ bookSlug, bookName: book.name, chapter, startVerse: verse, endVerse: verse, confidence, excerpt: text });
  }
  return candidates.sort((first, second) => second.confidence - first.confidence).slice(0, 3);
}

export async function findBiblePassages(ocrText: string, path: string, manifestBooks: OcrBook[], privateSource = false, onProgress?: OcrProgressCallback): Promise<BibleOcrCandidate[]> {
  onProgress?.({ stage: "matching" });
  const direct = explicitReference(ocrText, manifestBooks);
  if (direct) {
    const current = await bibleBook(path, direct.book, privateSource);
    const verses = current.chapters[direct.chapter - 1] || [];
    const start = verses.find((verse) => verse.number === direct.startVerse);
    if (start) return [{ bookSlug: direct.book.slug, bookName: direct.book.name, chapter: direct.chapter, startVerse: direct.startVerse, endVerse: Math.min(direct.endVerse, verses.at(-1)?.number || direct.endVerse), confidence: 99, excerpt: start.text }];
  }

  try {
    const index = await bibleIndex(path, privateSource);
    return candidatesFromEntries(ocrText, index.entries, manifestBooks);
  } catch {
    // O fallback mantém o OCR disponível caso uma versão antiga ainda não tenha o índice publicado.
  }

  const books = await bibleBooks(path, manifestBooks, privateSource);
  return candidatesFromEntries(ocrText, books.flatMap((book) => book.chapters.flatMap((chapter, chapterIndex) => chapter.map((verse) => [book.slug, chapterIndex + 1, verse.number, verse.text] as OcrIndexEntry))), manifestBooks);
}

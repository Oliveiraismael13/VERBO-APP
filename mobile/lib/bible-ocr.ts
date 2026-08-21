export type OcrBook = {
  slug: string;
  name: string;
  abbreviation: string;
  chapterCount: number;
};

export type OcrVerse = { number: number; text: string };
export type OcrBookText = OcrBook & { chapters: OcrVerse[][] };

export type BibleOcrCandidate = {
  bookSlug: string;
  bookName: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  confidence: number;
  excerpt: string;
};

const cache = new Map<string, OcrBookText[]>();
const stopWords = new Set(["a", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os", "ou", "para", "por", "que", "se", "um", "uma"]);

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

export async function recognizePortugueseText(image: Blob): Promise<{ text: string; confidence: number }> {
  const NativeTextDetector = (window as Window & { TextDetector?: new () => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).TextDetector;
  if (NativeTextDetector) {
    const bitmap = await createImageBitmap(image);
    try {
      const blocks = await new NativeTextDetector().detect(bitmap);
      const text = blocks.map((block) => block.rawValue).join("\n").trim();
      if (text) return { text, confidence: 92 };
    } finally {
      bitmap.close();
    }
  }

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por");
  try {
    const result = await worker.recognize(image);
    return { text: result.data.text.trim(), confidence: Math.round(result.data.confidence) };
  } finally {
    await worker.terminate();
  }
}

async function bibleBooks(path: string, manifestBooks: OcrBook[]) {
  const cached = cache.get(path);
  if (cached) return cached;
  const books = await Promise.all(manifestBooks.map(async (book) => {
    const response = await fetch(`${path}/${book.slug}.json`);
    if (!response.ok) throw new Error("Não foi possível consultar a Bíblia local.");
    return response.json() as Promise<OcrBookText>;
  }));
  cache.set(path, books);
  return books;
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
  const query = normalizeBibleText(text).split(" ").filter((word) => word.length > 2 && !stopWords.has(word));
  const candidate = new Set(normalizeBibleText(verse).split(" "));
  if (query.length < 3) return 0;
  const matches = query.filter((word) => candidate.has(word)).length;
  const phrase = query.slice(0, Math.min(5, query.length)).join(" ");
  const containsPhrase = normalizeBibleText(verse).includes(phrase);
  return matches / query.length * 88 + (containsPhrase ? 12 : 0);
}

export async function findBiblePassages(ocrText: string, path: string, manifestBooks: OcrBook[]): Promise<BibleOcrCandidate[]> {
  const direct = explicitReference(ocrText, manifestBooks);
  const books = await bibleBooks(path, manifestBooks);
  if (direct) {
    const current = books.find((book) => book.slug === direct.book.slug);
    const verses = current?.chapters[direct.chapter - 1] || [];
    const start = verses.find((verse) => verse.number === direct.startVerse);
    if (start) return [{ bookSlug: direct.book.slug, bookName: direct.book.name, chapter: direct.chapter, startVerse: direct.startVerse, endVerse: Math.min(direct.endVerse, verses.at(-1)?.number || direct.endVerse), confidence: 99, excerpt: start.text }];
  }

  const candidates: BibleOcrCandidate[] = [];
  books.forEach((book) => book.chapters.forEach((chapter, chapterIndex) => chapter.forEach((verse) => {
    const confidence = Math.round(score(ocrText, verse.text));
    if (confidence >= 38) candidates.push({ bookSlug: book.slug, bookName: book.name, chapter: chapterIndex + 1, startVerse: verse.number, endVerse: verse.number, confidence, excerpt: verse.text });
  })));
  return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

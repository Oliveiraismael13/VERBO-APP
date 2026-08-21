import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const baseRoot = join(process.cwd(), "public", "bible");
const outputRoot = join(baseRoot, "chamadafe");
const sourceBase = "https://chamadafe.com.br/biblia";

const catholicSources = [
  { slug: "tobias", sourceSlug: "tobias", code: "TOB", name: "Tobias", longName: "Livro de Tobias", abbreviation: "Tb", chapterCount: 14, isDeuterocanonical: true },
  { slug: "judite", sourceSlug: "judite", code: "JDT", name: "Judite", longName: "Livro de Judite", abbreviation: "Jt", chapterCount: 16, isDeuterocanonical: true },
  { slug: "sabedoria", sourceSlug: "sabedoria", code: "WIS", name: "Sabedoria", longName: "Livro da Sabedoria", abbreviation: "Sb", chapterCount: 19, isDeuterocanonical: true },
  { slug: "eclesiastico", sourceSlug: "eclesiastico", code: "SIR", name: "Eclesiástico", longName: "Livro do Eclesiástico", abbreviation: "Eclo", chapterCount: 51, isDeuterocanonical: true },
  { slug: "baruc", sourceSlug: "baruc", code: "BAR", name: "Baruc", longName: "Livro de Baruc", abbreviation: "Br", chapterCount: 6, isDeuterocanonical: true },
  { slug: "1mac", sourceSlug: "1-macabeus", code: "1MA", name: "1 Macabeus", longName: "Primeiro Livro dos Macabeus", abbreviation: "1Mc", chapterCount: 16, isDeuterocanonical: true },
  { slug: "2mac", sourceSlug: "2-macabeus", code: "2MA", name: "2 Macabeus", longName: "Segundo Livro dos Macabeus", abbreviation: "2Mc", chapterCount: 15, isDeuterocanonical: true },
  { slug: "est", sourceSlug: "ester", chapterCount: 16 },
  { slug: "dan", sourceSlug: "daniel", chapterCount: 14 },
];

function decodeHtml(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, value) => {
    const lower = value.toLowerCase();
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return "\"";
    if (lower === "apos") return "'";
    if (lower === "nbsp") return " ";
    const point = lower.startsWith("#x") ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
    return String.fromCodePoint(point);
  });
}

async function fetchChapter(sourceSlug, chapter) {
  const response = await fetch(`${sourceBase}/${sourceSlug}/${chapter}`);
  if (!response.ok) throw new Error(`Não foi possível baixar ${sourceSlug} ${chapter}: HTTP ${response.status}`);
  const html = await response.text();
  const verses = Array.from(html.matchAll(/<span data-texto="true">([\s\S]*?)<\/span>/g), (match, index) => ({ number: index + 1, text: decodeHtml(match[1]).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() }));
  if (!verses.length || verses.some((verse) => !verse.text)) throw new Error(`Não foi possível ler os versículos de ${sourceSlug} ${chapter}`);
  return verses;
}

async function mapConcurrent(values, limit, mapper) {
  const results = Array(values.length);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (index < values.length) {
      const current = index++;
      results[current] = await mapper(values[current], current);
    }
  }));
  return results;
}

async function fetchBook(source) {
  const chapters = await mapConcurrent(Array.from({ length: source.chapterCount }, (_, index) => index + 1), 8, (chapter) => fetchChapter(source.sourceSlug, chapter));
  return chapters;
}

const baseManifest = JSON.parse(await readFile(join(baseRoot, "manifest.json"), "utf8"));
const remoteChapters = new Map(await Promise.all(catholicSources.map(async (source) => [source.slug, await fetchBook(source)])));

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const sourceBySlug = new Map(catholicSources.map((source) => [source.slug, source]));
const additionsAfter = new Map([
  ["nee", ["tobias", "judite"]],
  ["est", ["1mac", "2mac"]],
  ["cant", ["sabedoria", "eclesiastico"]],
  ["lam", ["baruc"]],
]);
const books = [];

async function writeBook(book) {
  const verseCount = book.chapters.reduce((total, chapter) => total + chapter.length, 0);
  const manifestBook = { slug: book.slug, code: book.code, name: book.name, longName: book.longName, abbreviation: book.abbreviation, testament: book.testament, chapterCount: book.chapters.length, verseCount };
  if (book.isDeuterocanonical) manifestBook.isDeuterocanonical = true;
  books.push(manifestBook);
  await writeFile(join(outputRoot, `${book.slug}.json`), JSON.stringify(book), "utf8");
}

async function writeAdditional(slug) {
  const source = sourceBySlug.get(slug);
  if (!source) throw new Error(`Fonte ausente para ${slug}`);
  await writeBook({ ...source, testament: "old", chapters: remoteChapters.get(slug) });
}

for (const manifestBook of baseManifest.books) {
  const baseBook = JSON.parse(await readFile(join(baseRoot, `${manifestBook.slug}.json`), "utf8"));
  const source = sourceBySlug.get(baseBook.slug);
  if (source) baseBook.chapters = remoteChapters.get(baseBook.slug);
  await writeBook(baseBook);
  for (const addedSlug of additionsAfter.get(baseBook.slug) ?? []) await writeAdditional(addedSlug);
}

const verseCount = books.reduce((total, book) => total + book.verseCount, 0);
const chapterCount = books.reduce((total, book) => total + book.chapterCount, 0);
await writeFile(join(outputRoot, "manifest.json"), JSON.stringify({ translation: "Edição Chama da Fé", code: "CHAMA-FE-73", canon: "catholic-73", source: "Edição Chama da Fé", sourceUrl: "https://chamadafe.com.br/licencas", license: "CC BY 3.0 BR + domínio público", books, bookCount: books.length, chapterCount, verseCount }), "utf8");
await writeFile(join(outputRoot, "ATTRIBUTION.txt"), "Edição Chama da Fé: texto base Bíblia Livre (PorBLivre), licença CC BY 3.0 Brasil; livros deuterocanônicos e adições a Ester e Daniel: tradução da Lykos Company a partir da Catholic Public Domain Version, conforme licença declarada CC BY 3.0 BR + domínio público. Fonte e atribuição: https://chamadafe.com.br/licencas\n", "utf8");

console.log(`Importados ${books.length} livros, ${chapterCount} capítulos e ${verseCount} versículos para Edição Chama da Fé.`);

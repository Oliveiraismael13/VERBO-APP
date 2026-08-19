import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_URL = "https://raw.githubusercontent.com/midvash/bible-data/main/versions/pt/almeida-livre/almeida-livre.json";
const METADATA_URL = "https://raw.githubusercontent.com/midvash/bible-data/main/versions/pt/almeida-livre/metadata.json";
const SOURCE_URL = "https://github.com/midvash/bible-data/tree/main/versions/pt/almeida-livre";
const OUTPUT_DIR = path.join(ROOT, "public", "bible", "almeida1819");

const [baseManifest, sourceBible, sourceMetadata] = await Promise.all([
  readFile(path.join(ROOT, "public", "bible", "manifest.json"), "utf8").then(JSON.parse),
  fetch(DATA_URL).then((response) => {
    if (!response.ok) throw new Error(`Falha ao baixar a Bíblia: HTTP ${response.status}`);
    return response.json();
  }),
  fetch(METADATA_URL).then((response) => {
    if (!response.ok) throw new Error(`Falha ao baixar os metadados: HTTP ${response.status}`);
    return response.json();
  }),
]);

if (baseManifest.books.length !== 66 || sourceBible.books.length !== 66) {
  throw new Error("A importação precisa conter exatamente os 66 livros do cânon protestante.");
}

await mkdir(OUTPUT_DIR, { recursive: true });
const manifestBooks = [];
let chapterCount = 0;
let verseCount = 0;

for (const [index, metadata] of baseManifest.books.entries()) {
  const sourceBook = sourceBible.books[index];
  const chapters = sourceBook.chapters.map((chapter, chapterIndex) => {
    if (chapter.chapter !== chapterIndex + 1) throw new Error(`Capítulo fora de ordem em ${metadata.name}.`);
    return chapter.verses.map(({ number, text }, verseIndex) => {
      if (number !== verseIndex + 1 || !text?.trim()) throw new Error(`Versículo inválido em ${metadata.name} ${chapter.chapter}.`);
      return { number, text: text.trim() };
    });
  });

  if (chapters.length !== metadata.chapterCount) {
    throw new Error(`${metadata.name}: esperado ${metadata.chapterCount} capítulos, recebido ${chapters.length}.`);
  }

  const bookVerseCount = chapters.reduce((sum, verses) => sum + verses.length, 0);
  chapterCount += chapters.length;
  verseCount += bookVerseCount;

  await writeFile(path.join(OUTPUT_DIR, `${metadata.slug}.json`), `${JSON.stringify({
    slug: metadata.slug,
    name: metadata.name,
    longName: metadata.longName,
    abbreviation: metadata.abbreviation,
    testament: metadata.testament,
    chapters,
  })}\n`, "utf8");

  manifestBooks.push({ ...metadata, verseCount: bookVerseCount });
  console.log(`${metadata.name}: ${chapters.length} capítulos, ${bookVerseCount} versículos`);
}

if (chapterCount !== 1189 || verseCount !== sourceMetadata.stats.verses) {
  throw new Error(`Totais inesperados: ${chapterCount} capítulos e ${verseCount} versículos.`);
}

const manifest = {
  translation: sourceMetadata.name,
  code: sourceMetadata.shortName,
  canon: "protestant-66",
  source: "Midvash Bible Data",
  sourceUrl: SOURCE_URL,
  license: "Domínio público",
  books: manifestBooks,
  bookCount: manifestBooks.length,
  chapterCount,
  verseCount,
};

await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest)}\n`, "utf8");
await writeFile(path.join(OUTPUT_DIR, "ATTRIBUTION.txt"), [
  sourceMetadata.name,
  "",
  `Fonte dos dados estruturados: ${SOURCE_URL}`,
  `Página da edição: ${sourceMetadata.readerUrl}`,
  "",
  "O repositório de origem identifica esta edição de 1819 como domínio público.",
  "O script e os metadados do repositório Midvash Bible Data são disponibilizados sob MIT.",
  "",
  `Importado com ${manifest.bookCount} livros, ${chapterCount} capítulos e ${verseCount} versículos.`,
  "",
].join("\n"), "utf8");

console.log(`Importação concluída: ${manifest.bookCount} livros, ${chapterCount} capítulos, ${verseCount} versículos.`);

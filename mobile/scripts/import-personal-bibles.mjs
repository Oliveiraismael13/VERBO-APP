import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceRoot = process.env.BIBLE_SOURCE_DIR;
if (!sourceRoot) throw new Error("Defina BIBLE_SOURCE_DIR apontando para o repositório biblias.");

const ROOT = process.cwd();
const sourceDir = path.join(sourceRoot, "data", "canonical");
const outputRoot = path.join(ROOT, ".private", "bibles");
const baseManifest = JSON.parse(await readFile(path.join(ROOT, "public", "bible", "almeida1819", "manifest.json"), "utf8"));
const versions = [
  ["ACF", "Almeida Corrigida e Fiel"], ["ALM1911", "Almeida 1911"], ["ARA", "Almeida Revista e Atualizada"], ["ARC", "Almeida Revista e Corrigida"], ["AS21", "Almeida Século 21"], ["JFAA", "Almeida Atualizada"], ["KJA", "King James Atualizada"], ["KJF", "King James Fiel"], ["MENS", "A Mensagem"], ["NAA", "Nova Almeida Atualizada"], ["NBV", "Nova Bíblia Viva"], ["NTLH", "Nova Tradução na Linguagem de Hoje"], ["NVI", "Nova Versão Internacional"], ["NVT", "Nova Versão Transformadora"], ["OL", "O Livro"], ["TB", "Tradução Brasileira"], ["VFL", "Versão Fácil de Ler"],
];

for (const [code, translation] of versions) {
  const outputDir = path.join(outputRoot, code.toLowerCase());
  await mkdir(outputDir, { recursive: true });
  let chapterCount = 0;
  let verseCount = 0;
  const books = [];
  const validationNotes = [];

  for (const metadata of baseManifest.books) {
    const source = JSON.parse(await readFile(path.join(sourceDir, code, `${metadata.code}.json`), "utf8"));
    const chapters = source.chapters.map((chapter, chapterIndex) => {
      if (chapter.number !== chapterIndex + 1) validationNotes.push(`${metadata.name}: capítulo ${chapter.number} na posição ${chapterIndex + 1}.`);
      return chapter.verses.map((verse, verseIndex) => {
        if (!Number.isInteger(verse.number) || verse.number < 1 || typeof verse.text !== "string" || !verse.text.trim()) throw new Error(`${code} ${metadata.name} ${chapter.number}: versículo inválido.`);
        if (verseIndex > 0 && verse.number <= chapter.verses[verseIndex - 1].number) validationNotes.push(`${metadata.name} ${chapter.number}: referência ${verse.number} após ${chapter.verses[verseIndex - 1].number}.`);
        return { number: verse.number, text: verse.text.trim() };
      });
    });
    if (chapters.length !== metadata.chapterCount) validationNotes.push(`${metadata.name}: esperado ${metadata.chapterCount} capítulos, recebido ${chapters.length}.`);
    const bookVerseCount = chapters.reduce((total, verses) => total + verses.length, 0);
    chapterCount += chapters.length;
    verseCount += bookVerseCount;
    books.push({ ...metadata, chapterCount: chapters.length, verseCount: bookVerseCount });
    await writeFile(path.join(outputDir, `${metadata.slug}.json`), `${JSON.stringify({ slug: metadata.slug, name: metadata.name, longName: metadata.longName, abbreviation: metadata.abbreviation, testament: metadata.testament, chapters })}\n`);
  }

  if (books.length !== 66) throw new Error(`${code}: cânon incompleto.`);
  await writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify({ translation, code, canon: "protestant-66", source: "damarals/biblias", sourceUrl: "https://github.com/damarals/biblias", license: "Biblioteca pessoal local — verifique a licença de cada tradução", books, bookCount: books.length, chapterCount, verseCount })}\n`);
  await writeFile(path.join(outputDir, "ATTRIBUTION.txt"), `${translation}\n\nFonte dos dados: https://github.com/damarals/biblias\nImportação exclusiva para a biblioteca pessoal local.\nA presença do texto na fonte não altera os direitos de cada editora.\n\n${books.length} livros, ${chapterCount} capítulos e ${verseCount} versículos.\n`);
  if (validationNotes.length) await writeFile(path.join(outputDir, "VALIDATION_REQUIRED.txt"), `${translation}\n\nOcorrências preservadas da fonte para revisão posterior:\n${validationNotes.join("\n")}\n`);
  console.log(`${code}: ${books.length} livros, ${chapterCount} capítulos, ${verseCount} versículos`);
}

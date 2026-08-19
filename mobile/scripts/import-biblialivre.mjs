import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const sourceRoot = process.argv[2];
const outputRoot = process.argv[3] ?? join(process.cwd(), "public", "bible");
if (!sourceRoot) throw new Error("Informe o diretório textos/f4/tr da Bíblia Livre.");

const order = [
  "gen", "exod", "lev", "num", "deut", "jos", "juiz", "rute", "1sa", "2sa", "1rs", "2rs", "1crn", "2crn", "esd", "nee", "est", "jo", "sal", "prov", "ecl", "cant", "isa", "jer", "lam", "eze", "dan", "ose", "joel", "amos", "oba", "jon", "miq", "naum", "hab", "sof", "ageu", "zac", "mal",
  "mat", "mar", "luc", "joao", "atos", "rom", "1cor", "2cor", "gal", "efes", "fil", "col", "1tes", "2tes", "1tim", "2tim", "tito", "flm", "heb", "tiag", "1ped", "2ped", "1joao", "2joao", "3joao", "jud", "apo",
];

function field(source, marker) {
  const match = source.match(new RegExp(`\\\\${marker}\\r?\\n([^\\r\\n]+)`));
  return match?.[1]?.trim() ?? "";
}

function parseBook(source, slug, position) {
  const lines = source.replaceAll("\r", "").split("\n");
  const chapters = [];
  let active = null;
  let skipping = false;

  const flush = () => {
    if (!active) return;
    const chapter = active.chapter - 1;
    chapters[chapter] ??= [];
    chapters[chapter].push({ number: active.verse, text: active.parts.join(" ").replace(/\s+/g, " ").trim() });
  };

  for (const raw of lines) {
    const line = raw.trim();
    const verseStart = line.match(/^\\v\s+[^.]+\.(\d+)\.(\d+)$/);
    if (verseStart) {
      flush();
      active = { chapter: Number(verseStart[1]), verse: Number(verseStart[2]), parts: [] };
      skipping = false;
      continue;
    }
    if (/^\\(?:fn|xref|note|desc|key)\b/.test(line)) { skipping = true; continue; }
    if (/^\\\*(?:fn|xref|note|desc|key)\b/.test(line)) { skipping = false; continue; }
    if (!active || skipping || !line || line.startsWith("\\")) continue;
    active.parts.push(line);
  }
  flush();

  return {
    slug,
    code: field(source, "ubs-code"),
    name: field(source, "name-short") || field(source, "name-long"),
    longName: field(source, "name-long"),
    abbreviation: field(source, "abbreviation"),
    testament: position < 39 ? "old" : "new",
    chapters,
  };
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const manifest = [];
let verseCount = 0;
for (const [position, slug] of order.entries()) {
  const source = await readFile(join(sourceRoot, `${slug}.txt`), "utf8");
  const book = parseBook(source, slug, position);
  const count = book.chapters.reduce((sum, chapter) => sum + chapter.length, 0);
  verseCount += count;
  manifest.push({ slug, code: book.code, name: book.name, longName: book.longName, abbreviation: book.abbreviation, testament: book.testament, chapterCount: book.chapters.length, verseCount: count });
  await writeFile(join(outputRoot, `${slug}.json`), JSON.stringify(book), "utf8");
}

await writeFile(join(outputRoot, "manifest.json"), JSON.stringify({ translation: "Bíblia Livre", code: "BLIVRE-TR", canon: "protestant-66", books: manifest, bookCount: manifest.length, verseCount }), "utf8");
await writeFile(join(outputRoot, "ATTRIBUTION.txt"), "Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio e Marco Teles. Edição Textus Receptus. Licença Creative Commons Atribuição 3.0 Brasil. Fonte: https://github.com/blivre/BibliaLivre\n", "utf8");

console.log(`Importados ${manifest.length} livros, ${manifest.reduce((sum, book) => sum + book.chapterCount, 0)} capítulos e ${verseCount} versículos para ${basename(outputRoot)}.`);

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const bibleRoot = join(process.cwd(), "public", "bible");
const translationDirectories = ["", "almeida1819", "chamadafe"];

for (const directory of translationDirectories) {
  const translationRoot = join(bibleRoot, directory);
  const manifest = JSON.parse(await readFile(join(translationRoot, "manifest.json"), "utf8"));
  const entries = [];

  for (const book of manifest.books) {
    const source = JSON.parse(await readFile(join(translationRoot, `${book.slug}.json`), "utf8"));
    for (const [chapterIndex, verses] of source.chapters.entries()) {
      for (const verse of verses) entries.push([book.slug, chapterIndex + 1, verse.number, verse.text]);
    }
  }

  await writeFile(join(translationRoot, "ocr-index.json"), JSON.stringify({ version: 1, entries }));
}

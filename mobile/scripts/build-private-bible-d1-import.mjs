import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = process.env.PRIVATE_BIBLE_EXPORT_DIR;
if (!outputDir) throw new Error("Defina PRIVATE_BIBLE_EXPORT_DIR para gerar os arquivos de importação do D1.");

const sourceDir = path.join(process.cwd(), ".private", "bibles");
const maxChunkLength = 60_000;
const sql = (value) => `'${value.replaceAll("'", "''")}'`;

await mkdir(outputDir, { recursive: true });
const translations = await readdir(sourceDir, { withFileTypes: true });

for (const entry of translations.filter((candidate) => candidate.isDirectory())) {
  const directory = path.join(sourceDir, entry.name);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
  } catch {
    continue;
  }

  const code = String(manifest.code || "").toUpperCase();
  if (!/^[A-Z0-9]+$/.test(code) || !Array.isArray(manifest.books)) throw new Error(`${entry.name}: manifesto inválido.`);
  const statements = [
    `DELETE FROM private_bible_book_chunks WHERE translation_code = ${sql(code)};`,
    `DELETE FROM private_bible_translations WHERE code = ${sql(code)};`,
    `INSERT INTO private_bible_translations (code, label, manifest_json, imported_at) VALUES (${sql(code)}, ${sql(String(manifest.translation || code))}, ${sql(JSON.stringify(manifest))}, ${Date.now()});`,
  ];

  for (const book of manifest.books) {
    const bookSlug = String(book.slug || "");
    if (!/^[a-z0-9]+$/.test(bookSlug)) throw new Error(`${code}: livro inválido.`);
    const content = await readFile(path.join(directory, `${bookSlug}.json`), "utf8");
    for (let offset = 0, chunkIndex = 0; offset < content.length; offset += maxChunkLength, chunkIndex += 1) {
      const chunk = content.slice(offset, offset + maxChunkLength);
      statements.push(`INSERT INTO private_bible_book_chunks (translation_code, book_slug, chunk_index, content_chunk) VALUES (${sql(code)}, ${sql(bookSlug)}, ${chunkIndex}, ${sql(chunk)});`);
    }
  }

  await writeFile(path.join(outputDir, `${entry.name}.sql`), `${statements.join("\n")}\n`);
  console.log(`${code}: ${manifest.books.length} livros preparados.`);
}

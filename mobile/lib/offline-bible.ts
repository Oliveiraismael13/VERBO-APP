export type OfflineBibleBook = { slug: string };
export type OfflineBibleManifest = { books: OfflineBibleBook[] };
export type OfflineBibleSource = { path: string; private?: boolean };

const OFFLINE_BIBLE_CACHE = "verbo-bible-offline-v1";
const OCR_ASSETS = ["/ocr/worker.min.js", "/ocr/tesseract-core-lstm.wasm.js", "/ocr/por.traineddata.gz"];

function resourceUrl(source: OfflineBibleSource, resource: string) {
  return `${source.path}/${resource}${source.private ? "" : ".json"}`;
}

export async function hasOfflineBible(source: OfflineBibleSource) {
  if (typeof caches === "undefined" || source.private) return false;
  const cache = await caches.open(OFFLINE_BIBLE_CACHE);
  return Boolean(await cache.match(resourceUrl(source, "manifest")));
}

export async function downloadBibleForOffline(source: OfflineBibleSource, onProgress: (current: number, total: number) => void) {
  if (source.private) throw new Error("Por segurança, traduções da biblioteca pessoal precisam de conexão para validar sua conta.");
  if (typeof caches === "undefined") throw new Error("Este navegador não oferece armazenamento offline.");

  const manifestUrl = resourceUrl(source, "manifest");
  const manifestResponse = await fetch(manifestUrl, { cache: "no-store" });
  if (!manifestResponse.ok) throw new Error("Não foi possível baixar esta tradução.");
  const manifest = await manifestResponse.clone().json() as OfflineBibleManifest;
  const urls = [manifestUrl, ...manifest.books.map((book) => resourceUrl(source, book.slug)), `${source.path}/ocr-index.json`, ...OCR_ASSETS];
  const cache = await caches.open(OFFLINE_BIBLE_CACHE);

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    const response = url === manifestUrl ? manifestResponse.clone() : await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível concluir o download da tradução.");
    await cache.put(url, response);
    onProgress(index + 1, urls.length);
  }
}

import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const destination = join(process.cwd(), "public", "ocr");
const tesseractDir = dirname(require.resolve("tesseract.js/package.json"));
const coreDir = dirname(require.resolve("tesseract.js-core/package.json", { paths: [tesseractDir] }));
const languageDir = dirname(require.resolve("@tesseract.js-data/por/package.json"));

await mkdir(destination, { recursive: true });
await Promise.all([
  copyFile(join(tesseractDir, "dist", "worker.min.js"), join(destination, "worker.min.js")),
  copyFile(join(coreDir, "tesseract-core-lstm.wasm.js"), join(destination, "tesseract-core-lstm.wasm.js")),
  copyFile(join(languageDir, "4.0.0_best_int", "por.traineddata.gz"), join(destination, "por.traineddata.gz")),
]);

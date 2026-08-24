import { sites } from "@openai/sites-vite-plugin";
import { createReadStream, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";

const { d1, r2 } = hostingConfig;
const d1DatabaseId = process.env.CLOUDFLARE_D1_DATABASE_ID ?? "00000000-0000-4000-8000-000000000000";
const workerName = process.env.CLOUDFLARE_WORKER_NAME ?? "verbo-preview";
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const personalBiblesDir = path.resolve(process.cwd(), ".private", "bibles");

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    server: isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : undefined,
    plugins: [
      vinext(),
      sites(),
      {
        name: "verbo-personal-bibles",
        apply: "serve",
        configureServer(server) {
          server.middlewares.use("/personal-bibles", (request, response, next) => {
            const relativePath = decodeURIComponent(request.url?.split("?")[0] || "").replace(/^\/+/, "");
            if (relativePath === "index.json") {
              const versions = existsSync(personalBiblesDir) ? readdirSync(personalBiblesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(path.join(personalBiblesDir, entry.name, "manifest.json"))).map((entry) => entry.name.toUpperCase()) : [];
              response.setHeader("content-type", "application/json; charset=utf-8");
              response.end(JSON.stringify({ versions }));
              return;
            }
            if (!/^[a-z0-9-]+\/(?:[a-z0-9]+|manifest)\.json$/i.test(relativePath)) return next();
            const filePath = path.resolve(personalBiblesDir, relativePath);
            if (!filePath.startsWith(`${personalBiblesDir}${path.sep}`) || !existsSync(filePath)) return next();
            response.setHeader("content-type", "application/json; charset=utf-8");
            createReadStream(filePath).pipe(response);
          });
        },
      },
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: {
          name: workerName,
          main: "./worker/index.ts",
          compatibility_flags: ["nodejs_compat"],
          d1_databases: d1 ? [{ binding: d1, database_name: "verbo-d1", database_id: d1DatabaseId }] : [],
          r2_buckets: r2 ? [{ binding: r2, bucket_name: "site-creator-r2" }] : [],
        },
      }),
    ],
  };
});

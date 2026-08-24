import { sites } from "@openai/sites-vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";

const { d1, r2 } = hostingConfig;
const d1DatabaseId = process.env.CLOUDFLARE_D1_DATABASE_ID ?? "00000000-0000-4000-8000-000000000000";
const workerName = process.env.CLOUDFLARE_WORKER_NAME ?? "verbo-preview";
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

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

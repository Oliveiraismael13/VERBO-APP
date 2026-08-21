import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), "utf8");
}

test("contains the authenticated Verbo application routes", async () => {
  const page = await text("app/page.tsx");
  const auth = await text("app/auth/page.tsx");
  const progress = await text("app/api/progress/route.ts");

  assert.match(page, /currentUser\(\)/);
  assert.match(page, /<AuthPage \/>/);
  assert.match(auth, /\/api\/auth\/\$\{mode\}/);
  assert.match(auth, /password-toggle/);
  const app = await text("components/VerboApp.tsx");
  const campaign = await text("lib/campaign.ts");
  assert.match(app, />Missões</);
  assert.match(campaign, /A Luz sobre o Abismo/);
  assert.doesNotMatch(app, /O amor que transforma/);
  assert.match(app, /marked-\$\{savedHighlight\}/);
  assert.match(app, /Abrir favoritos/);
  assert.match(app, /mission-mode-banner/);
  assert.match(app, /missionMode && <button className=\{`chapter-complete/);
  assert.match(app, /setReward\(earned\);\s+advanceToNextChapter\(nextProgress\);/);
  assert.doesNotMatch(app, /pendingAdvance/);
  assert.match(app, /homem-50lvl-idle-south\.png/);
  const missions = Array.from(campaign.matchAll(/mission\("([^"]+)", (\d+), (\d+),/g));
  assert.equal(missions.length, 74);
  for (const [, slug, from, to] of missions) {
    assert.match(campaign, new RegExp(`"${slug}:${from}-${to}": narrative\\(`));
  }
  const progressRoute = await text("app/api/progress/route.ts");
  assert.match(progressRoute, /const xpGain = actCompleted \? 100 : missionCompleted \? 80 : 40/);
  assert.match(progressRoute, /const coinGain = actCompleted \? 10 : missionCompleted \? 8 : 4/);
  assert.match(progress, /getSessionUser/);
});

test("contains the account and session implementation", async () => {
  const auth = await text("lib/auth.ts");
  const migration = await text("drizzle/0003_email_password_auth.sql");
  const routes = await Promise.all([
    text("app/api/auth/register/route.ts"),
    text("app/api/auth/login/route.ts"),
    text("app/api/auth/logout/route.ts"),
    text("app/api/auth/me/route.ts"),
  ]);

  assert.match(auth, /PBKDF2/);
  assert.match(auth, /PASSWORD_ITERATIONS = 100000/);
  assert.match(auth, /HttpOnly/);
  assert.match(auth, /InvalidCredentialsError/);
  assert.match(auth, /sessions/);
  assert.match(migration, /password_hash/);
  assert.match(migration, /CREATE TABLE `sessions`/);
  for (const route of routes) assert.match(route, /withCors|clearSessionCookie|startSession|currentUser/);
});

test("keeps the web profile and deep-link behavior available", async () => {
  const html = await readFile(new URL("../../web/index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../../web/js/app.js", import.meta.url), "utf8");

  assert.match(html, /id="perfil"/);
  assert.match(html, /id="achievement-list"/);
  assert.match(script, /openSectionFromHash/);
  assert.match(script, /profilePhoto/);
  assert.match(script, /api\/auth\/register/);
  assert.match(script, /VERBO_AUTH_API_BASE/);
});

test("does not expose a public preview directory", async () => {
  await assert.rejects(access(new URL("public/_sites-preview", root)));
});

test("deploys Google credentials as Worker secrets", async () => {
  const workflow = await readFile(new URL("../.github/workflows/deploy-mobile.yml", root), "utf8");

  assert.match(workflow, /wrangler secret put GOOGLE_CLIENT_ID/);
  assert.match(workflow, /wrangler secret put GOOGLE_CLIENT_SECRET/);
});

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
  const secondaryMissionsRoute = await text("app/api/secondary-missions/route.ts");

  assert.match(page, /currentUser\(\)/);
  assert.match(page, /<AuthPage \/>/);
  assert.match(auth, /\/api\/auth\/\$\{mode\}/);
  assert.match(auth, /password-toggle/);
  const app = await text("components/VerboApp.tsx");
  const styles = await text("app/globals.css");
  const rpgStyles = await text("app/rpg.css");
  const campaign = await text("lib/campaign.ts");
  assert.match(app, />Missões</);
  assert.match(app, /secondaryMissionById/);
  assert.match(app, /MISSÃO SECUNDÁRIA ATIVA/);
  assert.match(app, /secondary-missions/);
  assert.match(app, /Deseja sair da missão\?/);
  assert.match(app, /leaveActiveMission/);
  assert.match(app, /record-replay/);
  assert.match(app, /Começar releitura/);
  assert.match(app, /isSecondaryMissionChapterUnlocked/);
  assert.match(app, /Conclua o capítulo atual para liberar o próximo da missão/);
  assert.match(app, /function MissionInsights/);
  assert.match(app, /PERGAMINHOS DE ESTUDO/);
  assert.match(app, /chapterInsightsUnlocked/);
  assert.match(app, /original-language/);
  assert.match(app, /scrollsUnlocked/);
  assert.match(app, />Social</);
  assert.match(app, /function SocialPage/);
  assert.match(app, /\/api\/social\/friends/);
  assert.match(app, /\/api\/social\/profiles/);
  assert.match(app, /\/api\/social\/feed/);
  assert.match(app, /MISSÃO PRINCIPAL ATUAL/);
  assert.match(app, /ÚLTIMAS CONQUISTAS/);
  assert.match(app, /social-disciple-label/);
  assert.match(app, /Meu perfil/);
  assert.match(app, /social-nav-icon/);
  assert.doesNotMatch(app, /♧/);
  assert.match(app, /screen === "journey" \? "journey-surface"/);
  assert.match(app, /social-profile-page/);
  assert.match(app, /profile-disciple-label/);
  assert.match(app, /Nome da sua conta/);
  assert.match(app, /Editar perfil/);
  assert.match(app, /Trocar foto/);
  assert.match(app, /profile-display-name/);
  assert.match(app, /onDisplayNameChange/);
  assert.match(app, /<PixelDisciple turning \/>/);
  assert.doesNotMatch(app, />Perfil<\/button>/);
  assert.doesNotMatch(app, /go\("profile"\)/);
  assert.match(app, /ANTIGO TESTAMENTO · \$\{oldTestamentBookCount\} LIVROS/);
  assert.match(app, /NOVO TESTAMENTO · 27 LIVROS/);
  assert.match(app, /ESCOLHA UM CAPÍTULO/);
  assert.match(app, /Array\.from\(\{ length: selectedBook\.chapterCount \}/);
  assert.match(app, /choose\(selectedBook\.slug, number\)/);
  assert.match(app, /CHAMADAFE/);
  assert.match(app, /catholic-73/);
assert.match(app, /Livro deuterocanônico/);
assert.doesNotMatch(app, /Por isso, não é utilizado nas missões/);
assert.match(app, /A Edição Chama da Fé não é usada nas missões/);
  assert.match(app, /As missões usam a Bíblia Livre e o cânon protestante de 66 livros/);
  assert.match(campaign, /A Luz sobre o Abismo/);
  assert.doesNotMatch(app, /O amor que transforma/);
  assert.match(app, /marked-\$\{savedHighlight\}/);
  assert.match(app, /Abrir favoritos/);
  assert.match(app, /mission-mode-banner/);
  assert.match(app, /className="chapter-nav chapter-nav-bottom" aria-label="Navegação no fim do capítulo"/);
  assert.match(app, /localStorage\.setItem\("verbo-last-reading", JSON\.stringify\(reading\)\)/);
  assert.match(app, /lastReading: lastReadingRef\.current/);
  assert.match(app, /chapter-complete/);
  assert.match(app, /setReward\(earned\);[\s\S]{0,140}advanceToNextChapter\(nextProgress\);/);
  assert.doesNotMatch(app, /pendingAdvance/);
  assert.match(app, /className="verse-row"/);
  assert.match(app, /verse-tools" aria-label=\{`Ferramentas para/);
  assert.match(app, /function stageProgress/);
  assert.match(app, /CONTEXTO HISTÓRICO/);
  assert.doesNotMatch(app, /MOMENTO DE REFLEXÃO/);
  assert.match(app, /MISSÃO ATUAL · \{progressInStage\.done\} de \{progressInStage\.total\}/);
  assert.match(app, /progress\.profilePhoto \? <ProfilePhoto src=\{progress\.profilePhoto\}/);
  assert.match(app, /className="crest-level"/);
  assert.match(app, /const \[selectedVerses, setSelectedVerses\] = useState<number\[\]>\(\[\]\)/);
  assert.match(app, /selectedVerses\.includes\(number\)/);
  assert.match(app, /keys\.forEach\(\(key\) => \{ highlights\[key\] = color; \}\)/);
  assert.match(auth, /resizeProfilePhoto/);
  assert.match(auth, /type="file" accept="image\/\*"/);
  assert.match(app, /homem-50lvl-idle-south\.png/);
  assert.match(styles, /campaign-mission\.current\{border-color:#ad96db;background:#f6f2fd\}/);
  assert.match(styles, /journey-cta\{width:100%;border:0;border-radius:10px;background:#604a8f/);
  assert.match(styles, /profile-status\{display:flex;align-items:center;gap:5px;white-space:nowrap;border:1px solid #d5c5ef/);
  assert.match(styles, /profile-avatar\{display:grid;place-items:center;width:58px;height:58px;border-radius:50%;overflow:hidden;background:#604a8f/);
  assert.match(styles, /profile-avatar-picker\{position:relative;overflow:visible;cursor:pointer\}/);
  assert.match(styles, /bottom-nav\{[^}]*grid-template-columns:repeat\(5,1fr\)/);
  assert.match(rpgStyles, /\.social-page\{min-height:calc\(100dvh - 148px\)/);
  assert.match(rpgStyles, /\.rpg-shell\.journey-surface,\.rpg-shell\.social-surface\{background:#0b0e18\}/);
  assert.match(rpgStyles, /\.social-profile-page\{min-height:calc\(100dvh - 148px\)/);
  assert.match(rpgStyles, /\.social-profile-card \.social-profile-identity\{/);
  assert.match(rpgStyles, /\.social-campaign>div\{/);
  assert.match(rpgStyles, /\.secondary-mission-list\{/);
  assert.match(rpgStyles, /\.mission-insights\{/);
  assert.match(rpgStyles, /\.mission-insights-locked\{/);
  assert.match(rpgStyles, /\.original-language\{/);
  assert.match(rpgStyles, /@keyframes profile-disciple-turn/);
  assert.match(rpgStyles, /\.profile-name-edit\{/);
  assert.match(rpgStyles, /\.profile-edit-panel\{/);
  assert.match(styles, /left:50%;bottom:-9px;transform:translateX\(-50%\)/);
  assert.match(styles, /\.chapter-grid\{display:grid;grid-template-columns:repeat\(5,1fr\)/);
  assert.match(styles, /\.deuterocanonical-note\{display:flex/);
  const missions = Array.from(campaign.matchAll(/mission\("([^"]+)", (\d+), (\d+),/g));
  assert.equal(missions.length, 74);
  for (const [, slug, from, to] of missions) {
    assert.match(campaign, new RegExp(`"${slug}:${from}-${to}": narrative\\(`));
    assert.match(campaign, new RegExp(`"${slug}:${from}-${to}": "`));
  }
  const progressRoute = await text("app/api/progress/route.ts");
  assert.match(progressRoute, /const baseXpGain = actCompleted \? 100 : missionCompleted \|\| secondaryMissionCompleted \? 80 : 40/);
  assert.match(progressRoute, /function xpWithStreakBonus/);
  assert.match(progressRoute, /const coinGain = actCompleted \? 10 : missionCompleted \|\| secondaryMissionCompleted \? 8 : 4/);
  assert.match(secondaryMissionsRoute, /const replaying = Boolean\(record\?\.active && record\?\.completed_at\)/);
  assert.match(secondaryMissionsRoute, /SET active = 1 WHERE user_id = \? AND mission_id = \?/
  );
  assert.match(secondaryMissionsRoute, /body\.action === "pause"/);
  assert.match(secondaryMissionsRoute, /user_secondary_mission_replays/);
  assert.match(secondaryMissionsRoute, /record-replay/);
  assert.match(progress, /getSessionUser/);
  const libraryRoute = await text("app/api/library/route.ts");
  assert.match(libraryRoute, /last_reading_json/);
  assert.match(libraryRoute, /lastReading: parseLastReading/);
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

test("keeps social privacy behind authenticated public identifiers", async () => {
  const social = await text("lib/social.ts");
  const privacy = await text("app/api/social/privacy/route.ts");
  const friends = await text("app/api/social/friends/route.ts");
  const requests = await text("app/api/social/friends/requests/[id]/route.ts");
  const profile = await text("app/api/social/profiles/[handle]/route.ts");
  const feed = await text("app/api/social/feed/route.ts");
  const reaction = await text("app/api/social/activities/[id]/reaction/route.ts");
  const notifications = await text("app/api/social/notifications/route.ts");
  const blocks = await text("app/api/social/blocks/[handle]/route.ts");
  const secondary = await text("app/api/secondary-missions/route.ts");
  const friendship = await text("app/api/social/friends/[handle]/route.ts");
  const migration = await text("drizzle/0006_social_foundation.sql");
  const socialSafetyMigration = await text("drizzle/0007_social_notifications_blocks.sql");

  assert.match(social, /public_handle/);
  assert.match(social, /social_privacy_settings/);
  assert.match(social, /CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_handle/);
  assert.match(social, /friend_requests/);
  assert.match(social, /social_activities/);
  assert.match(privacy, /currentUser\(\)/);
  assert.match(privacy, /allowFriendRequests/);
  assert.match(privacy, /showFavorites/);
  assert.match(social, /showActivities: true/);
  assert.match(social, /show_activities, updated_at\) VALUES \(\?, 1, \?\)/);
  assert.doesNotMatch(privacy, /email/);
  assert.match(social, /areFriends/);
  assert.match(social, /respondToFriendRequest/);
  assert.match(social, /recordSocialActivity/);
  assert.match(social, /setSocialReaction/);
  assert.match(social, /listSocialNotifications/);
  assert.match(social, /blockSocialUser/);
  assert.match(social, /areUsersBlocked/);
  assert.match(social, /profileVisible/);
  assert.match(friends, /createFriendRequest/);
  assert.match(requests, /body\.action !== "accept"/);
  assert.match(profile, /getSocialProfile/);
  assert.match(feed, /listSocialFeed/);
  assert.match(reaction, /body\.reaction !== "amen"/);
  assert.match(notifications, /markSocialNotificationsRead/);
  assert.match(blocks, /blockSocialUser/);
  assert.match(friendship, /removeFriend/);
  assert.doesNotMatch(friends, /email/);
  assert.doesNotMatch(profile, /email/);
  assert.match(migration, /CREATE TABLE `social_privacy_settings`/);
  assert.match(migration, /`show_activities` integer DEFAULT 1/);
  assert.match(socialSafetyMigration, /CREATE TABLE `social_notifications`/);
  assert.match(socialSafetyMigration, /CREATE TABLE `user_blocks`/);
  assert.match(secondary, /user_secondary_missions/);
  assert.match(secondary, /coins - \?/);
});

test("is installable as a mobile application", async () => {
  const layout = await text("app/layout.tsx");
  const install = await text("components/AppInstall.tsx");
  const manifest = await text("public/manifest.webmanifest");
  const worker = await text("public/sw.js");

  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /className="desktop-gate"/);
  assert.match(layout, /disponível apenas no celular/);
  assert.match(layout, /\/og\.png\?v=2/);
  assert.match(layout, /<AppInstall \/>/);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /"name": "Verbo"/);
  assert.match(manifest, /"short_name": "Verbo"/);
  assert.match(manifest, /"src": "\/icons\/verbo-192\.png"/);
  assert.match(manifest, /"src": "\/icons\/verbo-512\.png"/);
  assert.match(install, /beforeinstallprompt/);
  assert.match(install, /serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(layout, /apple-touch-icon" sizes="180x180" href="\/icons\/verbo-180\.png\?v=2"/);
  assert.match(worker, /!url\.pathname\.startsWith\("\/api\/"\)/);
  const catholicManifest = await text("public/bible/chamadafe/manifest.json");
  const tobit = await text("public/bible/chamadafe/tobias.json");
  assert.match(catholicManifest, /"bookCount":73/);
  assert.match(catholicManifest, /"isDeuterocanonical":true/);
  assert.match(tobit, /"name":"Tobias"/);
});

test("deploys Google credentials as Worker secrets", async () => {
  const workflow = await readFile(new URL("../.github/workflows/deploy-mobile.yml", root), "utf8");

  assert.match(workflow, /wrangler secret put GOOGLE_CLIENT_ID/);
  assert.match(workflow, /wrangler secret put GOOGLE_CLIENT_SECRET/);
});

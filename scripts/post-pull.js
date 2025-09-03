// scripts/post-pull.js
/* Run:  node scripts/post-pull.js
 * Fa in automatico:
 * - npm ci  (se è cambiato package-lock.json o package.json)
 * - npx prisma generate  (se è cambiato prisma/schema.prisma o cartella prisma/)
 * - npx prisma migrate deploy  (se sono cambiate prisma/migrations/**)
 * - npx playwright install  (se non è disponibile, oppure se sono cambiati package* con dipendenze Playwright)
 */
const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(process.cwd(), ".sync-cache.json");

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf8", ...opts }).trim();
}
function run(cmd, args = []) {
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
}

function getHead() {
  try { return sh("git rev-parse HEAD"); } catch { return null; }
}
function getChangedFiles(sinceHash, toHash) {
  try {
    if (!sinceHash) return []; // first run → trattiamo come “tutto potenzialmente cambiato”
    const list = sh(`git diff --name-only ${sinceHash} ${toHash}`);
    return list.split("\n").filter(Boolean);
  } catch (e) {
    // fallback: nessuna lista → forziamo i passi minimi
    return [];
  }
}
function fileChanged(changed, matcher) {
  return changed.some((f) => matcher(f.replace(/\\/g, "/")));
}
function exists(cmd) {
  try { sh(`${cmd} --version`); return true; } catch { return false; }
}

(async () => {
  const head = getHead();
  if (!head) {
    console.log("⚠️  Repo Git non trovato. Esco.");
    process.exit(0);
  }

  // Carica cache
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")); } catch {}
  const lastHash = cache.lastHash || null;

  const changed = getChangedFiles(lastHash, head);
  const firstRun = !lastHash;

  // Heuristics
  const pkgChanged = firstRun || fileChanged(changed, (f) => f === "package-lock.json" || f === "package.json");
  const prismaSchemaChanged = firstRun || fileChanged(changed, (f) => f.startsWith("prisma/"));
  const prismaMigrationsChanged = firstRun || fileChanged(changed, (f) => f.startsWith("prisma/migrations/"));
  const maybePlaywrightChanged = pkgChanged; // semplice euristica: se cambiano i package, potremmo dover reinstallare PW

  // npm ci (solo se necessario)
  if (pkgChanged) {
    console.log("📦 package-lock/package.json modificati → eseguo: npm ci");
    run("npm", ["ci"]);
  } else {
    console.log("📦 package-lock/package.json invariati → salto npm ci");
  }

  // prisma generate (se cambia prisma/*)
  if (prismaSchemaChanged) {
    console.log("🔧 Prisma schema/migrations cambiati o primo run → eseguo: npx prisma generate");
    run("npx", ["prisma", "generate"]);
  } else {
    console.log("🔧 Prisma invariato → salto prisma generate");
  }

  // prisma migrate deploy (solo se ci sono nuove migrazioni)
  if (prismaMigrationsChanged) {
    console.log("🗃️  Nuove migrazioni → eseguo: npx prisma migrate deploy");
    run("npx", ["prisma", "migrate", "deploy"]);
  } else {
    console.log("🗃️  Nessuna nuova migrazione → salto migrate deploy");
  }

  // playwright install (se non presente o se sono cambiati i package)
  let needPW = false;
  try {
    const out = sh("npx playwright --version");
    console.log(`🎭 Playwright presente: ${out}`);
    needPW = maybePlaywrightChanged && !!out; // reinstall solo se pacchetti cambiati
  } catch {
    console.log("🎭 Playwright non trovato → installo");
    needPW = true;
  }
  if (needPW) {
    run("npx", ["playwright", "install"]);
  } else {
    console.log("🎭 Playwright ok → salto install");
  }

  // Salva cache
  fs.writeFileSync(CACHE_PATH, JSON.stringify({ lastHash: head }, null, 2));
  console.log("✅ Sync completata.");
})().catch((e) => {
  console.error("❌ Errore:", e.message);
  process.exit(1);
});

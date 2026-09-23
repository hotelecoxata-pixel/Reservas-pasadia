/**
 * Carga los secretos de notificación del .env local hacia los Workers de Cloudflare.
 *
 * Uso:
 *   npm run secrets:push            # carga los secretos presentes en .env a ambos workers
 *   npm run secrets:push -- --dry   # solo muestra lo que haría, sin subir nada
 *
 * Nota de seguridad: DATABASE_URL solo se sube si apunta a Neon (nunca la URL
 * de la BD embebida local).
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const wranglerBin = new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url);
if (!existsSync(wranglerBin)) {
  console.error("No se encontró wrangler en node_modules (¿npm install?)");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry");

function readEnv() {
  const vars = {};
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
    if (m && m[2] && !line.trim().startsWith("#")) vars[m[1]] = m[2];
  }
  return vars;
}

const env = readEnv();

// DATABASE_URL solo si es de producción (Neon); la local embebida jamás se sube.
const secretKeys = [
  "RESEND_API_KEY",
  "DIGEST_FROM_EMAIL",
  "DIGEST_TO_EMAILS",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_TO_NUMBERS",
  "CRON_SECRET",
  "AUTH_SECRET",
  "DATABASE_URL",
];

const toPush = {};
for (const key of secretKeys) {
  const value = env[key];
  if (!value) continue;
  if (key === "DATABASE_URL" && !value.includes("neon.tech")) {
    console.log(`- ${key}: omitido (la BD local embebida no se sube a producción)`);
    continue;
  }
  toPush[key] = value;
}

const targets = [
  {
    name: "reservas-app (app principal)",
    config: "wrangler.jsonc",
    keys: ["DATABASE_URL", "AUTH_SECRET", "CRON_SECRET", "RESEND_API_KEY", "DIGEST_FROM_EMAIL", "DIGEST_TO_EMAILS", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_TO_NUMBERS"],
  },
  {
    name: "reservas-cron (resumen diario)",
    config: "wrangler.cron.jsonc",
    keys: ["DATABASE_URL", "RESEND_API_KEY", "DIGEST_FROM_EMAIL", "DIGEST_TO_EMAILS", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_TO_NUMBERS"],
  },
];

const keys = Object.keys(toPush);
if (keys.length === 0) {
  console.log("No hay secretos nuevos para subir. Agrega las credenciales al .env (ver .env.example).");
  process.exit(0);
}

console.log("Secretos a subir: " + keys.join(", "));
for (const t of targets) {
  const workerKeys = t.keys.filter((k) => toPush[k] !== undefined);
  if (workerKeys.length === 0) continue;
  console.log(`\n==> ${t.name}`);
  for (const key of workerKeys) {
    if (dryRun) {
      console.log(`  [dry] wrangler secret put ${key} --config ${t.config}`);
      continue;
    }
    const r = spawnSync(process.execPath, [fileURLToPath(wranglerBin), "secret", "put", key, "--config", t.config], {
      input: `${toPush[key]}\n`,
      encoding: "utf8",
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const ok = r.status === 0;
    console.log(`  ${ok ? "OK " : "ERR"} ${key}`);
    if (!ok) console.log((r.stderr || r.stdout || "").split("\n").filter(Boolean).slice(-3).join("\n"));
  }
}
console.log(dryRun ? "\n(dry-run: no se subió nada)" : "\nListo.");

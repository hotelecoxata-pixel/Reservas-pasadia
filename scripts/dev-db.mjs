/**
 * Postgres embebido para desarrollo local — sin Docker ni instalación.
 *
 * Usa los binarios reales de PostgreSQL 18 que trae `embedded-postgres`
 * (@embedded-postgres/windows-x64) pero los orquesta con `pg_ctl`, que
 * desatacha el proceso del script (evita colgados en Windows) y espera a que
 * el servidor esté listo antes de continuar.
 *
 * Uso:
 *   npm run db:up      # arranca (o reutiliza) + migra + seed
 *   npm run db:down    # detiene el servidor
 *   npm run db:status  # ¿está corriendo?
 *   npm run db:reset   # detiene y borra el cluster por completo
 *
 * `npm run dev` llama automáticamente a `db:up` antes de iniciar Next.js.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import "dotenv/config";

const require = createRequire(import.meta.url);

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_DIR = path.join(PROJECT_ROOT, ".embedded-db");
const LOG_FILE = path.join(DB_DIR, "server.log");
const PG_BIN = path.join(
  PROJECT_ROOT,
  "node_modules/@embedded-postgres/windows-x64/native/bin",
);

const PORT = Number(process.env.DEV_DB_PORT ?? 55432);
const USER = "reservas";
const PASSWORD = "reservas_dev";
const DATABASE = "reservas";
export const LOCAL_DATABASE_URL = `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}`;

const pgCtl = (...args) => execFileSync(path.join(PG_BIN, "pg_ctl.exe"), args, { stdio: "pipe" });

function pgCtlStatus() {
  try {
    pgCtl("-D", DB_DIR, "status");
    return true;
  } catch {
    return false;
  }
}

/** ¿Hay algo aceptando conexiones TCP en el puerto? */
function portOpen(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(PORT, "127.0.0.1");
  });
}

function initCluster() {
  console.log(`→ Inicializando cluster en .embedded-db (puerto ${PORT})…`);
  // initdb exige un --pwfile para auth por contraseña no interactiva.
  const tmp = mkdtempSync(path.join(PROJECT_ROOT, ".pg-init-"));
  const pwFile = path.join(tmp, "pw");
  writeFileSync(pwFile, PASSWORD);
  try {
    execFileSync(
      path.join(PG_BIN, "initdb.exe"),
      [
        "-D", DB_DIR,
        "-U", USER,
        "-A", "password",
        `--pwfile=${pwFile}`,
        "-E", "UTF8",
        "--locale=C",
      ],
      { stdio: "pipe" },
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function startServer() {
  if (pgCtlStatus()) {
    console.log("✓ PostgreSQL embebido ya estaba corriendo.");
    return;
  }
  if (!existsSync(path.join(DB_DIR, "PG_VERSION"))) {
    initCluster();
  }
  console.log("→ Arrancando PostgreSQL embebido…");
  // `pg_ctl start` desata el proceso y espera hasta que esté listo (60 s).
  pgCtl(
    "-D", DB_DIR,
    "-l", LOG_FILE,
    "-o", `-p ${PORT} -c listen_addresses=127.0.0.1`,
    "start",
  );
}

async function ensureDatabase() {
  // CREATE DATABASE no admite IF NOT EXISTS: capturamos 42P04 (ya existe).
  const { Client } = require("pg");
  const client = new Client({
    host: "127.0.0.1",
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: "postgres",
  });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${DATABASE}"`);
    console.log(`→ Base de datos "${DATABASE}" creada.`);
  } catch (error) {
    if (error?.code !== "42P04") throw error;
  } finally {
    await client.end();
  }
}

function runPrisma(args, label) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  console.log(`→ ${label}…`);
  execFileSync(npx, args, {
    stdio: "inherit",
    cwd: PROJECT_ROOT,
    env: { ...process.env, DATABASE_URL: LOCAL_DATABASE_URL },
    shell: process.platform === "win32",
  });
}

/**
 * Mantiene el .env apuntando a la BD local y con secretos de desarrollo.
 * No toca las variables de correo/Telegram que el usuario haya configurado.
 */
function ensureEnvFile() {
  const envPath = path.join(PROJECT_ROOT, ".env");
  let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

  const wanted = {
    DATABASE_URL: LOCAL_DATABASE_URL,
    AUTH_SECRET: "dev-secret-cambiar-en-produccion-0123456789abcdef",
    CRON_SECRET: "dev-cron-secret",
  };

  let changed = false;
  let updated = content;
  for (const [key, value] of Object.entries(wanted)) {
    const line = `${key}="${value}"`;
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(updated)) {
      if (key === "DATABASE_URL" && !updated.includes(`127.0.0.1:${PORT}/${DATABASE}`)) {
        updated = updated.replace(re, line);
        changed = true;
      }
    } else {
      updated = `${updated}${updated && !updated.endsWith("\n") ? "\n" : ""}${line}\n`;
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(envPath, updated);
    console.log("→ .env actualizado con DATABASE_URL local y secretos de desarrollo.");
  }
}

async function main() {
  const command = process.argv[2] ?? "up";

  switch (command) {
    case "up": {
      ensureEnvFile();
      startServer();
      await ensureDatabase();
      console.log(`✓ PostgreSQL embebido listo en 127.0.0.1:${PORT}/${DATABASE}`);
      runPrisma(["prisma", "migrate", "deploy"], "Aplicando migraciones");
      runPrisma(["tsx", "prisma/seed.ts"], "Ejecutando seed");
      break;
    }
    case "down": {
      try {
        pgCtl("-D", DB_DIR, "-m", "fast", "stop");
        console.log("✓ Servidor detenido.");
      } catch {
        console.log("• No había servidor corriendo (o ya estaba detenido).");
      }
      break;
    }
    case "status": {
      const running = pgCtlStatus() && (await portOpen(1000));
      console.log(running ? "corriendo" : "detenido");
      break;
    }
    case "reset": {
      try {
        pgCtl("-D", DB_DIR, "-m", "fast", "stop");
      } catch {
        /* no estaba corriendo */
      }
      if (existsSync(DB_DIR)) {
        rmSync(DB_DIR, { recursive: true, force: true });
        console.log("✓ Cluster eliminado. Ejecuta `db:up` para recrearlo.");
      }
      break;
    }
    default:
      console.error(`Comando desconocido: ${command}`);
      console.error("Uso: node scripts/dev-db.mjs [up|down|status|reset]");
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("✗ Error:", error?.message ?? error);
  process.exit(1);
});

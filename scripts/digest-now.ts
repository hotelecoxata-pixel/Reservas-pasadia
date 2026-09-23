/**
 * Envío real del resumen de HOY usando las credenciales del .env local.
 * Uso: npm run digest:now        (requiere BD embebida activa: npm run db:up)
 * Los canales sin credenciales se reportan como omitidos; los configurados
 * envían de verdad (correo, Telegram y/o WhatsApp).
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runDailyDigest } from "../src/lib/digest";

const dateKey = process.argv[2]; // opcional: YYYY-MM-DD

async function main() {
  const result = await runDailyDigest(prisma, dateKey);
  console.log(`\nResumen del ${result.date}: ${result.total} evento(s)`);
  for (const c of result.channels) {
    console.log(`  ${c.ok ? "OK  " : "FALLO"} ${c.channel}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error("Error:", error instanceof Error ? error.message : error);
  process.exit(1);
});

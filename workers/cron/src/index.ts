/**
 * Worker de cron de Cloudflare: envía el resumen diario de reservas
 * (correo + Telegram) usando la misma lógica que la API de Next.js.
 *
 * Usa el árbol generado prisma-worker (runtime "workerd"), sin el banner de
 * Node que falla dentro de Workers.
 *
 * Configura los secretos con:
 *   npx wrangler secret put DATABASE_URL --config wrangler.cron.jsonc
 *   npx wrangler secret put RESEND_API_KEY --config wrangler.cron.jsonc
 *   ... (y los demás, siempre con --config wrangler.cron.jsonc)
 * O para desarrollo local: workers/cron/.dev.vars
 */

interface ScheduledController {
  cron: string;
  scheduledTime: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

import { runDailyDigest } from "../../../src/lib/digest";
import { prismaWorker } from "../../../src/lib/prismaWorker";

export default {
  async scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(
      runDailyDigest(prismaWorker)
        .then((result) => {
          console.log(
            `[cron] resumen ${result.date}: ${result.total} evento(s). Canales: ${result.channels
              .map((c) => `${c.channel}=${c.ok ? "OK" : "FALLÓ"}${c.detail ? ` (${c.detail})` : ""}`)
              .join("; ")}`,
          );
        })
        .catch((error) => {
          console.error("[cron] error enviando el resumen diario:", error);
        }),
    );
  },
} satisfies ExportedHandler<Record<string, unknown>>;

/**
 * Worker de cron de Cloudflare: envía el resumen diario de reservas
 * (correo + Telegram) usando la misma lógica que la API de Next.js.
 *
 * Configura los secretos con:
 *   wrangler secret put DATABASE_URL --config workers/cron/wrangler.jsonc
 *   wrangler secret put RESEND_API_KEY ... etc.
 * O para desarrollo local: workers/cron/.dev.vars
 */

interface ScheduledController {
  cron: string;
  scheduledTime: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

// La lógica vive en src/lib y solo usa imports relativos + paquetes npm,
// así que se puede reutilizar directamente aquí.
import { runDailyDigest } from "../../src/lib/digest";

export default {
  async scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(
      runDailyDigest()
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

import { NextRequest } from "next/server";

import { handle, jsonError, jsonOk } from "@/lib/api";
import { env } from "@/lib/env";
import { runDailyDigest } from "@/lib/digest";

/**
 * Resumen diario manual (para probar sin esperar al cron).
 * Protegido con CRON_SECRET vía header Authorization: Bearer <secreto>
 * o query param ?secret=<secreto>.
 * Opcional: ?date=YYYY-MM-DD para generar el resumen de otro día.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const secret = env.cronSecret;
    const provided =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("secret");

    if (!secret || !provided || provided !== secret) {
      return jsonError("No autorizado", 401);
    }

    const dateKey = request.nextUrl.searchParams.get("date") ?? undefined;
    const result = await runDailyDigest(dateKey);
    return jsonOk(result);
  });
}

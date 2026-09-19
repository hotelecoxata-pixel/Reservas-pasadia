import { NextRequest } from "next/server";

import { handle, jsonOk, requireAdminUser } from "@/lib/api";
import { runDailyDigest } from "@/lib/digest";

/**
 * Envía ahora mismo el resumen del día (o de ?date=YYYY-MM-DD).
 * Solo para administradores — útil para probar la configuración de
 * correo/Telegram sin esperar al cron.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    await requireAdminUser();
    const dateKey = request.nextUrl.searchParams.get("date") ?? undefined;
    const result = await runDailyDigest(dateKey);
    return jsonOk(result);
  });
}

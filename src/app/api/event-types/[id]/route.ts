import { NextRequest } from "next/server";

import { handle, jsonError, jsonOk, requireAdminUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { eventTypeUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireAdminUser();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = eventTypeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
    }

    const existing = await prisma.eventType.findUnique({ where: { id } });
    if (!existing) return jsonError("Tipo de evento no encontrado", 404);

    const updated = await prisma.eventType.update({
      where: { id },
      data: {
        dailyMaxCapacity: parsed.data.dailyMaxCapacity,
        name: parsed.data.name,
        color: parsed.data.color,
        active: parsed.data.active,
      },
      select: { id: true, code: true, name: true, color: true, dailyMaxCapacity: true, active: true, sortOrder: true },
    });
    return jsonOk({ eventType: updated });
  });
}

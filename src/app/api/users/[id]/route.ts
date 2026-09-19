import { NextRequest } from "next/server";

import { handle, jsonError, jsonOk, requireAdminUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireAdminUser();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = userUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
    }
    const data = parsed.data;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return jsonError("Usuario no encontrado", 404);

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        role: data.role,
        active: data.active,
        passwordHash: data.password ? await hashPassword(data.password) : undefined,
      },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
    return jsonOk({ user });
  });
}

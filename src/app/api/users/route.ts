import { NextRequest } from "next/server";

import { handle, jsonError, jsonOk, requireAdminUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { userCreateSchema } from "@/lib/validation";

export async function GET() {
  return handle(async () => {
    await requireAdminUser();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
    return jsonOk({ users });
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    await requireAdminUser();

    const body = await request.json().catch(() => null);
    const parsed = userCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
    }

    const email = parsed.data.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return jsonError("Ya existe un usuario con ese email", 409);

    const user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name,
        passwordHash: await hashPassword(parsed.data.password),
        role: parsed.data.role,
      },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
    return jsonOk({ user }, 201);
  });
}

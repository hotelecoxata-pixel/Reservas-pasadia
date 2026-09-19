import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, createSessionToken, sessionCookieOptions, verifyPassword } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || !user.active) {
      return jsonError("Credenciales inválidas", 401);
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return jsonError("Credenciales inválidas", 401);
    }

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  });
}

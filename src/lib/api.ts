import { NextResponse } from "next/server";

import { getSession, type SessionUser } from "./auth";

/** Error de negocio con status HTTP asociado. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Envuelve un handler: convierte ApiError en respuesta HTTP limpia. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.status);
    }
    console.error("[api] error no manejado:", error);
    return jsonError("Error interno del servidor", 500);
  }
}

/** Exige sesión activa; lanza 401 si no hay. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new ApiError(401, "No autenticado");
  return session;
}

/** Exige sesión con rol ADMIN; lanza 401/403 según corresponda. */
export async function requireAdminUser(): Promise<SessionUser> {
  const session = await requireUser();
  if (session.role !== "ADMIN") throw new ApiError(403, "Se requiere rol administrador");
  return session;
}

import { SignJWT, jwtVerify } from "jose";

import { env } from "./env";

/**
 * Manejo del token de sesión (JWT firmado en cookie).
 * Archivo separado de auth.ts para que el middleware de Edge
 * no necesite cargar bcrypt.
 */

export const SESSION_COOKIE = "reservas_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12 horas

export type Role = "ADMIN" | "STAFF";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(env.authSecret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: payload.role === "ADMIN" ? "ADMIN" : "STAFF",
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};

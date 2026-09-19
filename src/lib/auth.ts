import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

import { SESSION_COOKIE, verifySessionToken, type Role, type SessionUser } from "./session";

export { SESSION_COOKIE, SESSION_DURATION_SECONDS, createSessionToken, verifySessionToken, sessionCookieOptions } from "./session";
export type { Role, SessionUser } from "./session";

/** Lee la sesión desde la cookie (server components y route handlers). */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

import { handle, jsonOk, requireUser } from "@/lib/api";

/** GET /api/auth/me — usuario de la sesión actual (401 si no hay). */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return jsonOk({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });
}

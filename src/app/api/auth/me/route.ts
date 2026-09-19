import { handle, jsonOk, requireUser } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return jsonOk({ user });
  });
}

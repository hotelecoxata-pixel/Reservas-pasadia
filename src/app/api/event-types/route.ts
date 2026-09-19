import { handle, jsonOk, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return handle(async () => {
    await requireUser();
    const eventTypes = await prisma.eventType.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, code: true, name: true, color: true, dailyMaxCapacity: true, active: true, sortOrder: true },
    });
    return jsonOk({ eventTypes });
  });
}

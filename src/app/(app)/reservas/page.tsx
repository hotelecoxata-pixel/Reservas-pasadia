import ReservationsClient from "@/components/ReservationsClient";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const eventTypes = await prisma.eventType.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, name: true, color: true, dailyMaxCapacity: true, active: true, sortOrder: true },
  });

  return <ReservationsClient eventTypes={eventTypes} />;
}

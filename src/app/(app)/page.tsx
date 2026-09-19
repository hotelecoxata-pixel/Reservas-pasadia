import CalendarClient from "@/components/CalendarClient";
import { prisma } from "@/lib/prisma";
import { todayKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const eventTypes = await prisma.eventType.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, name: true, color: true, dailyMaxCapacity: true, active: true, sortOrder: true },
  });

  return <CalendarClient eventTypes={eventTypes} todayKey={todayKey()} />;
}

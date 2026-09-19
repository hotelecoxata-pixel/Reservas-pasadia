import { prisma } from "./prisma";
import { fromDateKey, toDateKey } from "./dates";

/** Serializa una reserva para el cliente (fechas como "YYYY-MM-DD", sin zonas horarias raras). */
export function serializeReservation(r: {
  id: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  eventTypeId: string;
  date: Date;
  startTime: string;
  endTime: string | null;
  peopleCount: number;
  notes: string | null;
  status: "CONFIRMED" | "CANCELLED";
  createdAt: Date;
  updatedAt: Date;
  eventType: { id: string; code: string; name: string; color: string; dailyMaxCapacity: number };
}) {
  return {
    id: r.id,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerEmail: r.customerEmail,
    eventTypeId: r.eventTypeId,
    eventType: {
      id: r.eventType.id,
      code: r.eventType.code,
      name: r.eventType.name,
      color: r.eventType.color,
      dailyMaxCapacity: r.eventType.dailyMaxCapacity,
    },
    date: toDateKey(r.date),
    startTime: r.startTime,
    endTime: r.endTime,
    peopleCount: r.peopleCount,
    notes: r.notes,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export const reservationInclude = {
  eventType: {
    select: { id: true, code: true, name: true, color: true, dailyMaxCapacity: true },
  },
} as const;

/** Rango [inicio, fin) para una columna DATE en UTC. */
export function dayRange(dateKey: string) {
  const start = fromDateKey(dateKey);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function listReservationsBetween(startKey: string, endKey: string) {
  const start = fromDateKey(startKey);
  const endInclusive = fromDateKey(endKey);
  endInclusive.setUTCDate(endInclusive.getUTCDate() + 1); // fin exclusivo
  const rows = await prisma.reservation.findMany({
    where: { date: { gte: start, lt: endInclusive } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: reservationInclude,
  });
  return rows.map(serializeReservation);
}

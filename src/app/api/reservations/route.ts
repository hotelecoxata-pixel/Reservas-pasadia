import { NextRequest } from "next/server";
import type { Prisma } from "@/generated/prisma/client";

import { handle, jsonError, jsonOk, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { checkDailyCapacity } from "@/lib/capacity";
import { reservationCreateSchema } from "@/lib/validation";
import { fromDateKey } from "@/lib/dates";
import { listReservationsBetween, reservationInclude, serializeReservation } from "@/lib/reservations";

const RANGE = /^\d{4}-\d{2}-\d{2}$/;

/** Error de negocio: cupo diario alcanzado o tipo inactivo. Se mapea a HTTP 409. */
class CapacityError extends Error {}

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requireUser();

    const params = request.nextUrl.searchParams;
    const from = params.get("from");
    const to = params.get("to");
    const q = params.get("q")?.trim();
    const eventTypeId = params.get("eventTypeId") || undefined;
    const status = params.get("status") || undefined;

    // Modo 1: rango de fechas (calendario / lista)
    if (from && to) {
      if (!RANGE.test(from) || !RANGE.test(to)) return jsonError("Fechas inválidas (YYYY-MM-DD)", 422);
      if (from > to) return jsonError("'from' debe ser anterior o igual a 'to'", 422);
      let rows = await listReservationsBetween(from, to);
      if (eventTypeId) rows = rows.filter((r) => r.eventTypeId === eventTypeId);
      if (status === "CONFIRMED" || status === "CANCELLED") rows = rows.filter((r) => r.status === status);
      if (q) rows = rows.filter(containsQuery(q));
      return jsonOk({ reservations: rows });
    }

    // Modo 2: búsqueda general (lista)
    const where: Prisma.ReservationWhereInput = {};
    if (eventTypeId) where.eventTypeId = eventTypeId;
    if (status === "CONFIRMED" || status === "CANCELLED") where.status = status;
    if (q) {
      where.OR = [
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q } },
        { customerEmail: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
      ];
    }
    const rows = await prisma.reservation.findMany({
      where,
      orderBy: [{ date: "desc" }, { startTime: "asc" }],
      take: 200,
      include: reservationInclude,
    });
    return jsonOk({ reservations: rows.map(serializeReservation) });
  });
}

function containsQuery(q: string) {
  const needle = q.toLowerCase();
  return (r: { customerName: string; customerPhone: string | null; customerEmail: string | null; notes: string | null }) =>
    [r.customerName, r.customerPhone, r.customerEmail, r.notes].some((v) => v?.toLowerCase().includes(needle));
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();

    const body = await request.json().catch(() => null);
    const parsed = reservationCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
    }
    const data = parsed.data;

    let created;
    try {
      created = await prisma.$transaction(async (tx) => {
        const [eventTypes, sameDay] = await Promise.all([
          tx.eventType.findMany({ where: { active: true } }),
          tx.reservation.findMany({ where: { date: fromDateKey(data.date) } }),
        ]);

        const capacity = checkDailyCapacity(eventTypes, sameDay, data.eventTypeId);
        if (!capacity.ok) throw new CapacityError(capacity.message);

        return tx.reservation.create({
          data: {
            customerName: data.customerName,
            customerPhone: data.customerPhone ?? null,
            customerEmail: data.customerEmail ?? null,
            eventTypeId: data.eventTypeId,
            date: fromDateKey(data.date),
            startTime: data.startTime,
            endTime: data.endTime ?? null,
            peopleCount: data.peopleCount,
            notes: data.notes ?? null,
            createdById: user.id,
          },
          include: reservationInclude,
        });
      });
    } catch (error) {
      if (error instanceof CapacityError) return jsonError(error.message, 409);
      throw error;
    }

    return jsonOk({ reservation: serializeReservation(created) }, 201);
  });
}

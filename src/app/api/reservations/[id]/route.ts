import { NextRequest } from "next/server";

import { handle, jsonError, jsonOk, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { checkDailyCapacity } from "@/lib/capacity";
import { reservationUpdateSchema, type ReservationUpdateInput } from "@/lib/validation";
import { fromDateKey } from "@/lib/dates";
import { reservationInclude, serializeReservation } from "@/lib/reservations";

type Params = { params: Promise<{ id: string }> };

/** Error de negocio: cupo diario alcanzado o tipo inactivo. Se mapea a HTTP 409. */
class CapacityError extends Error {}

export async function GET(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const row = await prisma.reservation.findUnique({ where: { id }, include: reservationInclude });
    if (!row) return jsonError("Reserva no encontrada", 404);
    return jsonOk({ reservation: serializeReservation(row) });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = reservationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
    }
    const data = parsed.data;

    const existing = await prisma.reservation.findUnique({ where: { id } });
    if (!existing) return jsonError("Reserva no encontrada", 404);

    // Campos que pueden afectar el cupo: tipo y fecha.
    const nextEventTypeId = data.eventTypeId ?? existing.eventTypeId;
    const nextDateKey = data.date ?? existing.date.toISOString().slice(0, 10);
    const capacityMightChange =
      nextEventTypeId !== existing.eventTypeId || nextDateKey !== existing.date.toISOString().slice(0, 10);

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        if (capacityMightChange) {
          const [eventTypes, sameDay] = await Promise.all([
            tx.eventType.findMany(), // incluye inactivos: se pueden editar reservas existentes
            tx.reservation.findMany({ where: { date: fromDateKey(nextDateKey) } }),
          ]);
          const capacity = checkDailyCapacity(eventTypes, sameDay, nextEventTypeId, id);
          if (!capacity.ok) throw new CapacityError(capacity.message);
        }

        return tx.reservation.update({
          where: { id },
          data: {
            customerName: data.customerName,
            customerPhone: data.customerPhone === undefined ? undefined : (data.customerPhone ?? null),
            customerEmail: data.customerEmail === undefined ? undefined : (data.customerEmail ?? null),
            eventTypeId: data.eventTypeId,
            date: data.date ? fromDateKey(data.date) : undefined,
            startTime: data.startTime,
            endTime: data.endTime === undefined ? undefined : (data.endTime ?? null),
            peopleCount: data.peopleCount,
            notes: data.notes === undefined ? undefined : (data.notes ?? null),
            status: data.status,
          },
          include: reservationInclude,
        });
      });
    } catch (error) {
      if (error instanceof CapacityError) return jsonError(error.message, 409);
      throw error;
    }

    return jsonOk({ reservation: serializeReservation(updated) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const existing = await prisma.reservation.findUnique({ where: { id } });
    if (!existing) return jsonError("Reserva no encontrada", 404);
    await prisma.reservation.delete({ where: { id } });
    return jsonOk({ ok: true });
  });
}

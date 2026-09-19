import type { EventType } from "@/generated/prisma/client";

/**
 * Lógica pura de cupos (sin I/O) para poder testearla fácil.
 * Un tipo de evento tiene un máximo de RESERVAS CONFIRMADAS por día.
 */

export type CapacityEventType = Pick<EventType, "id" | "code" | "name" | "dailyMaxCapacity" | "active">;

export type CapacityReservation = {
  id: string;
  eventTypeId: string;
  status: "CONFIRMED" | "CANCELLED";
};

export type CapacityCheckResult =
  | { ok: true }
  | { ok: false; reason: "INACTIVE_EVENT_TYPE" | "DAILY_CAPACITY_REACHED"; message: string; used: number; max: number };

/**
 * Verifica si se puede crear (o reprogramar) una reserva del tipo dado en la fecha dada.
 * @param eventTypes  catálogo de tipos de evento
 * @param sameDayReservations reservas que ya existen ese día (cualquier tipo)
 * @param eventTypeId tipo de la reserva nueva/modificada
 * @param excludeReservationId al editar, la propia reserva no cuenta contra el cupo
 */
export function checkDailyCapacity(
  eventTypes: CapacityEventType[],
  sameDayReservations: CapacityReservation[],
  eventTypeId: string,
  excludeReservationId?: string,
): CapacityCheckResult {
  const eventType = eventTypes.find((t) => t.id === eventTypeId);
  if (!eventType) {
    return {
      ok: false,
      reason: "INACTIVE_EVENT_TYPE",
      message: "El tipo de evento no existe.",
      used: 0,
      max: 0,
    };
  }
  if (!eventType.active) {
    return {
      ok: false,
      reason: "INACTIVE_EVENT_TYPE",
      message: `El tipo de evento "${eventType.name}" está desactivado.`,
      used: 0,
      max: eventType.dailyMaxCapacity,
    };
  }

  const used = sameDayReservations.filter(
    (r) => r.eventTypeId === eventTypeId && r.status === "CONFIRMED" && r.id !== excludeReservationId,
  ).length;

  if (used >= eventType.dailyMaxCapacity) {
    return {
      ok: false,
      reason: "DAILY_CAPACITY_REACHED",
      message: `Cupo completo para "${eventType.name}" ese día: ${used}/${eventType.dailyMaxCapacity} reservas.`,
      used,
      max: eventType.dailyMaxCapacity,
    };
  }

  return { ok: true };
}

/** Ocupación por tipo para mostrar en el calendario: { GRUPOS: {used, max}, ... } */
export function computeDayOccupancy(
  eventTypes: CapacityEventType[],
  sameDayReservations: CapacityReservation[],
): Record<string, { used: number; max: number }> {
  const result: Record<string, { used: number; max: number }> = {};
  for (const t of eventTypes) {
    result[t.code] = {
      used: sameDayReservations.filter((r) => r.eventTypeId === t.id && r.status === "CONFIRMED").length,
      max: t.dailyMaxCapacity,
    };
  }
  return result;
}

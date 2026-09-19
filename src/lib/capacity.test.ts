import { describe, expect, it } from "vitest";

import { checkDailyCapacity, computeDayOccupancy, type CapacityEventType, type CapacityReservation } from "./capacity";

const types: CapacityEventType[] = [
  { id: "t1", code: "GRUPOS", name: "Grupos", dailyMaxCapacity: 2, active: true },
  { id: "t2", code: "PASADIA", name: "Pasadías", dailyMaxCapacity: 20, active: true },
  { id: "t3", code: "SPA", name: "Spa", dailyMaxCapacity: 10, active: false },
];

const res = (id: string, eventTypeId: string, status: "CONFIRMED" | "CANCELLED" = "CONFIRMED"): CapacityReservation => ({
  id,
  eventTypeId,
  status,
});

describe("checkDailyCapacity", () => {
  it("permite reservar cuando hay cupo disponible", () => {
    const result = checkDailyCapacity(types, [res("r1", "t1")], "t1");
    expect(result).toEqual({ ok: true });
  });

  it("rechaza cuando se alcanza el cupo máximo del día", () => {
    const sameDay = [res("r1", "t1"), res("r2", "t1")];
    const result = checkDailyCapacity(types, sameDay, "t1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("DAILY_CAPACITY_REACHED");
      expect(result.used).toBe(2);
      expect(result.max).toBe(2);
      expect(result.message).toContain("Grupos");
    }
  });

  it("no cuenta las reservas canceladas", () => {
    const sameDay = [res("r1", "t2"), res("r2", "t2", "CANCELLED")];
    const result = checkDailyCapacity(types, sameDay, "t2");
    expect(result).toEqual({ ok: true });
  });

  it("al editar, excluye la propia reserva del conteo", () => {
    const sameDay = [res("r1", "t1"), res("r2", "t1")];
    const result = checkDailyCapacity(types, sameDay, "t1", "r1");
    expect(result).toEqual({ ok: true });
  });

  it("permite editar aunque el tipo esté hoy inactivo (reserva existente)", () => {
    const result = checkDailyCapacity(types, [], "t3");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INACTIVE_EVENT_TYPE");
  });

  it("rechaza un tipo de evento inexistente", () => {
    const result = checkDailyCapacity(types, [], "nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INACTIVE_EVENT_TYPE");
  });
});

describe("computeDayOccupancy", () => {
  it("calcula la ocupación por tipo", () => {
    const occ = computeDayOccupancy(types, [res("r1", "t1"), res("r2", "t1"), res("r3", "t2")]);
    expect(occ).toEqual({
      GRUPOS: { used: 2, max: 2 },
      PASADIA: { used: 1, max: 20 },
      SPA: { used: 0, max: 10 },
    });
  });
});

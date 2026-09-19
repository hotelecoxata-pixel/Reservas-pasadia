import { describe, expect, it, vi } from "vitest";

import { addDays, fromDateKey, isValidTimeHHmm, toDateKey, todayKey } from "./dates";

describe("dates", () => {
  it("convierte Date -> key -> Date sin corrimiento de zona horaria", () => {
    const original = fromDateKey("2026-03-15");
    expect(toDateKey(original)).toBe("2026-03-15");
    // Medianoche UTC exacta
    expect(original.toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });

  it("rechaza keys inválidas", () => {
    expect(() => fromDateKey("15/03/2026")).toThrow();
    expect(() => fromDateKey("2026-3-15")).toThrow();
  });

  it("suma días respetando límites de mes", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("todayKey aplica el offset de zona horaria", () => {
    // A mediodía UTC, en UTC-3 son las 9:00 del mismo día
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T12:00:00Z"));
    expect(todayKey(-3)).toBe("2026-09-19");
    expect(todayKey(0)).toBe("2026-09-19");
    // Justo después de medianoche UTC, en UTC-3 todavía es el día anterior
    vi.setSystemTime(new Date("2026-09-19T01:00:00Z"));
    expect(todayKey(-3)).toBe("2026-09-18");
    vi.useRealTimers();
  });

  it("valida horarios HH:mm", () => {
    expect(isValidTimeHHmm("09:30")).toBe(true);
    expect(isValidTimeHHmm("23:59")).toBe(true);
    expect(isValidTimeHHmm("24:00")).toBe(false);
    expect(isValidTimeHHmm("9:30")).toBe(false);
    expect(isValidTimeHHmm("09:5")).toBe(false);
  });
});

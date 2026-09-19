/**
 * Utilidades de fechas. Las fechas de reserva son "solo día" (DATE en Postgres),
 * así que las representamos como "YYYY-MM-DD" y las convertimos a Date UTC
 * al hablar con la base para que no se corran por zona horaria.
 */

/** Formatea un Date (que proviene de una columna DATE) como "YYYY-MM-DD" en UTC. */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Convierte "YYYY-MM-DD" a Date (medianoche UTC) para columnas DATE de Postgres. */
export function fromDateKey(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    throw new Error(`Fecha inválida: ${key} (se espera YYYY-MM-DD)`);
  }
  return new Date(`${key}T00:00:00.000Z`);
}

/** Devuelve "YYYY-MM-DD" de hoy en la zona horaria indicada (default UTC-3, Argentina). */
export function todayKey(tzOffsetHours = -3): string {
  const now = new Date();
  const local = new Date(now.getTime() + tzOffsetHours * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

/** Valida formato de hora "HH:mm" (24h). */
export function isValidTimeHHmm(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/** Suma días a una clave "YYYY-MM-DD". */
export function addDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

import { z } from "zod";

/** "YYYY-MM-DD" */
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)");

/** "HH:mm" 24 horas */
const timeHHmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:mm)");

/** undefined si viene vacío; trim si es string */
const emptyToUndefined = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v);

const optionalTrimmed = (max: number) => z.preprocess(emptyToUndefined, z.string().max(max).optional());

const reservationObject = z.object({
  customerName: z.string().min(2, "El nombre es obligatorio").max(120),
  customerPhone: optionalTrimmed(40),
  customerEmail: z.preprocess(emptyToUndefined, z.string().email("Email inválido").max(120).optional()),
  eventTypeId: z.string().min(1, "Seleccioná un tipo de evento"),
  date: dateKey,
  startTime: timeHHmm,
  endTime: z.preprocess(emptyToUndefined, timeHHmm.optional()),
  peopleCount: z.coerce.number().int().min(1, "Mínimo 1 persona").max(500).default(1),
  notes: optionalTrimmed(1000),
});

export const reservationCreateSchema = reservationObject.refine(
  (data) => !data.endTime || !data.startTime || data.endTime > data.startTime,
  {
    message: "La hora de fin debe ser posterior a la de inicio",
    path: ["endTime"],
  },
);

export const reservationUpdateSchema = reservationObject.partial().extend({
  status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
});

export const eventTypeUpdateSchema = z.object({
  dailyMaxCapacity: z.coerce.number().int().min(0, "El cupo no puede ser negativo").max(200),
  name: z.string().min(2).max(60).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color hexadecimal inválido")
    .optional(),
  active: z.boolean().optional(),
});

export const userCreateSchema = z.object({
  email: z.string().email("Email inválido").max(120),
  name: z.string().min(2, "El nombre es obligatorio").max(80),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
  role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
});

export const userUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  active: z.boolean().optional(),
  password: z.preprocess(emptyToUndefined, z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72).optional()),
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresá la contraseña"),
});

export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>;
export type ReservationUpdateInput = z.infer<typeof reservationUpdateSchema>;
export type EventTypeUpdateInput = z.infer<typeof eventTypeUpdateSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

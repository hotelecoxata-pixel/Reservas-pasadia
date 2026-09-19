# Sistema de Reservas — Grupos, Pasadías y Spa

Aplicación web interna para gestionar reservas de eventos con **calendario visual**, **cupos configurables por tipo de evento y día**, **alta/baja/modificación de reservas** y **resumen diario automático** (correo + Telegram) con el total de eventos del día.

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS
- **FullCalendar** (vistas mes / semana / día)
- **Prisma** (driver adapter `pg`) sobre **PostgreSQL en Neon**
- Sesiones con **JWT firmado en cookie** (jose) + roles ADMIN / STAFF
- **Resend** (correo) y **Telegram Bot** (mensajería) para el resumen diario
- **Cloudflare Workers** (vía adaptador OpenNext) + **Cron Triggers** nativos

## Estructura

```
src/
  app/
    (app)/            # páginas autenticadas: calendario (/), lista (/reservas), admin (/admin)
    api/              # route handlers (auth, reservations, event-types, users, cron)
    login/
  components/         # CalendarClient, ReservationModal, ReservationsClient, AdminClient, TopBar
  lib/                # prisma, auth, session, capacity (lógica de cupos), digest, dates, validation, env
  middleware.ts       # protege todo excepto /login y auth APIs
workers/cron/         # Worker independiente para el Cron Trigger de Cloudflare
prisma/               # schema + migraciones + seed
```

## Puesta en marcha local

La base de datos local es **PostgreSQL embebido** (binarios reales vía `embedded-postgres`) que se instala con las dependencias — no requiere Docker ni instalación de Postgres. `npm run dev` lo arranca, migra y siembra automáticamente antes de iniciar Next.

```bash
npm install
npm run dev                   # arranca BD embebida + http://localhost:3000
```

Scripts de base de datos:

```bash
npm run db:up      # arranca (o reutiliza) Postgres embebido + migraciones + seed
npm run db:down    # detiene el servidor
npm run db:status  # ¿está corriendo?
npm run db:reset   # detiene y borra el cluster (datos de prueba)
```

- Datos y logs en `.embedded-db/` (ignorado por git); puerto configurable con `DEV_DB_PORT` (por defecto 55432).
- El script mantiene `.env` con una `DATABASE_URL` local y secretos de desarrollo; en producción usar la URL de Neon.
- Usuario inicial por defecto: `admin@reservas.local` / `admin1234` (cambialo al entrar; configurable con `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).
- Alternativas: Neon (free tier, pega tu `DATABASE_URL` de Neon en `.env`) o cualquier Postgres vía Docker apuntando `DATABASE_URL` a él.

## Modelo de cupos

- Cada **tipo de evento** tiene un campo **`dailyMaxCapacity`** (editable desde `/admin`).
- Al crear o reprogramar una reserva, la API cuenta las reservas **confirmadas** de ese tipo ese día (en una transacción) y rechaza con **HTTP 409** si el cupo está completo.
- Las reservas **canceladas** liberan cupo; pueden reactivarse.
- El calendario muestra chips de ocupación por día (ej. `GRUPOS 2/3`).

## Notificación diaria

- **Cron Trigger** (definido en `wrangler.jsonc`, horario en UTC — `0 10 * * *` = 07:00 ART) ejecuta `workers/cron`.
- El resumen usa la misma lógica que la API (`src/lib/digest.ts`): arma el total del día por tipo y lo envía por **Resend** y **Telegram**.
- Idempotente: la tabla `notification_log` (única por fecha+canal) evita envíos duplicados; los fallidos se reintentan en el próximo disparo.
- Prueba manual desde `/admin` («Enviar resumen de hoy ahora») o con:
  ```bash
  curl -X POST "https://TU-APP/api/cron/daily-digest?date=2026-09-19" -H "Authorization: Bearer $CRON_SECRET"
  ```

## Despliegue en Cloudflare

1. **Base de datos**: creá un proyecto en [Neon](https://neon.tech) y copiá la connection string (con `?sslmode=require`).
2. **App principal**:
   ```bash
   npx wrangler login
   npm run deploy:cf        # build con OpenNext + deploy del Worker
   npx wrangler secret put DATABASE_URL
   npx wrangler secret put AUTH_SECRET
   npx wrangler secret put CRON_SECRET
   # (opcional) RESEND_API_KEY, DIGEST_FROM_EMAIL, DIGEST_TO_EMAILS,
   #            TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
   npx prisma migrate deploy   # aplica el esquema a la base de producción
   npm run db:seed
   ```
3. **Worker de cron** (envía el resumen diario):
   ```bash
   npm run deploy:cron
   npx wrangler secret put DATABASE_URL --config workers/cron/wrangler.jsonc
   # + los secretos de Resend/Telegram que uses
   ```
4. **Git**: conectá el repo a Workers Builds (dashboard → tu Worker → Settings → Build) para despliegue automático por push. Ajustá el horario del cron en `wrangler.jsonc` (`triggers.crons`, siempre en UTC) y volvé a desplegar.
5. **Dominio propio**: dashboard → tu Worker → Custom Domains (si el dominio ya está en Cloudflare DNS, es un clic).

## Referencia de API (todas requieren sesión, cookie httpOnly)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Inicia sesión |
| POST | `/api/auth/logout` | Cierra sesión |
| GET | `/api/reservations?from&to&q&eventTypeId&status` | Lista por rango (calendario) o búsqueda general |
| POST | `/api/reservations` | Crea (valida cupo, 409 si está completo) |
| GET/PATCH/DELETE | `/api/reservations/:id` | Detalle / editar (incl. cancelar/reactivar) / eliminar |
| GET | `/api/event-types` | Tipos con cupos |
| PATCH | `/api/event-types/:id` *(admin)* | Cupo, color, activo |
| GET/POST | `/api/users` *(admin)* | Listar / crear usuarios |
| PATCH | `/api/users/:id` *(admin)* | Rol, estado, reset de contraseña |
| POST | `/api/cron/daily-digest` | Resumen manual (requiere `CRON_SECRET`) |
| POST | `/api/admin/test-digest` *(admin)* | Resumen inmediato desde la UI |

## Tests

```bash
npm test          # vitest: lógica de cupos y fechas
npm run typecheck # tsc --noEmit
```

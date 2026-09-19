import type { PrismaClient } from "../generated/prisma/client";
import { env } from "./env";
import { fromDateKey, todayKey } from "./dates";

/**
 * Núcleo del resumen diario, compartido entre:
 *  - la API de Next.js (/api/cron/daily-digest, /api/admin/test-digest)
 *  - el Worker de cron de Cloudflare (workers/cron)
 *
 * Recibe el cliente Prisma por inyección (los runtimes de Next y del Worker
 * de cron necesitan clientes generados distintos).
 *
 * Idempotencia: la tabla NotificationLog tiene unique(digestDate, channel),
 * así que aunque el cron se dispare dos veces no se envía el resumen duplicado.
 */

export type DigestLine = {
  code: string;
  name: string;
  color: string;
  count: number;
  capacity: number;
  reservations: { time: string; customerName: string; peopleCount: number }[];
};

export type DigestResult = {
  date: string;
  total: number;
  lines: DigestLine[];
  channels: { channel: "EMAIL" | "TELEGRAM"; ok: boolean; detail?: string }[];
};

function targetDate(dateKey?: string): { key: string; date: Date } {
  const key = dateKey ?? todayKey();
  return { key, date: fromDateKey(key) };
}

/** Reúne los datos del día y arma el resumen (sin enviar nada). */
export async function buildDigest(
  prisma: PrismaClient,
  dateKey?: string,
): Promise<DigestResult> {
  const { key, date } = targetDate(dateKey);

  const [eventTypes, reservations] = await Promise.all([
    prisma.eventType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.reservation.findMany({
      where: { date, status: "CONFIRMED" },
      orderBy: { startTime: "asc" },
      include: { eventType: true },
    }),
  ]);

  const lines: DigestLine[] = eventTypes.map((t) => {
    const of = reservations.filter((r) => r.eventTypeId === t.id);
    return {
      code: t.code,
      name: t.name,
      color: t.color,
      count: of.length,
      capacity: t.dailyMaxCapacity,
      reservations: of.map((r) => ({
        time: r.startTime,
        customerName: r.customerName,
        peopleCount: r.peopleCount,
      })),
    };
  });

  return {
    date: key,
    total: reservations.length,
    lines,
    channels: [],
  };
}

/** Render en texto plano (Telegram y cuerpo alternativo del mail). */
export function renderDigestText(digest: DigestResult): string {
  const header = `Resumen del ${digest.date}: ${digest.total} evento(s) en total`;
  const lines = digest.lines
    .filter((l) => l.count > 0 || l.capacity > 0)
    .map((l) => {
      const detail = l.reservations.map((r) => `   • ${r.time} — ${r.customerName} (${r.peopleCount} pax)`).join("\n");
      return `${l.name}: ${l.count}/${l.capacity}${l.reservations.length ? "\n" + detail : ""}`;
    });
  return [header, ...lines].join("\n");
}

/** Render HTML para el correo. */
export function renderDigestHtml(digest: DigestResult): string {
  const rows = digest.lines
    .map((l) => {
      const items = l.reservations
        .map((r) => `<li>${r.time} — ${escapeHtml(r.customerName)} (${r.peopleCount} personas)</li>`)
        .join("");
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${l.color};margin-right:6px;"></span>
            <strong>${escapeHtml(l.name)}</strong>
          </td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${l.count} / ${l.capacity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${items ? `<ul style="margin:0;padding-left:16px;">${items}</ul>` : "—"}</td>
        </tr>`;
    })
    .join("");

  return `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
    <h2 style="color:#111;">Resumen del ${digest.date}</h2>
    <p style="font-size:18px;">Total de eventos de hoy: <strong>${digest.total}</strong></p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <thead>
        <tr style="text-align:left;color:#555;">
          <th style="padding:8px;border-bottom:2px solid #ddd;">Tipo</th>
          <th style="padding:8px;border-bottom:2px solid #ddd;">Ocupación</th>
          <th style="padding:8px;border-bottom:2px solid #ddd;">Reservas</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** Envía por Resend (si está configurado). Devuelve el resultado del canal. */
export async function sendEmailDigest(digest: DigestResult): Promise<{ ok: boolean; detail?: string }> {
  if (!env.emailConfigured) {
    return { ok: false, detail: "EMAIL no configurado (RESEND_API_KEY / DIGEST_FROM_EMAIL / DIGEST_TO_EMAILS)" };
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(env.resendApiKey);
    const response = await resend.emails.send({
      from: env.digestFromEmail!,
      to: env.digestToEmails,
      subject: `Reservas de hoy (${digest.date}): ${digest.total} evento(s)`,
      text: renderDigestText(digest),
      html: renderDigestHtml(digest),
    });
    if (response.error) return { ok: false, detail: response.error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

/** Envía por Telegram (si está configurado). */
export async function sendTelegramDigest(digest: DigestResult): Promise<{ ok: boolean; detail?: string }> {
  if (!env.telegramConfigured) {
    return { ok: false, detail: "TELEGRAM no configurado (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)" };
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.telegramChatId,
        text: renderDigestText(digest),
        disable_web_page_preview: true,
      }),
    });
    if (!response.ok) {
      return { ok: false, detail: `Telegram API ${response.status}: ${await response.text()}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Orquesta: arma el resumen, envía por los canales configurados y registra en NotificationLog.
 * Idempotente: si ya existe un registro SENT para (fecha, canal), no reenvía.
 */
export async function runDailyDigest(prisma: PrismaClient, dateKey?: string): Promise<DigestResult> {
  const { key } = targetDate(dateKey);
  const digest = await buildDigest(prisma, dateKey);

  const channels: DigestResult["channels"] = [];

  // ---- Email ----
  const emailAlreadySent = await prisma.notificationLog.findUnique({
    where: { digestDate_channel: { digestDate: fromDateKey(key), channel: "EMAIL" } },
  });
  if (emailAlreadySent?.status === "SENT") {
    channels.push({ channel: "EMAIL", ok: true, detail: "ya enviado anteriormente (omitido)" });
  } else {
    const result = await sendEmailDigest(digest);
    channels.push({ channel: "EMAIL", ...result });
    await prisma.notificationLog.upsert({
      where: { digestDate_channel: { digestDate: fromDateKey(key), channel: "EMAIL" } },
      create: { digestDate: fromDateKey(key), channel: "EMAIL", status: result.ok ? "SENT" : "FAILED", detail: result.detail },
      update: { status: result.ok ? "SENT" : "FAILED", detail: result.detail, sentAt: new Date() },
    });
  }

  // ---- Telegram ----
  const tgAlreadySent = await prisma.notificationLog.findUnique({
    where: { digestDate_channel: { digestDate: fromDateKey(key), channel: "TELEGRAM" } },
  });
  if (tgAlreadySent?.status === "SENT") {
    channels.push({ channel: "TELEGRAM", ok: true, detail: "ya enviado anteriormente (omitido)" });
  } else {
    const result = await sendTelegramDigest(digest);
    channels.push({ channel: "TELEGRAM", ...result });
    await prisma.notificationLog.upsert({
      where: { digestDate_channel: { digestDate: fromDateKey(key), channel: "TELEGRAM" } },
      create: { digestDate: fromDateKey(key), channel: "TELEGRAM", status: result.ok ? "SENT" : "FAILED", detail: result.detail },
      update: { status: result.ok ? "SENT" : "FAILED", detail: result.detail, sentAt: new Date() },
    });
  }

  return { ...digest, channels };
}

import { NextRequest } from "next/server";

import { handle, jsonError, jsonOk, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/** Tipos de imagen aceptados como soporte de pago. */
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB por imagen

/** GET /api/reservations/:id/attachments — lista de adjuntos (sin datos). */
export async function GET(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const reservation = await prisma.reservation.findUnique({ where: { id }, select: { id: true } });
    if (!reservation) return jsonError("Reserva no encontrada", 404);

    const rows = await prisma.reservationAttachment.findMany({
      where: { reservationId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
      },
    });

    return jsonOk({
      attachments: rows.map((a) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
        uploadedByName: a.uploadedBy?.name ?? "(usuario eliminado)",
        url: `/api/reservations/${id}/attachments/${a.id}`,
      })),
    });
  });
}

/**
 * POST /api/reservations/:id/attachments — sube una imagen (multipart/form-data, campo "file").
 * Se aceptan PNG/JPEG/WebP hasta 5 MB.
 */
export async function POST(request: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const reservation = await prisma.reservation.findUnique({ where: { id }, select: { id: true } });
    if (!reservation) return jsonError("Reserva no encontrada", 404);

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return jsonError("Falta el archivo (campo \"file\")", 422);

    if (!ALLOWED_MIME.has(file.type)) {
      return jsonError("Formato no soportado. Usa PNG, JPG o WebP.", 415);
    }
    if (file.size === 0) return jsonError("El archivo está vacío", 422);
    if (file.size > MAX_SIZE) return jsonError("La imagen supera el máximo de 5 MB", 413);

    const bytes = new Uint8Array(await file.arrayBuffer());

    const created = await prisma.reservationAttachment.create({
      data: {
        reservationId: id,
        filename: file.name || "imagen",
        mimeType: file.type,
        sizeBytes: bytes.byteLength,
        data: bytes,
        uploadedById: user.id,
      },
      select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
    });

    return jsonOk(
      {
        attachment: {
          ...created,
          createdAt: created.createdAt.toISOString(),
          uploadedByName: user.name,
          url: `/api/reservations/${id}/attachments/${created.id}`,
        },
      },
      201,
    );
  });
}

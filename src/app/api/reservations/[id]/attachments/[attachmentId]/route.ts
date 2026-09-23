import { NextRequest, NextResponse } from "next/server";

import { handle, jsonError, jsonOk, requireUser, requireAdminUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; attachmentId: string }> };

/** GET …/attachments/:attachmentId — sirve la imagen (inline, cacheada). */
export async function GET(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireUser();
    const { id, attachmentId } = await params;

    const row = await prisma.reservationAttachment.findUnique({
      where: { id: attachmentId },
      select: { reservationId: true, mimeType: true, data: true },
    });
    if (!row || row.reservationId !== id) return jsonError("Adjunto no encontrado", 404);

    const body = new Uint8Array(row.data);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": row.mimeType,
        "Content-Length": String(body.byteLength),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachmentId)}`,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  });
}

/** DELETE …/attachments/:attachmentId — elimina el adjunto (solo ADMIN). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireAdminUser();
    const { id, attachmentId } = await params;

    const row = await prisma.reservationAttachment.findUnique({
      where: { id: attachmentId },
      select: { reservationId: true },
    });
    if (!row || row.reservationId !== id) return jsonError("Adjunto no encontrado", 404);

    await prisma.reservationAttachment.delete({ where: { id: attachmentId } });
    return jsonOk({ ok: true });
  });
}

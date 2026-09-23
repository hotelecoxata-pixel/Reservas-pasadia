import { NextRequest } from "next/server";

import { handle, jsonError, jsonOk, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const MAX_BODY = 20_000; // límite razonable para un comentario

/** GET /api/reservations/:id/comments — hilo de comentarios (ascendente). */
export async function GET(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const reservation = await prisma.reservation.findUnique({ where: { id }, select: { id: true } });
    if (!reservation) return jsonError("Reserva no encontrada", 404);

    const comments = await prisma.reservationComment.findMany({
      where: { reservationId: id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { name: true, role: true } } },
    });

    return jsonOk({
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        authorName: c.author?.name ?? "(usuario eliminado)",
        authorRole: c.author?.role ?? null,
      })),
    });
  });
}

/** POST /api/reservations/:id/comments — agrega un comentario al hilo. */
export async function POST(request: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const reservation = await prisma.reservation.findUnique({ where: { id }, select: { id: true } });
    if (!reservation) return jsonError("Reserva no encontrada", 404);

    const body = (await request.json().catch(() => null)) as { body?: unknown } | null;
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    if (!text) return jsonError("El comentario no puede estar vacío", 422);
    if (text.length > MAX_BODY) return jsonError("El comentario es demasiado largo", 413);

    const comment = await prisma.reservationComment.create({
      data: { reservationId: id, authorId: user.id, body: text },
      include: { author: { select: { name: true, role: true } } },
    });

    return jsonOk(
      {
        comment: {
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt.toISOString(),
          authorName: comment.author?.name ?? "(usuario eliminado)",
          authorRole: comment.author?.role ?? null,
        },
      },
      201,
    );
  });
}

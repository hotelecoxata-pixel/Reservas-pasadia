"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/apiClient";
import { shake } from "@/lib/motion";
import Icon from "./icons";

type CommentDTO = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorRole: "ADMIN" | "STAFF" | null;
};

type AttachmentDTO = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedByName: string;
  url: string;
};

type Props = {
  /** null = nueva reserva: las secciones quedan deshabilitadas hasta guardar */
  reservationId: string | null;
  /** cambia cuando se guarda la reserva (para recargar el hilo) */
  revision: number;
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReservationExtras({ reservationId, revision }: Props) {
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [attachments, setAttachments] = useState<AttachmentDTO[]>([]);
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [me, setMe] = useState<{ role: "ADMIN" | "STAFF" } | null>(null);

  const errorRef = useRef<HTMLParagraphElement>(null);

  const loadAll = useCallback(async () => {
    if (!reservationId) return;
    setError(null);
    try {
      const [c, a, meData] = await Promise.all([
        api<{ comments: CommentDTO[] }>(`/api/reservations/${reservationId}/comments`),
        api<{ attachments: AttachmentDTO[] }>(`/api/reservations/${reservationId}/attachments`),
        api<{ user: { role: "ADMIN" | "STAFF" } }>("/api/auth/me").catch(() => null),
      ]);
      setComments(c.comments);
      setAttachments(a.attachments);
      setMe(meData?.user ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar comentarios y adjuntos");
    }
  }, [reservationId]);

  useEffect(() => {
    if (!reservationId) return;
    void loadAll();
  }, [reservationId, revision, loadAll]);

  useEffect(() => {
    if (error) shake(errorRef.current);
  }, [error]);

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    const text = newComment.trim();
    if (!text || !reservationId) return;
    setBusy(true);
    setError(null);
    try {
      const { comment } = await api<{ comment: CommentDTO }>(`/api/reservations/${reservationId}/comments`, {
        method: "POST",
        json: { body: text },
      });
      setComments((prev) => [...prev, comment]);
      setNewComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al comentar");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    if (!reservationId) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { attachment } = await api<{ attachment: AttachmentDTO }>(
        `/api/reservations/${reservationId}/attachments`,
        { method: "POST", body: fd },
      );
      setAttachments((prev) => [...prev, attachment]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir la imagen");
    } finally {
      setBusy(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!reservationId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/reservations/${reservationId}/attachments/${attachmentId}`, { method: "DELETE" });
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar la imagen");
    } finally {
      setBusy(false);
    }
  }

  const disabled = !reservationId;
  const isAdmin = me?.role === "ADMIN";

  return (
    <div className="space-y-4">
      {error && (
        <p ref={errorRef} className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          <Icon name="alert-circle" size={16} className="shrink-0" />
          {error}
        </p>
      )}

      {/* ---------- Comentarios ---------- */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon name="info-circle" size={14} className="text-indigo-600" />
          Comentarios
        </h3>

        {disabled ? (
          <p className="mt-2 text-xs text-slate-400">Guarda la reserva para poder comentar.</p>
        ) : (
          <>
            {comments.length > 0 && (
              <ul className="mt-2 space-y-2">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <p className="whitespace-pre-wrap break-words text-slate-700">{c.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {c.authorName} · {formatTime(c.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addComment} className="mt-2 flex gap-2">
              {/* input con font 16px en móvil (globals.css) evita el zoom de iOS */}
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                maxLength={2000}
                placeholder="Agregar comentario…"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !newComment.trim()}
                className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                aria-label="Enviar comentario"
              >
                <Icon name="paper-plane" size={13} />
              </button>
            </form>
          </>
        )}
      </section>

      {/* ---------- Soportes de pago ---------- */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon name="doc" size={14} className="text-indigo-600" />
          Soportes de pago (imágenes)
        </h3>

        {disabled ? (
          <p className="mt-2 text-xs text-slate-400">Guarda la reserva para poder adjuntar imágenes.</p>
        ) : (
          <>
            {attachments.length > 0 ? (
              <ul className="mt-2 grid grid-cols-3 gap-2">
                {attachments.map((a) => (
                  <li key={a.id} className="relative overflow-hidden rounded-lg bg-slate-100">
                    <a
                      href={a.url}
                      onClick={(e) => {
                        e.preventDefault();
                        setViewer(a.url);
                      }}
                      className="block"
                      aria-label={`Ver ${a.filename}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt={a.filename} className="h-20 w-full object-cover" loading="lazy" />
                    </a>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => removeAttachment(a.id)}
                        disabled={busy}
                        className="absolute right-1 top-1 rounded-md bg-white/90 p-1.5 text-slate-500 shadow hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label={`Eliminar ${a.filename}`}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                    <span className="block truncate px-1.5 py-1 text-[10px] text-slate-500">{a.filename}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-400">Todavía no hay imágenes adjuntas.</p>
            )}

            <label
              className={`mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600 ${busy ? "pointer-events-none opacity-50" : ""}`}
            >
              <Icon name="plus" size={14} />
              <span className="hidden sm:inline">Adjuntar imagen (PNG, JPG o WebP — máx. 5 MB)</span>
              <span className="sm:hidden">Adjuntar imagen (máx. 5 MB)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </>
        )}
      </section>

      {/* ---------- Visor de imágenes ---------- */}
      {viewer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setViewer(null)}
          role="dialog"
          aria-label="Visor de imagen"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewer} alt="Soporte de pago" className="max-h-[85vh] max-w-full rounded-lg shadow-2xl" />
          <button
            type="button"
            onClick={() => setViewer(null)}
            className="absolute right-4 top-4 rounded-md bg-white/90 p-2 text-slate-700 hover:bg-white"
            aria-label="Cerrar visor"
          >
            <Icon name="xmark" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

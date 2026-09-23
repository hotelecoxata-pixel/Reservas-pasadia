"use client";

import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/apiClient";
import { fieldsIn, modalIn, modalOut, shake, successPop } from "@/lib/motion";
import type { EventTypeDTO, ReservationDTO } from "@/lib/types";
import Icon from "./icons";
import ReservationExtras from "./ReservationExtras";

type Props = {
  open: boolean;
  eventTypes: EventTypeDTO[];
  /** Reserva a editar; null = nueva reserva */
  reservation: ReservationDTO | null;
  /** Fecha preseleccionada "YYYY-MM-DD" (al crear desde el calendario) */
  initialDate?: string;
  onSaved: () => void;
  onClose: () => void;
};

const emptyForm = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  eventTypeId: "",
  date: "",
  startTime: "09:00",
  endTime: "",
  peopleCount: 1,
  notes: "",
};

export default function ReservationModal({ open, eventTypes, reservation, initialDate, onSaved, onClose }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<"CONFIRMED" | "CANCELLED">("CONFIRMED");
  /** Id de la reserva recién creada: habilita comentarios/adjuntos sin cerrar el modal. */
  const [createdId, setCreatedId] = useState<string | null>(null);
  /** Se incrementa al guardar para recargar comentarios/adjuntos. */
  const [extrasRevision, setExtrasRevision] = useState(0);

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);

  // Animación de entrada al abrir
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaved(false);
    setCreatedId(null);
    modalIn(overlayRef.current, panelRef.current);
    fieldsIn(panelRef.current?.querySelectorAll("[data-field]"));

    if (reservation) {
      setForm({
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone ?? "",
        customerEmail: reservation.customerEmail ?? "",
        eventTypeId: reservation.eventTypeId,
        date: reservation.date,
        startTime: reservation.startTime,
        endTime: reservation.endTime ?? "",
        peopleCount: reservation.peopleCount,
        notes: reservation.notes ?? "",
      });
      setStatus(reservation.status);
    } else {
      setForm({ ...emptyForm, date: initialDate ?? "", eventTypeId: eventTypes.find((t) => t.active)?.id ?? "" });
      setStatus("CONFIRMED");
    }
  }, [open, reservation, initialDate, eventTypes]);

  useEffect(() => {
    if (error) shake(errorRef.current);
  }, [error]);

  if (!open) return null;

  const selectedType = eventTypes.find((t) => t.id === form.eventTypeId);
  const activeTypes = eventTypes.filter((t) => t.active || t.id === form.eventTypeId);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleClose() {
    // Si se acaba de crear una reserva, refrescar el calendario al cerrar.
    if (!reservation && createdId) onSaved();
    modalOut(overlayRef.current, panelRef.current, onClose);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (reservation) {
        await api(`/api/reservations/${reservation.id}`, { method: "PATCH", json: { ...form, status } });
        setSaved(true);
        successPop(saveBtnRef.current);
        setTimeout(() => {
          onSaved();
          onClose();
        }, 450);
      } else {
        const { reservation: created } = await api<{ reservation: ReservationDTO }>("/api/reservations", {
          method: "POST",
          json: form,
        });
        setCreatedId(created.id);
        setExtrasRevision((r) => r + 1);
        setSaved(true);
        successPop(saveBtnRef.current);
        // No se cierra: el modal pasa a mostrar comentarios y soportes de pago.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (!reservation) return;
    setSaving(true);
    setError(null);
    try {
      const next = status === "CONFIRMED" ? "CANCELLED" : "CONFIRMED";
      await api(`/api/reservations/${reservation.id}`, { method: "PATCH", json: { status: next } });
      setStatus(next);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar el estado");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!reservation) return;
    if (!window.confirm(`¿Eliminar definitivamente la reserva de ${reservation.customerName}?`)) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/reservations/${reservation.id}`, { method: "DELETE" });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={handleClose}
    >
      <div
        ref={panelRef}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Icon name={reservation ? "pencil" : "plus"} size={18} className="text-indigo-600" />
            {reservation ? "Editar reserva" : "Nueva reserva"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <Icon name="xmark" size={16} />
          </button>
        </div>

        <form id="reservation-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2" data-field>
              <label className="block text-sm font-medium text-slate-700">Cliente *</label>
              <input
                required
                minLength={2}
                value={form.customerName}
                onChange={(e) => set("customerName", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                placeholder="Nombre y apellido"
              />
            </div>

            <div data-field>
              <label className="block text-sm font-medium text-slate-700">Teléfono</label>
              <input
                value={form.customerPhone}
                onChange={(e) => set("customerPhone", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                placeholder="+54 9 11 …"
              />
            </div>
            <div data-field>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={form.customerEmail}
                onChange={(e) => set("customerEmail", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="col-span-2" data-field>
              <label className="block text-sm font-medium text-slate-700">Tipo de evento *</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {activeTypes.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => set("eventTypeId", t.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      form.eventTypeId === t.id ? "border-transparent text-white" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                    style={form.eventTypeId === t.id ? { backgroundColor: t.color } : undefined}
                  >
                    {t.name} <span className="opacity-75">({t.dailyMaxCapacity}/día)</span>
                  </button>
                ))}
              </div>
            </div>

            <div data-field>
              <label className="block text-sm font-medium text-slate-700">Fecha *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div data-field>
              <label className="block text-sm font-medium text-slate-700">Personas</label>
              <input
                type="number"
                min={1}
                max={500}
                value={form.peopleCount}
                onChange={(e) => set("peopleCount", Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div data-field>
              <label className="block text-sm font-medium text-slate-700">Hora inicio *</label>
              <input
                type="time"
                required
                value={form.startTime}
                onChange={(e) => set("startTime", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div data-field>
              <label className="block text-sm font-medium text-slate-700">Hora fin</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => set("endTime", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="col-span-2" data-field>
              <label className="block text-sm font-medium text-slate-700">Notas</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                placeholder="Detalles, requerimientos especiales…"
              />
            </div>
          </div>

          {selectedType && !reservation && (
            <p className="flex items-center gap-2 text-xs text-slate-500" data-field>
              <Icon name="info-circle" size={14} className="shrink-0" />
              Cupo de {selectedType.name}: máximo {selectedType.dailyMaxCapacity} reservas por día. El sistema lo validará al
              guardar.
            </p>
          )}

          {error && (
            <p ref={errorRef} className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              <Icon name="alert-circle" size={16} className="shrink-0" />
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex gap-2">
              {reservation && (
                <>
                  <button
                    type="button"
                    onClick={toggleStatus}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <Icon name={status === "CONFIRMED" ? "xmark-circle" : "checkmark-circle"} size={14} />
                    {status === "CONFIRMED" ? "Cancelar reserva" : "Reactivar"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <Icon name="trash" size={14} />
                    Eliminar
                  </button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cerrar
              </button>
              <button
                ref={saveBtnRef}
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saved ? (
                  <>
                    <Icon name="checkmark" size={14} />
                    Guardado
                  </>
                ) : (
                  <>
                    <Icon name="checkmark" size={14} />
                    {saving ? "Guardando…" : "Guardar"}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {(reservation || createdId) && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <ReservationExtras
              reservationId={reservation?.id ?? createdId}
              revision={extrasRevision}
            />
          </div>
        )}
      </div>
    </div>
  );
}

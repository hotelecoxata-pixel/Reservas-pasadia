"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/apiClient";
import { pageEnter, staggerIn } from "@/lib/motion";
import type { EventTypeDTO, ReservationDTO } from "@/lib/types";
import ReservationModal from "./ReservationModal";
import Icon from "./icons";

type Props = { eventTypes: EventTypeDTO[] };

export default function ReservationsClient({ eventTypes }: Props) {
  const [q, setQ] = useState("");
  const [eventTypeId, setEventTypeId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [results, setResults] = useState<ReservationDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ReservationDTO | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    pageEnter(containerRef.current);
  }, []);

  // Animar filas cuando cambian los resultados (tabla en desktop, cards en móvil)
  useEffect(() => {
    staggerIn(tableRef.current?.querySelectorAll("tbody tr"), 18);
    staggerIn(listRef.current?.querySelectorAll("li"), 18);
  }, [results]);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (eventTypeId) params.set("eventTypeId", eventTypeId);
      if (status) params.set("status", status);
      if (from && to) {
        params.set("from", from);
        params.set("to", to);
      }
      const data = await api<{ reservations: ReservationDTO[] }>(`/api/reservations?${params.toString()}`);
      setResults(data.reservations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar");
    } finally {
      setLoading(false);
    }
  }, [q, eventTypeId, status, from, to]);

  // Búsqueda inicial y al cambiar filtros (con pequeño debounce para el texto)
  useEffect(() => {
    const t = setTimeout(() => void search(), q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, eventTypeId, status, from, to]);

  async function toggleStatus(r: ReservationDTO) {
    const next = r.status === "CONFIRMED" ? "CANCELLED" : "CONFIRMED";
    try {
      await api(`/api/reservations/${r.id}`, { method: "PATCH", json: { status: next } });
      await search();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar el estado");
    }
  }

  async function remove(r: ReservationDTO) {
    if (!window.confirm(`¿Eliminar definitivamente la reserva de ${r.customerName} (${r.date})?`)) return;
    try {
      await api(`/api/reservations/${r.id}`, { method: "DELETE" });
      await search();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  const typeById = new Map(eventTypes.map((t) => [t.id, t]));

  return (
    <div ref={containerRef} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-white p-3 shadow-sm sm:flex sm:flex-wrap sm:items-end sm:gap-3 sm:p-4">
        <div className="relative col-span-2">
          <label className="block text-xs font-medium text-slate-500">Buscar</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cliente, teléfono, email o notas…"
            className="mt-1 w-full rounded-md border border-slate-300 px-9 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <Icon name="search" size={14} className="pointer-events-none absolute bottom-2.5 left-3 text-slate-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Tipo</label>
          <select
            value={eventTypeId}
            onChange={(e) => setEventTypeId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Todos</option>
            {eventTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="CONFIRMED">Confirmadas</option>
            <option value="CANCELLED">Canceladas</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Tabla (desktop) */}
      <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm sm:block">
        <table ref={tableRef} className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Horario</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3 text-right">Pax</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Notas</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && results.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  Sin resultados. Probá ajustar los filtros.
                </td>
              </tr>
            )}
            {!loading &&
              results.map((r) => {
                const t = typeById.get(r.eventTypeId);
                return (
                  <tr key={r.id} className={r.status === "CANCELLED" ? "opacity-60" : undefined}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{r.date}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {r.startTime}
                      {r.endTime ? `–${r.endTime}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: t?.color ?? "#94a3b8" }}
                      >
                        {t?.name ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{r.customerName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.customerPhone && <div>{r.customerPhone}</div>}
                      {r.customerEmail && <div className="text-xs">{r.customerEmail}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">{r.peopleCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {r.status === "CONFIRMED" ? "Confirmada" : "Cancelada"}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-500" title={r.notes ?? undefined}>
                      {r.notes ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setEditing(r);
                          setModalOpen(true);
                        }}
                        className="mr-2 inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <Icon name="pencil" size={11} />
                        Editar
                      </button>
                      <button
                        onClick={() => toggleStatus(r)}
                        className="mr-2 inline-flex items-center gap-1 rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                      >
                        <Icon name={r.status === "CONFIRMED" ? "xmark-circle" : "checkmark-circle"} size={11} />
                        {r.status === "CONFIRMED" ? "Cancelar" : "Reactivar"}
                      </button>
                      <button
                        onClick={() => remove(r)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Icon name="trash" size={11} />
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Cards (móvil) */}
      <ul ref={listRef} className="space-y-2 sm:hidden">
        {loading && <li className="rounded-xl bg-white px-4 py-8 text-center text-slate-400 shadow-sm">Cargando…</li>}
        {!loading && results.length === 0 && (
          <li className="rounded-xl bg-white px-4 py-8 text-center text-slate-400 shadow-sm">
            Sin resultados. Probá ajustar los filtros.
          </li>
        )}
        {!loading &&
          results.map((r) => {
            const t = typeById.get(r.eventTypeId);
            return (
              <li key={r.id} className={`rounded-xl bg-white p-3 shadow-sm ${r.status === "CANCELLED" ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: t?.color ?? "#94a3b8" }}
                      >
                        {t?.name ?? "—"}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        {r.date} · {r.startTime}
                        {r.endTime ? `–${r.endTime}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-medium text-slate-900">{r.customerName}</p>
                    <p className="text-xs text-slate-500">
                      {r.peopleCount} pax
                      {r.customerPhone ? ` · ${r.customerPhone}` : ""}
                    </p>
                    {r.notes && <p className="mt-1 line-clamp-2 text-xs text-slate-400">{r.notes}</p>}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {r.status === "CONFIRMED" ? "Confirmada" : "Cancelada"}
                  </span>
                </div>
                <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2">
                  <button
                    onClick={() => {
                      setEditing(r);
                      setModalOpen(true);
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Icon name="pencil" size={11} />
                    Editar
                  </button>
                  <button
                    onClick={() => toggleStatus(r)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md border border-amber-300 px-2 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                  >
                    <Icon name={r.status === "CONFIRMED" ? "xmark-circle" : "checkmark-circle"} size={11} />
                    {r.status === "CONFIRMED" ? "Cancelar" : "Reactivar"}
                  </button>
                  <button
                    onClick={() => remove(r)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md border border-red-200 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <Icon name="trash" size={11} />
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
      </ul>

      <ReservationModal
        open={modalOpen}
        eventTypes={eventTypes}
        reservation={editing}
        onSaved={search}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

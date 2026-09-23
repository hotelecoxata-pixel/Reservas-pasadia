"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

import { api } from "@/lib/apiClient";
import { pageEnter, staggerIn } from "@/lib/motion";
import type { EventTypeDTO, ReservationDTO } from "@/lib/types";
import ReservationModal from "./ReservationModal";
import Icon from "./icons";

type Props = {
  eventTypes: EventTypeDTO[];
  todayKey: string;
};

/** "YYYY-MM-DD" a partir de una Date en la zona horaria LOCAL del navegador. */
function localDateKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function CalendarClient({ eventTypes, todayKey: _todayKey }: Props) {
  const calendarRef = useRef<FullCalendar>(null);
  const [reservations, setReservations] = useState<ReservationDTO[]>([]);
  const [hiddenTypeIds, setHiddenTypeIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReservationDTO | null>(null);
  const [initialDate, setInitialDate] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const chipWrapRef = useRef<HTMLDivElement>(null);

  const activeTypes = useMemo(() => eventTypes.filter((t) => t.active), [eventTypes]);

  useEffect(() => {
    pageEnter(containerRef.current);
    staggerIn(chipWrapRef.current?.querySelectorAll("button"));
  }, []);

  const fetchRange = useCallback(async (start: string, end: string) => {
    setLoading(true);
    try {
      const data = await api<{ reservations: ReservationDTO[] }>(`/api/reservations?from=${start}&to=${end}`);
      setReservations(data.reservations);
    } catch (err) {
      console.error("Error cargando reservas:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  function onDatesSet(info: { start: Date; end: Date }) {
    // `end` es exclusivo; pedimos hasta el último día visible (inclusive).
    const end = new Date(info.end);
    end.setDate(end.getDate() - 1);
    void fetchRange(localDateKey(info.start), localDateKey(end));
  }

  const visibleReservations = reservations.filter((r) => !hiddenTypeIds.has(r.eventTypeId));

  const events = visibleReservations.map((r) => ({
    id: r.id,
    title: `${r.startTime} · ${r.customerName} (${r.peopleCount} pax)`,
    start: `${r.date}T${r.startTime}:00`,
    end: r.endTime ? `${r.date}T${r.endTime}:00` : undefined,
    backgroundColor: r.eventType.color,
    extendedProps: { reservation: r },
    classNames: r.status === "CANCELLED" ? ["opacity-50", "line-through"] : [],
  }));

  /** Ocupación por día para los chips de cupo. */
  const occupancyByDay = useMemo(() => {
    const map = new Map<string, { code: string; color: string; used: number; max: number }[]>();
    for (const t of activeTypes) {
      if (hiddenTypeIds.has(t.id)) continue;
      const confirmed = visibleReservations.filter((r) => r.eventTypeId === t.id && r.status === "CONFIRMED");
      for (const day of new Set(confirmed.map((r) => r.date))) {
        const list = map.get(day) ?? [];
        list.push({
          code: t.code,
          color: t.color,
          used: confirmed.filter((r) => r.date === day).length,
          max: t.dailyMaxCapacity,
        });
        map.set(day, list);
      }
    }
    return map;
  }, [visibleReservations, activeTypes, hiddenTypeIds]);

  function openNew(dateKey?: string) {
    setEditing(null);
    setInitialDate(dateKey);
    setModalOpen(true);
  }

  function openEdit(reservation: ReservationDTO) {
    setEditing(reservation);
    setModalOpen(true);
  }

  async function handleSaved() {
    const api_ = calendarRef.current?.getApi();
    const view = api_?.view;
    if (view) {
      const end = new Date(view.currentEnd);
      end.setDate(end.getDate() - 1);
      await fetchRange(localDateKey(view.currentStart), localDateKey(end));
    }
  }

  function toggleType(id: string) {
    setHiddenTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div ref={containerRef} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div ref={chipWrapRef} className="flex flex-wrap items-center gap-2">
          {activeTypes.map((t) => {
            const hidden = hiddenTypeIds.has(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleType(t.id)}
                className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition sm:py-1.5 ${
                  hidden ? "border-slate-200 bg-white text-slate-400 line-through" : "border-transparent text-white"
                }`}
                style={hidden ? undefined : { backgroundColor: t.color }}
                title={hidden ? "Mostrar" : "Ocultar"}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-white/80" />
                {t.name} <span className="opacity-80">({t.dailyMaxCapacity}/día)</span>
              </button>
            );
          })}
          {loading && <span className="text-sm text-slate-400">Cargando…</span>}
        </div>
        <button
          onClick={() => openNew()}
          className="flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 sm:py-2"
        >
          <Icon name="plus" size={14} />
          <span className="sm:hidden">Nueva</span>
          <span className="hidden sm:inline">Nueva reserva</span>
        </button>
      </div>

      <div className="rounded-xl bg-white p-2 shadow-sm sm:p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
          locale="es"
          firstDay={1}
          height="auto"
          events={events}
          datesSet={onDatesSet}
          dateClick={(info) => openNew(info.dateStr.slice(0, 10))}
          eventClick={(info) => {
            const r = (info.event.extendedProps as { reservation: ReservationDTO }).reservation;
            if (r) openEdit(r);
          }}
          dayCellContent={(arg) => {
            const occ = occupancyByDay.get(localDateKey(arg.date));
            if (!occ || occ.length === 0) return null;
            return {
              html: `<div class="mt-1 flex flex-wrap gap-1">${occ
                .map(
                  (o) =>
                    `<span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white" style="background:${o.color}">${o.code} ${o.used}/${o.max}</span>`,
                )
                .join("")}</div>`,
            };
          }}
          buttonText={{ today: "Hoy", dayGridMonth: "Mes", timeGridWeek: "Semana", timeGridDay: "Día" }}
        />
      </div>

      <ReservationModal
        open={modalOpen}
        eventTypes={eventTypes}
        reservation={editing}
        initialDate={initialDate}
        onSaved={handleSaved}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

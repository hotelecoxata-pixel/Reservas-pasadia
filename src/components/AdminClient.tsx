"use client";

import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/apiClient";
import { alertPulse, pageEnter, shake, staggerIn, successPop } from "@/lib/motion";
import type { EventTypeDTO, UserDTO } from "@/lib/types";
import Icon from "./icons";

type Props = {
  eventTypes: EventTypeDTO[];
  users: UserDTO[];
  currentUserId: string;
  channels: { email: boolean; telegram: boolean };
};

type DigestResult = {
  date: string;
  total: number;
  channels: { channel: string; ok: boolean; detail?: string }[];
};

export default function AdminClient({ eventTypes, users, currentUserId, channels }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pageEnter(containerRef.current);
    staggerIn(containerRef.current?.querySelectorAll("section"), 90);
  }, []);

  return (
    <div ref={containerRef} className="space-y-8">
      <section>
        <h1 className="text-xl font-bold text-slate-900">Administración</h1>
        <p className="text-sm text-slate-500">Cupos por tipo de evento, usuarios del personal y notificaciones.</p>
      </section>

      <EventTypesEditor eventTypes={eventTypes} />
      <UsersManager users={users} currentUserId={currentUserId} />
      <NotificationsPanel channels={channels} />
    </div>
  );
}

/* ---------------- Cupos por tipo de evento ---------------- */

function EventTypesEditor({ eventTypes }: { eventTypes: EventTypeDTO[] }) {
  const [items, setItems] = useState(eventTypes);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) shake(errorRef.current);
  }, [error]);

  function update(id: string, patch: Partial<EventTypeDTO>) {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function save(t: EventTypeDTO) {
    setError(null);
    try {
      const data = await api<{ eventType: EventTypeDTO }>(`/api/event-types/${t.id}`, {
        method: "PATCH",
        json: { dailyMaxCapacity: t.dailyMaxCapacity, active: t.active, color: t.color },
      });
      update(t.id, data.eventType);
      setSavedId(t.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <Icon name="flame" size={18} className="text-indigo-600" />
        Tipos de evento y cupos
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        El cupo es la cantidad máxima de reservas <em>confirmadas</em> por día para cada tipo.
      </p>

      {error && (
        <p ref={errorRef} className="mb-3 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <Icon name="alert-circle" size={16} className="shrink-0" />
          {error}
        </p>
      )}

      <div className="space-y-3">
        {items.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 p-3">
            <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: t.color }} />
            <div className="min-w-[120px]">
              <div className="font-medium text-slate-800">{t.name}</div>
              <div className="text-xs text-slate-400">{t.code}</div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              Cupo/día:
              <input
                type="number"
                min={0}
                max={200}
                value={t.dailyMaxCapacity}
                onChange={(e) => update(t.id, { dailyMaxCapacity: Number(e.target.value) })}
                className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={t.active}
                onChange={(e) => update(t.id, { active: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              Activo
            </label>

            <button
              onClick={() => save(t)}
              className="ml-auto flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {savedId === t.id ? (
                <>
                  <Icon name="checkmark" size={13} />
                  Guardado
                </>
              ) : (
                "Guardar"
              )}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Usuarios ---------------- */

function UsersManager({ users, currentUserId }: { users: UserDTO[]; currentUserId: string }) {
  const [list, setList] = useState(users);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "STAFF" as "ADMIN" | "STAFF" });
  const [creating, setCreating] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) shake(errorRef.current);
  }, [error]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const data = await api<{ user: UserDTO }>("/api/users", { method: "POST", json: form });
      setList((l) => [...l, data.user]);
      setForm({ email: "", name: "", password: "", role: "STAFF" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el usuario");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(u: UserDTO) {
    setError(null);
    try {
      const data = await api<{ user: UserDTO }>(`/api/users/${u.id}`, {
        method: "PATCH",
        json: { active: !u.active },
      });
      setList((l) => l.map((x) => (x.id === u.id ? data.user : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    }
  }

  async function changeRole(u: UserDTO, role: "ADMIN" | "STAFF") {
    setError(null);
    try {
      const data = await api<{ user: UserDTO }>(`/api/users/${u.id}`, { method: "PATCH", json: { role } });
      setList((l) => l.map((x) => (x.id === u.id ? data.user : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    }
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Icon name="users" size={18} className="text-indigo-600" />
        Usuarios del personal
      </h2>
      {error && (
        <p ref={errorRef} className="mb-3 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <Icon name="alert-circle" size={16} className="shrink-0" />
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((u) => (
              <tr key={u.id} className={u.active ? undefined : "opacity-50"}>
                <td className="px-3 py-2 font-medium">
                  {u.name}
                  {u.id === currentUserId && <span className="ml-2 text-xs text-indigo-500">(vos)</span>}
                </td>
                <td className="px-3 py-2 text-slate-600">{u.email}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value as "ADMIN" | "STAFF")}
                    disabled={u.id === currentUserId}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                  >
                    <option value="STAFF">Recepción</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      u.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {u.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => toggleActive(u)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {u.active ? "Desactivar" : "Activar"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={createUser} className="mt-5 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">
        <div>
          <label className="block text-xs font-medium text-slate-500">Nombre</label>
          <input
            required
            minLength={2}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Contraseña (mín. 8)</label>
          <input
            required
            minLength={8}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Rol</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" | "STAFF" })}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="STAFF">Recepción</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Icon name="plus" size={13} />
          {creating ? "Creando…" : "Agregar usuario"}
        </button>
      </form>
    </section>
  );
}

/* ---------------- Notificaciones ---------------- */

function NotificationsPanel({ channels }: { channels: { email: boolean; telegram: boolean } }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<DigestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) shake(errorRef.current);
  }, [error]);

  useEffect(() => {
    if (result) {
      staggerIn(resultRef.current?.querySelectorAll("li"), 60);
      // Si algún canal falló, llamar la atención con un pulso.
      if (result.channels.some((c) => !c.ok)) alertPulse(resultRef.current);
    }
  }, [result]);

  async function sendNow() {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const data = await api<DigestResult>("/api/admin/test-digest", { method: "POST" });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <Icon name="bell" size={18} className="text-indigo-600" />
        Resumen diario
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        Todos los días (10:00 UTC = 07:00 ART, ajustable en <code>wrangler.jsonc</code>) se envía el total de eventos del día
        por los canales configurados.
      </p>

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
            channels.email ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
          }`}
        >
          <Icon name="envelope" size={14} />
          Correo (Resend): {channels.email ? "configurado" : "sin configurar"}
        </span>
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
            channels.telegram ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
          }`}
        >
          <Icon name="paper-plane" size={14} />
          Telegram: {channels.telegram ? "configurado" : "sin configurar"}
        </span>
      </div>

      <button
        onClick={sendNow}
        disabled={sending}
        className="flex items-center gap-1.5 rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
      >
        <Icon name="paper-plane" size={14} />
        {sending ? "Enviando…" : "Enviar resumen de hoy ahora"}
      </button>

      {error && (
        <p ref={errorRef} className="mt-3 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <Icon name="alert-circle" size={16} className="shrink-0" />
          {error}
        </p>
      )}

      {result && (
        <div ref={resultRef} className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Icon name="calendar" size={14} className="text-slate-500" />
            {result.date}: {result.total} evento(s)
          </div>
          <ul className="mt-1 list-disc pl-5 text-slate-600">
            {result.channels.map((c) => (
              <li key={c.channel}>
                {c.channel}: {c.ok ? "enviado correctamente" : `falló${c.detail ? ` — ${c.detail}` : ""}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { api } from "@/lib/apiClient";
import type { SessionUser } from "@/lib/session";
import Icon from "./icons";

const LINKS = [
  { href: "/", label: "Calendario", icon: "calendar" as const },
  { href: "/reservas", label: "Reservas", icon: "list" as const },
  { href: "/admin", label: "Admin", icon: "gear" as const, adminOnly: true },
];

export default function TopBar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 text-lg font-bold text-indigo-600">
              <Icon name="calendar" size={22} />
              Reservas
            </span>
            {/* Links de escritorio */}
            <nav className="hidden gap-1 sm:flex">
              {LINKS.filter((l) => !l.adminOnly || user.role === "ADMIN").map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon name={link.icon} size={14} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* En móvil solo el rol (el nombre ocupa demasiado) */}
            <span className="text-sm text-slate-600">
              <span className="hidden sm:inline">{user.name} </span>
              <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{user.role}</span>
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <Icon name="power" size={14} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Barra inferior tipo app (solo móvil) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-slate-200 bg-white sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegación principal"
      >
        {LINKS.filter((l) => !l.adminOnly || user.role === "ADMIN").map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                active ? "text-indigo-600" : "text-slate-500"
              }`}
            >
              <Icon name={link.icon} size={20} />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

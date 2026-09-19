"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { api } from "@/lib/apiClient";
import type { SessionUser } from "@/lib/session";
import Icon from "./icons";

const LINKS = [
  { href: "/", label: "Calendario", icon: "calendar" as const },
  { href: "/reservas", label: "Reservas", icon: "list" as const },
  { href: "/admin", label: "Administración", icon: "gear" as const, adminOnly: true },
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
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 text-lg font-bold text-indigo-600">
            <Icon name="calendar" size={22} />
            Reservas
          </span>
          <nav className="flex gap-1">
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
          <span className="text-sm text-slate-600">
            {user.name} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{user.role}</span>
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Icon name="power" size={14} />
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}

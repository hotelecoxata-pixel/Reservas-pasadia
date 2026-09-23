import { redirect } from "next/navigation";

import AdminClient from "@/components/AdminClient";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const [eventTypes, users] = await Promise.all([
    prisma.eventType.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, code: true, name: true, color: true, dailyMaxCapacity: true, active: true, sortOrder: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    }),
  ]);

  return (
    <AdminClient
      eventTypes={eventTypes}
      users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      currentUserId={session.id}
      channels={{ email: env.emailConfigured, telegram: env.telegramConfigured, whatsapp: env.whatsappConfigured }}
    />
  );
}

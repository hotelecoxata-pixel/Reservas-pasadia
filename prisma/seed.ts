import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client";
import { createAdapter } from "../src/lib/dbAdapter";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL no está configurada");
}

const prisma = new PrismaClient({ adapter: createAdapter(connectionString) });

const eventTypes = [
  { code: "GRUPOS", name: "Grupos", color: "#6366f1", dailyMaxCapacity: 3, sortOrder: 1 },
  { code: "PASADIA", name: "Pasadías", color: "#10b981", dailyMaxCapacity: 20, sortOrder: 2 },
  { code: "SPA", name: "Spa", color: "#f59e0b", dailyMaxCapacity: 10, sortOrder: 3 },
];

async function main() {
  console.log("→ Sembrando tipos de evento…");
  for (const t of eventTypes) {
    await prisma.eventType.upsert({
      where: { code: t.code },
      create: t,
      update: { name: t.name, color: t.color }, // no pisa cupos ya ajustados por el admin
    });
    console.log(`  ✓ ${t.name} (cupo inicial: ${t.dailyMaxCapacity}/día)`);
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@reservas.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  console.log("→ Sembrando usuario administrador…");
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: "Administrador", passwordHash, role: "ADMIN" },
    update: {},
  });
  console.log(`  ✓ ${adminEmail} (contraseña: ${adminPassword} — cámbiala al entrar)`);

  console.log("✔ Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

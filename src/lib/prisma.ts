import { PrismaClient } from "@/generated/prisma/client";

import { env } from "./env";
import { createAdapter } from "./dbAdapter";

/**
 * Cliente Prisma perezoso: el módulo se puede importar en tiempo de build
 * sin DATABASE_URL (Next.js evalúa los route handlers al recolectar páginas),
 * y la conexión real se crea al primer uso.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const adapter = createAdapter(env.databaseUrl);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

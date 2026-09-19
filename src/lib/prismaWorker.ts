import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma-worker/client";

/**
 * Cliente Prisma para el Worker de cron de Cloudflare.
 *
 * Usa el árbol generado `prisma-worker` (runtime "workerd"), que no tiene el
 * banner de Node (fileURLToPath(import.meta.url)) que falla dentro de Workers.
 * El adaptador Postgres (TCP) funciona en Workers con nodejs_compat.
 */
const globalForPrisma = globalThis as unknown as { prismaWorker?: PrismaClient };

function getClient(): PrismaClient {
  if (!globalForPrisma.prismaWorker) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL no está configurada");
    globalForPrisma.prismaWorker = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }
  return globalForPrisma.prismaWorker;
}

export const prismaWorker: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

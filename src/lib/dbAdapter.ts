import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Elige el driver adecuado según la base de datos:
 * - neon.tech: PrismaNeon (HTTP/WebSocket serverless, ideal para Workers)
 * - resto (Postgres local, Docker, RDS...): PrismaPg (TCP clásico)
 */
export type DbAdapter = PrismaNeon | PrismaPg;

export function createAdapter(connectionString: string): DbAdapter {
  const host = safeHost(connectionString);
  if (host.endsWith("neon.tech")) {
    return new PrismaNeon({ connectionString });
  }
  return new PrismaPg({ connectionString });
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    // connection strings tipo postgres://user:pass@host/db sin scheme válido
    return url.split("@")[1]?.split("/")[0] ?? "";
  }
}

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  var accountingPrisma: PrismaClient | undefined;
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL fehlt.");
  }
  return databaseUrl;
}

function shouldUseSsl(connectionString: string) {
  if (process.env.PGSSLMODE === "disable") return false;

  try {
    const { hostname } = new URL(connectionString);
    return hostname !== "localhost" && hostname !== "127.0.0.1";
  } catch {
    return true;
  }
}

export function getPrisma() {
  if (!globalThis.accountingPrisma) {
    const connectionString = getDatabaseUrl();
    const adapter = new PrismaPg({
      connectionString,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
    });

    globalThis.accountingPrisma = new PrismaClient({ adapter });
  }

  return globalThis.accountingPrisma;
}

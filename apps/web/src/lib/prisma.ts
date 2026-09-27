import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Prisma 7 requires an explicit driver adapter — no more implicit URL-based connection.
// This is the dev-default SQLite adapter; switch to @prisma/adapter-pg (already installed)
// when you flip prisma/schema.prisma's provider to "postgresql" for a real deployment — see
// docs/SETUP.md.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  // better-sqlite3 wants a filesystem path (or ":memory:"), not Prisma's traditional "file:" URI.
  const rawUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const path = rawUrl.startsWith("file:") ? rawUrl.slice("file:".length) : rawUrl;
  const adapter = new PrismaBetterSqlite3({ url: path });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

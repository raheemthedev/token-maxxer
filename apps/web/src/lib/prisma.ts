import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires an explicit driver adapter — no more implicit URL-based connection.
// Postgres (Neon, via Vercel) everywhere — see docs/SETUP.md.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  // A syntactically-valid-but-unreachable placeholder when DATABASE_URL is unset: pg.Pool parses
  // this fine at construction time (no throw), so the app boots and each page's own try/catch
  // around its data fetch — not this module load — is what surfaces "database not configured"
  // (see DatabaseUnavailableNotice). An empty string throws immediately here instead.
  const connectionString = process.env.DATABASE_URL || "postgres://unconfigured:unconfigured@localhost:5432/unconfigured";
  const adapter = new PrismaPg(connectionString);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

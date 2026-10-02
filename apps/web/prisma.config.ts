import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 keeps its datasource URL in config. Generation needs a valid PostgreSQL URL,
// but does not connect; an unconfigured placeholder lets a fresh checkout build safely.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://unconfigured:unconfigured@127.0.0.1:5432/unconfigured",
  },
});

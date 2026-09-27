import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 moved the datasource connection string out of schema.prisma and into this file.
// prisma/schema.prisma keeps only the `provider` (sqlite for dev, postgresql for a real
// deployment — see docs/SETUP.md for switching it).
//
// Falls back to the local dev default instead of `env("DATABASE_URL")`, which throws when the
// var is unset at all — that would break `prisma generate` (needed at build time, no live
// connection required) on a fresh deployment that hasn't been given a real database yet.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
});

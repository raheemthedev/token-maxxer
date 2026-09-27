import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 moved the datasource connection string out of schema.prisma and into this file.
// prisma/schema.prisma keeps only the `provider` (sqlite for dev, postgresql for a real
// deployment — see docs/SETUP.md for switching it).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

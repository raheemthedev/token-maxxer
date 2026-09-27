#!/usr/bin/env node
// Pre-migrations convenience for this early stage: sync the schema to the real database as part
// of every Vercel build (Vercel sets VERCEL=1). Never runs on a local `npm run build`, where
// DATABASE_URL is usually unset or points somewhere the developer doesn't want auto-pushed to.
// Switch to `prisma migrate deploy` before this matters for real user data — see docs/SETUP.md.
import { execSync } from "node:child_process";

if (process.env.VERCEL) {
  console.log("[db-push-on-vercel] Running on Vercel — syncing schema with `prisma db push`.");
  execSync("prisma db push", { stdio: "inherit" });
} else {
  console.log("[db-push-on-vercel] Not running on Vercel — skipping `prisma db push`.");
}

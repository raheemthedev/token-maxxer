import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET() {
  let database = false;
  try { await prisma.usageCounter.count(); database = true; } catch { /* no secrets in health output */ }
  const github = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
  const email = Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM);
  const authentication = Boolean(process.env.AUTH_SECRET && (github || email || process.env.NODE_ENV === "development"));
  const ingestion = Boolean(process.env.COLLECTOR_TOKEN_SECRET || process.env.NODE_ENV === "development");
  const ready = database && authentication && ingestion;
  return NextResponse.json({ ready, database, authentication, ingestion, signIn: { github, email }, collectorVersion: "0.2.0", accountingVersion: 2 },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

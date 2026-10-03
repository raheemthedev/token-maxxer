import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const collectors = await prisma.collector.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true, kind: true, clientVersion: true, createdAt: true, lastSeenAt: true, lastIngestSummary: true, connectorStatuses: true } });
  return NextResponse.json({ collectors }, { headers: { "Cache-Control": "no-store" } });
}

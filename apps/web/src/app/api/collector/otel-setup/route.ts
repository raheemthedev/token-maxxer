import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateCollectorToken, generateProjectSalt, hashCollectorToken } from "@/lib/collectorAuth";
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const userId = session.user.id;
  const token = generateCollectorToken();
  const created = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const cli = await tx.usageEvent.findFirst({ where: { userId, source: "claude_code", connectorVersion: { not: { startsWith: "otel-" } } } });
    if (cli) return null;
    const previous = await tx.collector.findFirst({ where: { userId }, select: { projectSalt: true } });
    return tx.collector.create({ data: { userId, name: "Claude Code (OpenTelemetry)", kind: "otel", tokenHash: hashCollectorToken(token), projectSalt: previous?.projectSalt ?? generateProjectSalt() } });
  });
  if (!created) return NextResponse.json({ error: "Your local collector already tracks Claude Code. Keep that connection to include history and avoid duplicate counts." }, { status: 409 });
  const metricsEndpoint = `${new URL(process.env.AUTH_URL || request.url).origin}/api/otel/v1/metrics`;
  return NextResponse.json({ token, metricsEndpoint, collectorId: created.id }, { headers: { "Cache-Control": "no-store" } });
}

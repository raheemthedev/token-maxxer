import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Revokes a paired collector so it can no longer upload. By default its historical usage stays
 * (it's the user's real usage). With `?usage=delete` the collector is revoked AND every usage
 * record it uploaded is permanently deleted — the only way to remove usage that isn't attributed
 * to a project, and how a mistaken or test collector's data is cleaned up.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const collector = await prisma.collector.findUnique({ where: { id } });
  if (!collector || collector.userId !== session.user.id) {
    return NextResponse.json({ error: "Collector not found." }, { status: 404 });
  }

  const params_ = new URL(request.url).searchParams;
  const deleteUsage = params_.get("usage") === "delete";
  // Only an already-revoked collector can be removed from the list. Usage it uploaded is kept
  // (UsageEvent.collectorId is SetNull) unless `usage=delete` is also passed.
  const remove = params_.get("remove") === "true";
  if (remove && collector.status !== "revoked") {
    return NextResponse.json({ error: "Revoke the collector before removing it." }, { status: 400 });
  }

  const deletedUsageEvents = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${session.user.id}))`;
    if (!remove) await tx.collector.update({ where: { id }, data: { status: "revoked", revokedAt: collector.revokedAt ?? new Date() } });
    let deleted = 0;
    if (deleteUsage) {
      deleted = (await tx.usageEvent.deleteMany({ where: { collectorId: id, userId: session.user.id } })).count;
      await tx.usageCounter.deleteMany({ where: { collectorId: id, userId: session.user.id } });
    }
    if (remove) await tx.collector.delete({ where: { id } });
    return deleted;
  });

  return NextResponse.json({ ok: true, deletedUsageEvents });
}

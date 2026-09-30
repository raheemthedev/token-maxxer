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

  const deleteUsage = new URL(request.url).searchParams.get("usage") === "delete";

  await prisma.collector.update({
    where: { id },
    data: { status: "revoked", revokedAt: collector.revokedAt ?? new Date() },
  });

  let deletedUsageEvents = 0;
  if (deleteUsage) {
    const result = await prisma.usageEvent.deleteMany({ where: { collectorId: id, userId: session.user.id } });
    deletedUsageEvents = result.count;
  }

  return NextResponse.json({ ok: true, deletedUsageEvents });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Revokes a paired collector. Its historical usage stays (it's the user's real usage); it can no longer upload. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const collector = await prisma.collector.findUnique({ where: { id } });
  if (!collector || collector.userId !== session.user.id) {
    return NextResponse.json({ error: "Collector not found." }, { status: 404 });
  }

  await prisma.collector.update({
    where: { id },
    data: { status: "revoked", revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

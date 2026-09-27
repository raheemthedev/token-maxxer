import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
});

/**
 * Merges `sourceId` into `targetId`: every existing usage event moves to the target, and the
 * source project is marked as redirected (`mergedIntoId`) so any *future* usage detected under
 * the source's local fingerprint also lands on the target. This never creates or drops
 * UsageEvent rows — see docs/ACCOUNTING.md's reconciliation invariant.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { sourceId, targetId } = parsed.data;
  if (sourceId === targetId) {
    return NextResponse.json({ error: "Cannot merge a project into itself." }, { status: 400 });
  }

  const [source, target] = await Promise.all([
    prisma.project.findUnique({ where: { id: sourceId } }),
    prisma.project.findUnique({ where: { id: targetId } }),
  ]);
  if (!source || !target || source.userId !== session.user.id || target.userId !== session.user.id) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (source.mergedIntoId || target.mergedIntoId) {
    return NextResponse.json({ error: "One of these projects is already merged elsewhere." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.usageEvent.updateMany({ where: { projectId: sourceId }, data: { projectId: targetId } }),
    prisma.project.update({ where: { id: sourceId }, data: { mergedIntoId: targetId, hidden: true } }),
  ]);

  return NextResponse.json({ ok: true });
}

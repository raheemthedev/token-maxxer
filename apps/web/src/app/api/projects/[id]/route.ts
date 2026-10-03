import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const linkLabels = ["repository", "live", "demo", "release", "video"] as const;

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(80).nullable().optional(),
  visibility: z.enum(["private", "public"]).optional(),
  hidden: z.boolean().optional(),
  linkUrl: z.string().url().max(500).nullable().optional(),
  linkLabel: z.enum(linkLabels).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body.", details: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data;

  const userId = session.user.id;
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const project = await tx.project.findUnique({ where: { id } });
    if (!project || project.userId !== userId) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (patch.linkUrl && !/^https?:\/\//i.test(patch.linkUrl)) {
      return NextResponse.json({ error: "Links must start with http:// or https://." }, { status: 400 });
    }
    const updated = await tx.project.update({ where: { id }, data: patch });
    return NextResponse.json({ project: toPrivateProjectView(updated) });
  });
}

/**
 * Permanently deletes a project AND the usage recorded against it (its total leaves the user's
 * aggregate too — deliberately different from hiding, which never changes totals). Any projects
 * previously merged into this one are redirect stubs with no usage of their own, so they go too.
 * If a collector is still reporting from the same repository, the project reappears on next upload.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const userId = session.user.id;
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const project = await tx.project.findUnique({ where: { id } });
    if (!project || project.userId !== userId) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const events = await tx.usageEvent.deleteMany({ where: { projectId: id, userId } });
    await tx.project.deleteMany({ where: { mergedIntoId: id, userId } });
    await tx.project.delete({ where: { id } });
    return NextResponse.json({ ok: true, deletedUsageEvents: events.count });
  });
}

function toPrivateProjectView(project: {
  id: string;
  opaqueId: string;
  detectedNameLocal: string;
  displayName: string | null;
  visibility: string;
  hidden: boolean;
  linkUrl: string | null;
  linkLabel: string | null;
  description: string | null;
  detectionMethod: string;
}) {
  return project;
}

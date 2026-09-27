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

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body.", details: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data;

  // A project can't go public without a user-approved display name — the raw detected folder
  // name must never be the thing that gets published.
  const nextDisplayName = patch.displayName !== undefined ? patch.displayName : project.displayName;
  const nextVisibility = patch.visibility ?? project.visibility;
  if (nextVisibility === "public" && !nextDisplayName) {
    return NextResponse.json(
      { error: "Set a display name before making a project public." },
      { status: 400 },
    );
  }

  // Only accept an http(s) link and validate it renders safely as a plain URL.
  if (patch.linkUrl && !/^https?:\/\//i.test(patch.linkUrl)) {
    return NextResponse.json({ error: "Links must start with http:// or https://." }, { status: 400 });
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      displayName: patch.displayName === undefined ? undefined : patch.displayName,
      visibility: patch.visibility,
      hidden: patch.hidden,
      linkUrl: patch.linkUrl === undefined ? undefined : patch.linkUrl,
      linkLabel: patch.linkLabel === undefined ? undefined : patch.linkLabel,
      description: patch.description === undefined ? undefined : patch.description,
    },
  });

  return NextResponse.json({ project: toPrivateProjectView(updated) });
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

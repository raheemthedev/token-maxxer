import { prisma } from "./prisma";
import type { ProjectDetectionMethod } from "@token-maxxer/shared";

/** Follows Project.mergedIntoId to the final live project, bounded against accidental cycles. */
export async function resolveMergeChain(projectId: string): Promise<string> {
  let currentId = projectId;
  for (let hops = 0; hops < 10; hops++) {
    const project = await prisma.project.findUnique({
      where: { id: currentId },
      select: { mergedIntoId: true },
    });
    if (!project?.mergedIntoId) return currentId;
    currentId = project.mergedIntoId;
  }
  return currentId;
}

/**
 * Finds or creates the project a fingerprint hash belongs to for this user, following any merge
 * redirect. New projects are always created private/unhidden — nothing becomes visible until the
 * user explicitly approves it (see docs/PRIVACY.md).
 */
export async function resolveOrCreateProject(
  userId: string,
  fingerprintHash: string,
  detectionMethod: ProjectDetectionMethod,
  detectedNameLocal: string,
): Promise<string> {
  const existing = await prisma.project.findUnique({
    where: { userId_fingerprintHash: { userId, fingerprintHash } },
  });
  if (existing) {
    return resolveMergeChain(existing.id);
  }
  const created = await prisma.project.create({
    data: {
      userId,
      fingerprintHash,
      detectionMethod,
      detectedNameLocal,
      visibility: "private",
      hidden: false,
    },
  });
  return created.id;
}

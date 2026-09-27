import { NextResponse } from "next/server";
import { z } from "zod";
import type { PairingExchangeResponse } from "@token-maxxer/shared";
import { prisma } from "@/lib/prisma";
import { generateCollectorToken, generateProjectSalt, hashCollectorToken } from "@/lib/collectorAuth";

const bodySchema = z.object({
  pairingCode: z.string().min(1),
  collectorName: z.string().min(1).max(100),
});

/** Public endpoint: the collector CLI exchanges a dashboard-issued pairing code for a long-lived token. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { pairingCode, collectorName } = parsed.data;

  const code = await prisma.pairingCode.findUnique({ where: { code: pairingCode } });
  if (!code || code.usedAt || code.expiresAt < new Date()) {
    return NextResponse.json({ error: "Pairing code is invalid, expired, or already used." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: code.userId } });
  if (!user?.handle) {
    return NextResponse.json({ error: "User account is not fully set up yet." }, { status: 400 });
  }

  // Reuse one project-hashing salt per user across all their collectors so project fingerprints
  // stay comparable; generate it once, lazily, on first pairing.
  const existingCollectorWithSalt = await prisma.collector.findFirst({
    where: { userId: user.id },
    select: { projectSalt: true },
  });
  const projectSalt = existingCollectorWithSalt?.projectSalt ?? generateProjectSalt();

  const token = generateCollectorToken();
  const collector = await prisma.$transaction(async (tx) => {
    const created = await tx.collector.create({
      data: {
        userId: user.id,
        name: collectorName,
        tokenHash: hashCollectorToken(token),
        projectSalt,
        status: "active",
      },
    });
    await tx.pairingCode.update({ where: { code: pairingCode }, data: { usedAt: new Date() } });
    return created;
  });

  const response: PairingExchangeResponse = {
    collectorId: collector.id,
    token,
    userHandle: user.handle,
    projectSalt,
  };
  return NextResponse.json(response);
}

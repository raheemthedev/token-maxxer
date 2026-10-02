import { NextResponse } from "next/server";
import { z } from "zod";
import type { PairingExchangeResponse } from "@token-maxxer/shared";
import { prisma } from "@/lib/prisma";
import { generateCollectorToken, generateProjectSalt, hashCollectorToken } from "@/lib/collectorAuth";

const bodySchema = z.object({
  pairingCode: z.string().regex(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/),
  collectorName: z.string().min(1).max(100),
  replace: z.boolean().optional(),
});

/** Public endpoint: the collector CLI exchanges a dashboard-issued pairing code for a long-lived token. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { pairingCode, collectorName, replace } = parsed.data;

  const code = await prisma.pairingCode.findUnique({ where: { code: pairingCode } });
  if (!code || code.usedAt || code.expiresAt < new Date()) {
    return NextResponse.json({ error: "Pairing code is invalid, expired, or already used." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: code.userId } });
  if (!user?.handle) {
    return NextResponse.json({ error: "User account is not fully set up yet." }, { status: 400 });
  }


  const previousToken = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const previous = previousToken ? await prisma.collector.findUnique({ where: { tokenHash: hashCollectorToken(previousToken) } }) : null;
  if (previous && previous.userId !== user.id && !replace) return NextResponse.json({ error: "This machine is paired to another account. Add --replace to your install command if you want to switch accounts." }, { status: 409 });
  const token = generateCollectorToken();
  const collector = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
    const claimed = await tx.pairingCode.updateMany({ where: { code: pairingCode, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) return null;
    const prior = await tx.collector.findFirst({ where: { userId: user.id }, select: { projectSalt: true } });
    const projectSalt = prior?.projectSalt ?? generateProjectSalt();
    if (previous?.userId === user.id) return tx.collector.update({ where: { id: previous.id }, data: { tokenHash: hashCollectorToken(token), name: collectorName, status: "active", revokedAt: null, kind: "cli" } });
    if (previous && replace) await tx.collector.update({ where: { id: previous.id }, data: { status: "revoked", revokedAt: new Date() } });
    const created = await tx.collector.create({
      data: {
        userId: user.id,
        name: collectorName,
        tokenHash: hashCollectorToken(token),
        projectSalt,
        status: "active",
      },
    });
    return created;
  });

  if (!collector) return NextResponse.json({ error: "Pairing code is invalid, expired, or already used." }, { status: 400 });
  const response: PairingExchangeResponse = {
    collectorId: collector.id,
    token,
    userHandle: user.handle,
    projectSalt: collector.projectSalt,
  };
  return NextResponse.json(response);
}

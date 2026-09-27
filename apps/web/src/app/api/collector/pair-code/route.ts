import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generatePairingCode, PAIRING_CODE_TTL_MINUTES } from "@/lib/collectorAuth";

/** Dashboard calls this to mint a short-lived code the user types into the collector CLI. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MINUTES * 60 * 1000);

  await prisma.pairingCode.create({
    data: { code, userId: session.user.id, expiresAt },
  });

  return NextResponse.json({ code, expiresAt, ttlMinutes: PAIRING_CODE_TTL_MINUTES });
}

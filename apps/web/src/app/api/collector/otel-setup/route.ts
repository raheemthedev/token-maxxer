import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateCollectorToken, getOrCreateProjectSalt, hashCollectorToken } from "@/lib/collectorAuth";

/**
 * Session-authenticated (unlike /api/collector/pair, which is a public pairing-code exchange for
 * the CLI). The browser is already signed in when the user clicks "Generate setup snippet", so
 * there's no separate device to pair — we can issue the token directly, matching how e.g. WakaTime
 * hands you an API key immediately rather than a short-lived pairing code.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const projectSalt = await getOrCreateProjectSalt(session.user.id);
  const token = generateCollectorToken();

  await prisma.collector.create({
    data: {
      userId: session.user.id,
      name: "Claude Code (OpenTelemetry)",
      tokenHash: hashCollectorToken(token),
      projectSalt,
      status: "active",
    },
  });

  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? "localhost:3000";
  const metricsEndpoint = `${proto}://${host}/api/otel/v1/metrics`;

  return NextResponse.json({ token, metricsEndpoint });
}

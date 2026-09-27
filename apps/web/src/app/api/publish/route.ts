import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ isPublic: z.boolean() });

/** Explicit publish/unpublish toggle — the only thing that puts a user on the public leaderboard at all. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const settings = await prisma.publishSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      isPublic: parsed.data.isPublic,
      publishedAt: parsed.data.isPublic ? new Date() : null,
    },
    update: {
      isPublic: parsed.data.isPublic,
      publishedAt: parsed.data.isPublic ? new Date() : null,
    },
  });

  return NextResponse.json({ isPublic: settings.isPublic, publishedAt: settings.publishedAt });
}

import { prisma } from "./prisma";

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "builder";
}

/** Picks a unique @handle for a newly created user from their name/email, appending -2, -3, ... on collision. */
export async function assignHandle(userId: string, seed: string): Promise<string> {
  const base = slugify(seed.includes("@") ? seed.split("@")[0] : seed).slice(0, 24);
  let candidate = base;
  let suffix = 1;

  // Bounded retry loop: handle collisions are rare, but never loop forever.
  for (let attempt = 0; attempt < 50; attempt++) {
    const existing = await prisma.user.findUnique({ where: { handle: candidate } });
    if (!existing) {
      try {
        await prisma.user.update({ where: { id: userId }, data: { handle: candidate } });
        return candidate;
      } catch (error) {
        if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") throw error;
      }
    }
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  const fallback = `${base}-${userId.slice(-10)}`;
  await prisma.user.update({ where: { id: userId }, data: { handle: fallback } });
  return fallback;
}

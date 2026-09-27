/**
 * Synthetic fixtures ONLY. Every seeded user's handle is prefixed `demo-` and the UI treats that
 * prefix as a "demo data" signal (see src/app/page.tsx, src/app/u/[handle]/page.tsx) so seeded
 * rows are never visually confused with real, published usage. Re-runnable: clears prior demo-*
 * rows first.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashProjectFingerprint } from "@token-maxxer/shared";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL ?? "") });

interface DemoProject {
  slug: string;
  displayName: string;
  linkUrl?: string;
  description: string;
}

interface DemoUser {
  handle: string;
  name: string;
  image: string;
  bio: string;
  projects: DemoProject[];
}

const DEMO_USERS: DemoUser[] = [
  {
    handle: "demo-maya",
    name: "Maya (demo)",
    image: "https://api.dicebear.com/9.x/identicon/svg?seed=maya",
    bio: "Synthetic demo account — not a real builder.",
    projects: [
      { slug: "budget-app", displayName: "Budget App", linkUrl: "https://example.com/budget-app", description: "Personal finance tracker." },
      { slug: "portfolio", displayName: "Portfolio", linkUrl: "https://example.com/maya", description: "Personal site." },
    ],
  },
  {
    handle: "demo-dan",
    name: "Dan (demo)",
    image: "https://api.dicebear.com/9.x/identicon/svg?seed=dan",
    bio: "Synthetic demo account — not a real builder.",
    projects: [
      { slug: "browser-extension", displayName: "Browser Extension", linkUrl: "https://example.com/ext", description: "A tab manager extension." },
    ],
  },
  {
    handle: "demo-priya",
    name: "Priya (demo)",
    image: "https://api.dicebear.com/9.x/identicon/svg?seed=priya",
    bio: "Synthetic demo account — not a real builder.",
    projects: [
      { slug: "recipe-bot", displayName: "Recipe Bot", description: "Undetected link yet — project detected, not linked." },
      { slug: "internal-tool", displayName: "Internal Tool", description: "Work in progress." },
    ],
  },
];

const MODELS = ["claude-sonnet-5", "claude-opus-5-5", "claude-haiku-4-5"];
const SOURCES: Array<"claude_code" | "opencode"> = ["claude_code", "opencode"];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("Seeding synthetic fixtures (prefixed demo-*)...");

  // Clean slate for idempotent re-seeding.
  await prisma.user.deleteMany({ where: { handle: { startsWith: "demo-" } } });

  for (const demoUser of DEMO_USERS) {
    const user = await prisma.user.create({
      data: {
        handle: demoUser.handle,
        name: demoUser.name,
        image: demoUser.image,
        bio: demoUser.bio,
        email: `${demoUser.handle}@example.invalid`,
        publishSettings: { create: { isPublic: true, publishedAt: new Date() } },
      },
    });

    const salt = `seed-salt-${user.id}`;
    const projects = await Promise.all(
      demoUser.projects.map((p) =>
        prisma.project.create({
          data: {
            userId: user.id,
            fingerprintHash: hashProjectFingerprint(salt, `/home/${demoUser.handle}/${p.slug}`),
            detectionMethod: "git_root",
            detectedNameLocal: p.slug,
            displayName: p.displayName,
            description: p.description,
            linkUrl: p.linkUrl ?? null,
            linkLabel: p.linkUrl ? "repository" : null,
            visibility: "public",
          },
        }),
      ),
    );

    // Spread usage over the last 10 days so daily / weekly / all-time views all have data.
    const events = [];
    for (let day = 0; day < 10; day++) {
      const eventsToday = randomInt(2, 6);
      for (let i = 0; i < eventsToday; i++) {
        const project = projects[randomInt(0, projects.length - 1)];
        const observedAt = new Date(Date.now() - day * 24 * 60 * 60 * 1000 - randomInt(0, 20) * 60 * 1000);
        const input = randomInt(500, 8000);
        const output = randomInt(200, 4000);
        const cacheRead = randomInt(0, 20000);
        const cacheWrite = randomInt(0, 3000);
        events.push({
          userId: user.id,
          projectId: project.id,
          source: SOURCES[randomInt(0, SOURCES.length - 1)],
          connectorVersion: "0.1.0",
          provider: "anthropic",
          model: MODELS[randomInt(0, MODELS.length - 1)],
          sourceEventId: `seed-${user.id}-${day}-${i}`,
          eventType: "incremental",
          observedAt,
          inputTokens: input,
          outputTokens: output,
          cacheReadTokens: cacheRead,
          cacheWriteTokens: cacheWrite,
          reasoningTokens: null,
          reasoningIncludedInOutput: true,
          attributionMethod: "git_root",
          evidenceLevel: "locally_reported",
        });
      }
    }
    // A slice of unassigned usage too, to demonstrate that state honestly.
    events.push({
      userId: user.id,
      projectId: null,
      source: "claude_code",
      connectorVersion: "0.1.0",
      provider: "anthropic",
      model: MODELS[0],
      sourceEventId: `seed-${user.id}-unassigned`,
      eventType: "incremental",
      observedAt: new Date(),
      inputTokens: randomInt(200, 1000),
      outputTokens: randomInt(100, 500),
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: null,
      reasoningIncludedInOutput: true,
      attributionMethod: "unassigned",
      evidenceLevel: "locally_reported",
    });

    await prisma.usageEvent.createMany({ data: events });
    console.log(`  ${demoUser.handle}: ${projects.length} project(s), ${events.length} usage event(s)`);
  }

  console.log("Done. These rows are synthetic fixtures, not real usage — see docs/SETUP.md.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

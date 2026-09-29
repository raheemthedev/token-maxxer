import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";

const TOKEN_SECRET =
  process.env.COLLECTOR_TOKEN_SECRET || "dev-only-insecure-collector-secret-do-not-use-in-production";

/** Long-lived collector ingestion tokens are stored only as a salted hash — never in plaintext. */
export function hashCollectorToken(token: string): string {
  return createHash("sha256").update(`${TOKEN_SECRET}:${token}`).digest("hex");
}

export function generateCollectorToken(): string {
  return `tmx_${randomBytes(32).toString("hex")}`;
}

export function generateProjectSalt(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Every collector a user pairs (CLI or OTel) shares one hashing pepper, generated once on that
 * user's first collector, so project fingerprints stay comparable across their machines/paths.
 */
export async function getOrCreateProjectSalt(userId: string): Promise<string> {
  const existing = await prisma.collector.findFirst({
    where: { userId },
    select: { projectSalt: true },
  });
  return existing?.projectSalt ?? generateProjectSalt();
}

const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function generatePairingCode(): string {
  let code = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += PAIRING_CODE_ALPHABET[bytes[i] % PAIRING_CODE_ALPHABET.length];
    if (i === 3) code += "-";
  }
  return code;
}

export const PAIRING_CODE_TTL_MINUTES = 10;

import { createHash } from "node:crypto";

/**
 * One-way fingerprint for a local project path (git root or workspace folder). The collector
 * hashes the real path before it ever leaves the machine; the backend only ever compares hashes,
 * so it can group a user's usage events into the same project without learning the real path.
 *
 * Salted per-user (with the user id) so two different users' identical folder names never collide
 * into the same hash, and so the hash alone can't be reversed by guessing common folder names.
 */
export function hashProjectFingerprint(userSalt: string, rawPath: string): string {
  return createHash("sha256").update(`${userSalt}:${rawPath}`).digest("hex");
}

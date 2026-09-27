import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { hashProjectFingerprint, type ProjectDetectionMethod } from "@token-maxxer/shared";

export interface DetectedProject {
  fingerprintHash: string;
  detectionMethod: ProjectDetectionMethod;
  /** Local display hint only (e.g. folder name) — never uploaded. */
  localHint: string;
}

/**
 * Resolves a working directory to a project per the brief's priority order: git repository root
 * first (so subfolders of the same repo group together), then the bare workspace folder.
 * Session-metadata-level attribution (e.g. an explicit project id from the source itself) is
 * handled by the caller before this is ever reached — this is the fallback chain.
 */
export function detectProject(cwd: string, projectSalt: string): DetectedProject {
  const gitRoot = tryGitRoot(cwd);
  if (gitRoot) {
    return {
      fingerprintHash: hashProjectFingerprint(projectSalt, gitRoot),
      detectionMethod: "git_root",
      localHint: basename(gitRoot),
    };
  }
  return {
    fingerprintHash: hashProjectFingerprint(projectSalt, cwd),
    detectionMethod: "workspace_folder",
    localHint: basename(cwd),
  };
}

function tryGitRoot(cwd: string): string | null {
  try {
    const out = execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

import { readFileSync, realpathSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve, basename } from "node:path";
import { hashProjectFingerprint, type ProjectDetectionMethod } from "@token-maxxer/shared";

export interface DetectedProject {
  fingerprintHash: string;
  identityFingerprint: string;
  folderConfirmed: boolean;
  detectionMethod: ProjectDetectionMethod;
  /** Folder basename only; full paths never leave the machine. */
  localHint: string;
}

/**
 * Resolves a working directory to a project per the brief's priority order: git repository root
 * first (so subfolders of the same repo group together), then the bare workspace folder.
 * Session-metadata-level attribution (e.g. an explicit project id from the source itself) is
 * handled by the caller before this is ever reached — this is the fallback chain.
 */
export function detectProject(cwd: string, projectSalt: string, folderOverride?: string | null): DetectedProject {
  const gitRoot = gitRoots.has(cwd) ? gitRoots.get(cwd)! : tryGitRoot(cwd);
  gitRoots.set(cwd, gitRoot);
  const identityFingerprint = hashProjectFingerprint(projectSalt, gitRoot || cwd);
  const folder = folderOverride === undefined ? gitRoot || cwd : folderOverride;
  const folderConfirmed = Boolean(folder && isWorkingFolder(folder, Boolean(gitRoot) || folderOverride !== undefined));
  if (folderConfirmed && folder) {
    const root = folderOverride === undefined ? gitRoot || folder : folder;
    if (gitRoot) projectRoots.set(hashProjectFingerprint(projectSalt, root), root);
    return {
      fingerprintHash: hashProjectFingerprint(projectSalt, root), identityFingerprint, folderConfirmed: true,
      detectionMethod: gitRoot ? "git_root" : "workspace_folder",
      localHint: basename(root),
    };
  }
  return {
    fingerprintHash: identityFingerprint, identityFingerprint, folderConfirmed: false,
    detectionMethod: "workspace_folder",
    localHint: basename(cwd),
  };
}

// Cleared once per scan: thousands of messages in one folder need just one git invocation.
const gitRoots = new Map<string, string | null>();
export const projectRoots = new Map<string, string>();
export function resetProjectCache() { gitRoots.clear(); projectRoots.clear(); desktopState = undefined; }

function tryGitRoot(cwd: string): string | null {
  try {
    const out = execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      timeout: 3000,
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

const canonicalPath = (directory: string) => { try { return realpathSync(directory); } catch { return resolve(directory); } };
const within = (directory: string, root: string) => {
  const child = relative(canonicalPath(root), canonicalPath(directory));
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
};
/** A home directory, filesystem root, agent storage or temporary chat output is not a project. */
export function isWorkingFolder(directory: string, allowTemporary = false): boolean {
  if (!isAbsolute(directory)) return false;
  const folder = canonicalPath(directory);
  if (folder === canonicalPath(homedir()) || folder === resolve(folder, "..")) return false;
  const excluded = [...(allowTemporary ? [] : [tmpdir()]), process.env.CODEX_HOME || join(homedir(), ".codex"), process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "opencode"), join(homedir(), ".cache"), join(homedir(), "Library", "Caches")];
  if (excluded.some(root => within(folder, root))) return false;
  try { return statSync(folder).isDirectory(); } catch { return false; }
}

let desktopState: Record<string, unknown> | null | undefined;
/** Desktop chats can have a cwd too. Saved folder membership, not a chat title/cwd, identifies projects. */
export function codexDesktopFolder(sessionId: string, cwd: string): string | null | undefined {
  if (desktopState === undefined) {
    try { desktopState = JSON.parse(readFileSync(join(process.env.CODEX_HOME || join(homedir(), ".codex"), ".codex-global-state.json"), "utf8")); }
    catch { desktopState = null; }
  }
  if (!desktopState) return null;
  const projectless = desktopState["projectless-thread-ids"];
  if (Array.isArray(projectless) && projectless.includes(sessionId)) return null;
  const projects = desktopState["local-projects"] as Record<string, { rootPaths?: string[] }> | undefined;
  const assignments = desktopState["thread-project-assignments"] as Record<string, { projectId?: string; projectKind?: string }> | undefined;
  const assignment = assignments?.[sessionId];
  const selected = assignment?.projectKind === "local" && assignment.projectId ? projects?.[assignment.projectId] : undefined;
  const roots = selected ? selected.rootPaths : Object.values(projects ?? {}).flatMap(p => p.rootPaths ?? []);
  const paths = (roots ?? []).filter((root): root is string => typeof root === "string" && isAbsolute(root));
  return paths.filter(root => within(cwd, root)).sort((a, b) => b.length - a.length)[0] ?? (selected ? paths[0] : null);
}

import type { LeaderboardProject } from "../lib/leaderboard";

function ProjectName({ project }: { project: LeaderboardProject }) {
  return project.linkUrl ? (
    <a href={project.linkUrl} target="_blank" rel="noopener noreferrer nofollow"
      title={project.displayName}
      className="block truncate underline decoration-border-soft underline-offset-2 hover:decoration-accent">
      {project.displayName} ↗
    </a>
  ) : <span title={project.displayName} className="block truncate">{project.displayName}</span>;
}

export function LeaderboardProjects({ projects }: { projects: LeaderboardProject[] }) {
  if (!projects.length) return <p className="mt-1 text-sm text-foreground-muted">No projects yet</p>;
  return <div className="mt-1 text-sm text-foreground-muted">
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {projects.slice(0, 4).map((project, i) => <span key={i} className="max-w-40 min-w-0"><ProjectName project={project} /></span>)}
    </div>
    {projects.length > 4 && <details className="mt-1">
      <summary className="cursor-pointer text-xs hover:text-accent">{projects.length - 4} more projects</summary>
      <div role="region" aria-label="More projects" tabIndex={0} className="mt-2 max-h-32 overflow-y-auto overscroll-contain rounded-xl bg-background p-3">
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {projects.slice(4).map((project, i) => <span key={i} className="min-w-0"><ProjectName project={project} /></span>)}
        </div>
      </div>
    </details>}
  </div>;
}

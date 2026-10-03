import type { LeaderboardProject } from "../lib/leaderboard";

function ProjectName({ project }: { project: LeaderboardProject }) {
  return project.linkUrl ? (
    <a href={project.linkUrl} target="_blank" rel="noopener noreferrer nofollow"
      className="underline decoration-border-soft underline-offset-2 hover:decoration-accent">
      {project.displayName} ↗
    </a>
  ) : <span>{project.displayName}</span>;
}

export function LeaderboardProjects({ projects }: { projects: LeaderboardProject[] }) {
  if (!projects.length) return <p className="mt-1 text-sm text-foreground-muted">No projects yet</p>;
  return <div className="mt-1 text-sm text-foreground-muted">
    <div className="flex flex-wrap gap-x-2 gap-y-1">
      {projects.slice(0, 4).map((project, i) => <span key={i}>{i > 0 && "· "}<ProjectName project={project} /></span>)}
    </div>
    {projects.length > 4 && <details className="mt-1">
      <summary className="cursor-pointer text-xs hover:text-accent">{projects.length - 4} more projects</summary>
      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
        {projects.slice(4).map((project, i) => <span key={i}>{i > 0 && "· "}<ProjectName project={project} /></span>)}
      </div>
    </details>}
  </div>;
}

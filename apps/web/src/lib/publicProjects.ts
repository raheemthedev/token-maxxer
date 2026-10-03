/** Private means no outbound link. Hidden means the project is omitted entirely by callers. */
export function publicProjectSummary(project: {
  displayName: string | null;
  detectedNameLocal: string;
  visibility: string;
  linkUrl: string | null;
  publicRepositoryUrl: string | null;
}) {
  return {
    displayName: project.displayName || project.detectedNameLocal,
    linkUrl: project.visibility === "public" ? project.linkUrl ?? project.publicRepositoryUrl : null,
  };
}

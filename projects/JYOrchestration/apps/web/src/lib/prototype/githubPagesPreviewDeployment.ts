export type GithubPagesPreviewDeploymentStatusV1 =
  | "not_started"
  | "preparing"
  | "deployed"
  | "pages_not_configured"
  | "static_artifact_missing"
  | "failed";

export type GithubPagesPreviewDeploymentV1 = Readonly<{
  readonly status: GithubPagesPreviewDeploymentStatusV1;
  readonly repositoryFullName: string;
  readonly sourceBranch: string;
  readonly pagesBranch: string;
  readonly pagesPath: string;
  readonly pagesUrl: string | null;
  readonly deployedCommitSha: string | null;
  readonly errorCode: string | null;
  readonly userSafeMessage: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}>;

export const DEFAULT_GITHUB_PAGES_BRANCH = "gh-pages";

export function buildGithubPagesPreviewPath(projectId: string): string {
  const pid = projectId.trim();
  return `previews/${pid}/`;
}

export function computeGithubPagesPreviewUrl(input: {
  readonly owner: string;
  readonly repo: string;
  readonly projectId: string;
}): string {
  const owner = input.owner.trim();
  const repo = input.repo.trim().replace(/\.git$/i, "");
  const pid = encodeURIComponent(input.projectId.trim());
  return `https://${owner}.github.io/${repo}/previews/${pid}/`;
}

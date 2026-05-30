import { openOrReuseGithubPullRequest } from "@/lib/service/githubPullRequestOps";

export function buildPlatformScmPullRequestTitle(input: {
  readonly selectedTaskId: string;
  readonly branchName: string;
}): string {
  const taskId = input.selectedTaskId.trim() || "wip";
  return `[JYO][PROTOTYPE] ${taskId} — platform SCM reflection`;
}

export function buildPlatformScmPullRequestBody(input: {
  readonly selectedTaskId: string;
  readonly branchName: string;
  readonly commitSha: string;
  readonly targetRepository: string;
}): string {
  return `<!-- JY_ORCH_META
taskType=PROTOTYPE_PLATFORM_SCM
taskName=Platform SCM reflection
purpose=Push and PR for Code Agent WIP commit
branchName=${input.branchName}
-->

## Platform SCM reflection

- Task: \`${input.selectedTaskId}\`
- Repository: \`${input.targetRepository}\`
- Branch: \`${input.branchName}\`
- Commit: \`${input.commitSha.slice(0, 12)}\`

This PR was opened by JYOrchestration platform SCM after AI developer approval.
Merge requires review/security gates per project policy.
`;
}

export async function createPlatformScmPullRequest(input: {
  readonly repoUrl: string;
  readonly baseBranch: string;
  readonly headBranch: string;
  readonly githubAccessToken: string;
  readonly title: string;
  readonly body: string;
  readonly projectId?: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly prNumber: number; readonly prUrl: string; readonly reusedExisting: boolean }>
  | Readonly<{ readonly ok: false; readonly message: string; readonly httpStatus?: number }>
> {
  return openOrReuseGithubPullRequest({
    ...input,
    userAgent: "JYOrchestration/platform-scm",
  });
}

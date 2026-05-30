import { openOrReuseGithubPullRequest } from "@/lib/service/githubPullRequestOps";

export function buildPlatformScmPullRequestTitle(input: {
  readonly selectedTaskId: string;
  readonly taskTitle?: string;
  readonly branchName?: string;
}): string {
  const taskId = input.selectedTaskId.trim() || "wip";
  const taskTitle = input.taskTitle?.trim();
  if (taskTitle) return `[${taskId}] ${taskTitle}`;
  return `[JYO][PROTOTYPE] ${taskId} — platform SCM reflection`;
}

export function buildPlatformScmPullRequestBody(input: {
  readonly projectId: string;
  readonly selectedTaskId: string;
  readonly branchName: string;
  readonly commitSha: string;
  readonly targetRepository: string;
  readonly changedFiles?: readonly string[];
  readonly diffSummary?: readonly string[];
  readonly testResults?: readonly string[];
  readonly qualityGateSummary?: string;
}): string {
  const changedFiles = (input.changedFiles ?? []).filter(Boolean);
  const diffSummary = (input.diffSummary ?? []).filter(Boolean);
  const testResults = (input.testResults ?? []).filter(Boolean);
  const qualityGateSummary = input.qualityGateSummary?.trim();

  return `<!-- JY_ORCH_META
taskType=PROTOTYPE_PLATFORM_SCM
taskName=Platform SCM reflection
purpose=Push and PR for Code Agent WIP commit
projectId=${input.projectId}
branchName=${input.branchName}
-->

## Platform SCM reflection

- Project: \`${input.projectId}\`
- Task: \`${input.selectedTaskId}\`
- Repository: \`${input.targetRepository}\`
- Branch: \`${input.branchName}\`
- Commit: \`${input.commitSha.slice(0, 12)}\`

### Changed files
${changedFiles.length ? changedFiles.map((file) => `- \`${file}\``).join("\n") : "- (없음)"}

### Diff summary
${diffSummary.length ? diffSummary.map((line) => `- ${line}`).join("\n") : "- (없음)"}

### Test results
${testResults.length ? testResults.map((line) => `- ${line}`).join("\n") : "- (없음)"}

### Review / security
${qualityGateSummary ?? "Merge requires reviewer/security gates per project policy."}

This PR was opened by JYOrchestration platform SCM after AI developer approval.
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

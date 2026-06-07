import { autoMergePullRequest } from "@/lib/service/githubAutoMergeService";
import { openOrReuseGithubPullRequest } from "@/lib/service/githubPullRequestOps";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { asReadonlyArray, mergeResultsSafe } from "@/lib/prototype/implementationIntegrationPlanNormalize";
import type { IntegrationCheckResultV1 } from "@/lib/prototype/implementationIntegrationCheckService";

export function buildIntegrationPullRequestBody(input: {
  readonly plan: CodeTaskIntegrationPlanV1;
  readonly projectName?: string | null;
  readonly checkResult?: IntegrationCheckResultV1 | null;
  readonly previewUrl?: string | null;
}): string {
  const name = String(input.projectName ?? input.plan.projectId).trim();
  const includedLines = asReadonlyArray(input.plan.included).map(
    (row) => `- [x] ${row.title} (\`${row.codeTaskId}\`, \`${row.workBranch}\`)`,
  );
  const excludedLines = asReadonlyArray(input.plan.excluded).map(
    (row) => `- [ ] ${row.title} — ${row.reason}`,
  );
  const check = input.checkResult ?? input.plan.checkResult;
  const checkLine =
    check?.status === "passed"
      ? "passed"
      : check?.status === "failed"
        ? "failed"
        : "not_run";
  const preview = String(input.previewUrl ?? "").trim() || "(internal preview)";

  return [
    "## 통합 대상 CodeTask",
    "",
    ...(includedLines.length ? includedLines : ["- (none)"]),
    "",
    "## 제외된 CodeTask",
    "",
    ...(excludedLines.length ? excludedLines : ["- (none)"]),
    "",
    "## 검증",
    "",
    `- GitHub branch merge: ${mergeResultsSafe(input.plan).every((r) => r.status === "merged") ? "passed" : "partial/failed"}`,
    `- Integration check: ${checkLine}`,
    `- Preview: ${preview}`,
    "",
    "## 주의",
    "",
    "이 PR은 JYOrchestration 통합단계에서 생성된 단일 integration PR입니다.",
    `Integration branch: \`${input.plan.integrationBranch}\``,
    "",
    `Project: ${name}`,
  ].join("\n");
}

export function buildIntegrationPullRequestTitle(input: {
  readonly projectName?: string | null;
  readonly projectId: string;
}): string {
  const name = String(input.projectName ?? input.projectId).trim();
  return `Implement selected CodeTasks for ${name}`;
}

export async function createIntegrationPullRequest(input: {
  readonly plan: CodeTaskIntegrationPlanV1;
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly projectId: string;
  readonly projectName?: string | null;
  readonly previewUrl?: string | null;
}): Promise<
  | Readonly<{ readonly ok: true; readonly prUrl: string; readonly prNumber: number }>
  | Readonly<{ readonly ok: false; readonly message: string }>
> {
  const body = buildIntegrationPullRequestBody({
    plan: input.plan,
    projectName: input.projectName,
    previewUrl: input.previewUrl,
  });
  const title = buildIntegrationPullRequestTitle({
    projectName: input.projectName,
    projectId: input.projectId,
  });
  const result = await openOrReuseGithubPullRequest({
    repoUrl: input.repoUrl,
    baseBranch: input.plan.baseBranch,
    headBranch: input.plan.integrationBranch,
    githubAccessToken: input.githubToken,
    title,
    body,
    projectId: input.projectId,
  });
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, prUrl: result.prUrl, prNumber: result.prNumber };
}

export async function mergeIntegrationPullRequestWithUserApproval(input: {
  readonly pullRequestUrl: string;
  readonly githubToken: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly message: string }>
  | Readonly<{ readonly ok: false; readonly message: string }>
> {
  const result = await autoMergePullRequest({
    prUrl: input.pullRequestUrl,
    githubAccessToken: input.githubToken,
    mergeMethod: "merge",
  });
  if (!result.ok) {
    return { ok: false, message: result.message ?? "PR merge failed" };
  }
  return { ok: true, message: result.message ?? "PR merged" };
}

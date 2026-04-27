/**
 * 프로토타입 PR/Merge — 일반 GitHub 헬퍼만 사용. ENV_TEST PR 제목/화이트리스트 규칙 미사용.
 */

import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import { autoMergePullRequest } from "@/lib/service/githubAutoMergeService";
import { createGithubPullRequestFromBranch } from "@/lib/service/githubPullRequestFromBranchService";
import { logPrototypePipelineEvent } from "@/lib/prototype/prototypeRunLog";

export type PrototypePrBlocked = Readonly<{ readonly blocked: true; readonly message: string }>;

export async function openPrototypePr(input: Readonly<{
  run: PrototypeRun;
  projectName: string;
  repoUrl: string;
  baseBranch: string;
  githubAccessToken: string | null;
  projectId: string;
}>): Promise<
  | { readonly ok: true; readonly prUrl: string; readonly prNumber: number }
  | { readonly ok: false } & PrototypePrBlocked
> {
  const shortId = input.run.id.replace(/-/g, "").slice(0, 8);
  const title = `[Prototype] ${input.projectName} run ${shortId}`;
  const pr = await createGithubPullRequestFromBranch({
    repoUrl: input.repoUrl,
    baseBranch: input.baseBranch,
    headBranch: input.run.branchName,
    title,
    body: `Prototype automation run\n- template: ${input.run.selectedTemplate}\n- branch: ${input.run.branchName}`,
    githubAccessToken: input.githubAccessToken,
    projectId: input.projectId,
  });
  if (!pr.ok) {
    return { ok: false, blocked: true, message: pr.message };
  }
  logPrototypePipelineEvent("prototype_pr_opened", {
    projectId: input.projectId,
    runId: input.run.id,
    prNumber: pr.data.pullRequestNumber,
  });
  return { ok: true, prUrl: pr.data.pullRequestUrl, prNumber: pr.data.pullRequestNumber };
}

export async function mergePrototypePr(input: Readonly<{
  run: PrototypeRun;
  githubAccessToken: string | null;
  projectId: string;
}>): Promise<
  | { readonly ok: true; readonly mergeSha: string | null }
  | { readonly ok: false } & PrototypePrBlocked
> {
  const url = input.run.prUrl?.trim();
  if (!url) {
    return { ok: false, blocked: true, message: "PR URL 없음" };
  }
  const mr = await autoMergePullRequest({
    prUrl: url,
    githubAccessToken: input.githubAccessToken,
    mergeMethod: "merge",
  });
  if (!mr.ok) {
    return { ok: false, blocked: true, message: mr.message };
  }
  const headSha =
    mr.ok && mr.detail && typeof (mr.detail as { headSha?: unknown }).headSha === "string"
      ? String((mr.detail as { headSha: string }).headSha).trim()
      : "";
  logPrototypePipelineEvent("prototype_merged", { projectId: input.projectId, runId: input.run.id });
  return { ok: true, mergeSha: headSha || null };
}

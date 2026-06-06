import { githubRestApiBase, resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import type { CodeTaskIntegrationMergeResultV1 } from "@/lib/prototype/implementationIntegrationPlan";

type MergeResponse = Readonly<{
  readonly sha?: string;
  readonly message?: string;
}>;

export async function mergeWorkBranchIntoIntegrationBranch(input: {
  readonly repoUrl: string;
  readonly integrationBranch: string;
  readonly workBranch: string;
  readonly codeTaskId: string;
  readonly commitSha: string;
  readonly githubToken: string;
  readonly commitMessage?: string;
}): Promise<CodeTaskIntegrationMergeResultV1> {
  const base = {
    codeTaskId: input.codeTaskId,
    workBranch: input.workBranch,
    commitSha: input.commitSha,
  };
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) {
    return { ...base, status: "failed", message: "GitHub 저장소 URL이 올바르지 않습니다." };
  }
  const token = input.githubToken.trim();
  if (!token) {
    return { ...base, status: "failed", message: "GitHub token이 필요합니다." };
  }

  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/merges`;
  const message =
    input.commitMessage?.trim() ||
    `integrate(${input.codeTaskId}): merge ${input.workBranch} into ${input.integrationBranch}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "JYOrchestration/github-integration-merge",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base: input.integrationBranch,
        head: input.workBranch,
        commit_message: message,
      }),
    });
    const text = await res.text();
    if (res.status === 409) {
      return {
        ...base,
        status: "conflict",
        message: text.slice(0, 500) || "merge conflict",
      };
    }
    if (!res.ok) {
      return {
        ...base,
        status: "failed",
        message: `merge failed HTTP ${res.status}: ${text.slice(0, 300)}`,
      };
    }
    let mergeCommitSha: string | null = null;
    try {
      const json = JSON.parse(text) as MergeResponse;
      mergeCommitSha = String(json.sha ?? "").trim() || null;
    } catch {
      mergeCommitSha = null;
    }
    return {
      ...base,
      status: "merged",
      mergeCommitSha,
      message: "merged",
    };
  } catch (error) {
    return {
      ...base,
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

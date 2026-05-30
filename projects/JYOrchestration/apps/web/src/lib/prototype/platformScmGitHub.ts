import {
  githubRestApiBase,
  resolveGithubOwnerRepoStrict,
} from "@/lib/integration/githubRestCommon";
import { normalizeGithubPrHeadForSameRepoCreate } from "@/lib/service/githubEnvTestPullRequestService";
import { findOpenPullRequestByHeadBranch } from "@/lib/service/githubOpenPullRequestByHeadService";

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
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) {
    return { ok: false, message: "GitHub 저장소 URL을 해석할 수 없습니다.", httpStatus: 400 };
  }
  const token = input.githubAccessToken.trim();
  if (!token) {
    return { ok: false, message: "GitHub Access Token이 필요합니다.", httpStatus: 503 };
  }

  const { headSentToGithub } = normalizeGithubPrHeadForSameRepoCreate(parsed.owner, input.headBranch);
  const baseBranch = input.baseBranch.trim();
  if (!headSentToGithub || !baseBranch) {
    return { ok: false, message: "base/head 브랜치가 필요합니다.", httpStatus: 400 };
  }

  const existing = await findOpenPullRequestByHeadBranch({
    repoUrl: input.repoUrl,
    headBranch: headSentToGithub,
    githubAccessToken: token,
    projectId: input.projectId,
  });
  if (existing) {
    return {
      ok: true,
      prNumber: existing.prNumber,
      prUrl: existing.prUrl,
      reusedExisting: true,
    };
  }

  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/pulls`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "JYOrchestration/platform-scm",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: input.title,
      head: headSentToGithub,
      base: baseBranch,
      body: input.body,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      message: `GitHub PR 생성 실패 (HTTP ${res.status})`,
      httpStatus: res.status,
    };
  }
  try {
    const json = JSON.parse(text) as { number?: number; html_url?: string };
    const prNumber = typeof json.number === "number" ? json.number : undefined;
    const prUrl = typeof json.html_url === "string" ? json.html_url : undefined;
    if (!prNumber || !prUrl) {
      return { ok: false, message: "GitHub PR 응답 형식이 올바르지 않습니다.", httpStatus: 502 };
    }
    return { ok: true, prNumber, prUrl, reusedExisting: false };
  } catch {
    return { ok: false, message: "GitHub PR 응답 JSON 파싱 실패", httpStatus: 502 };
  }
}

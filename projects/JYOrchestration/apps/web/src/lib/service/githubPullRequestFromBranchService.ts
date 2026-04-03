import {
  githubRestApiBase,
  resolveGithubOwnerRepoStrict,
  resolveGithubRestTokenAndLog,
} from "@/lib/integration/githubRestCommon";

type PullCreateRes = { html_url?: string; number?: number; state?: string };

export async function createGithubPullRequestFromBranch(params: {
  repoUrl: string;
  baseBranch: string;
  headBranch: string;
  title: string;
  body?: string;
  githubAccessToken?: string | null;
}): Promise<
  | { ok: true; data: { pullRequestUrl: string; pullRequestNumber: number; pullRequestState: string } }
  | { ok: false; code: string; message: string; httpStatus?: number; detail?: Record<string, unknown> }
> {
  const { token } = resolveGithubRestTokenAndLog("github_pull_request_from_branch", params.githubAccessToken ?? null);
  if (!token)
    return {
      ok: false,
      code: "NO_GITHUB_TOKEN",
      message: "실행 환경에 저장된 GitHub 토큰이 필요합니다.",
      httpStatus: 503,
    };
  const parsed = resolveGithubOwnerRepoStrict(params.repoUrl);
  if (!parsed) return { ok: false, code: "REPO_NOT_GITHUB", message: "GitHub 저장소 URL이 아닙니다.", httpStatus: 400 };
  const api = githubRestApiBase();
  const { owner, repo } = parsed;
  const url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "JYOrchestration/pr-create",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: params.title,
        head: params.headBranch,
        base: params.baseBranch,
        body: params.body ?? "",
        maintainer_can_modify: true,
      }),
    });
    const txt = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        code: "PR_CREATE_FAILED",
        message: `PR 생성 실패 (HTTP ${res.status})`,
        httpStatus: res.status,
        detail: { body: txt.slice(0, 2000) },
      };
    }
    const json = JSON.parse(txt) as PullCreateRes;
    const prUrl = String(json.html_url ?? "").trim();
    const prNum = Number(json.number);
    if (!prUrl || !Number.isFinite(prNum) || prNum <= 0) {
      return {
        ok: false,
        code: "PR_CREATE_INVALID_RESPONSE",
        message: "PR 생성 응답이 올바르지 않습니다.",
        httpStatus: 502,
        detail: { body: txt.slice(0, 2000) },
      };
    }
    return {
      ok: true,
      data: {
        pullRequestUrl: prUrl,
        pullRequestNumber: prNum,
        pullRequestState: String(json.state ?? "OPEN"),
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "PR_CREATE_EXCEPTION", message: msg, httpStatus: 502 };
  }
}

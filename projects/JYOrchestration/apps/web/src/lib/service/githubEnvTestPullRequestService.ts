import {
  getGithubRestToken,
  githubRestApiBase,
  GITHUB_REST_MISSING_TOKEN_USER_MESSAGE,
  resolveGithubOwnerRepoStrict,
} from "@/lib/integration/githubRestCommon";
import { findOpenPullRequestByHeadBranch } from "@/lib/service/githubOpenPullRequestByHeadService";

/** ENV_TEST 플랫폼 PR 제목(머지 가드와 동일 문자열). */
export const ENV_TEST_PR_TITLE = "[JYO][ENV_TEST] Hello World environment validation";

function buildEnvTestPullRequestBody(branchName: string): string {
  return `<!-- JY_ORCH_META
taskType=ENV_TEST
taskName=환경 연결 테스트 - Hello World
purpose=AI-Cursor-Git-PR environment validation
branchName=${branchName}
-->

환경 연결 테스트(Hello World)용 PR입니다. JYOrchestration 플랫폼에서 생성·갱신됩니다.`;
}

type PullRes = { html_url?: string; number?: number };

async function patchPullRequest(input: {
  api: string;
  token: string;
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; message: string; httpStatus: number }> {
  const url = `${input.api}/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls/${input.pullNumber}`;
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${input.token}`,
        "User-Agent": "JYOrchestration/env-test-pr",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ title: input.title, body: input.body }),
    });
    const txt = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        message: `PR PATCH 실패 (HTTP ${res.status}): ${txt.slice(0, 500)}`,
        httpStatus: res.status,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg, httpStatus: 502 };
  }
}

/**
 * ENV_TEST 전용: head 브랜치 기준 열린 PR이 있으면 제목·본문 갱신, 없으면 생성.
 */
export async function createOrUpdateEnvTestPullRequest(params: {
  repoUrl: string;
  baseBranch: string;
  headBranch: string;
  githubAccessToken?: string | null;
}): Promise<
  | {
      ok: true;
      data: { pullRequestUrl: string; pullRequestNumber: number; reusedExisting: boolean };
    }
  | { ok: false; code: string; message: string; httpStatus?: number }
> {
  const token = getGithubRestToken(params.githubAccessToken ?? null);
  if (!token) {
    return { ok: false, code: "NO_GITHUB_TOKEN", message: GITHUB_REST_MISSING_TOKEN_USER_MESSAGE, httpStatus: 503 };
  }
  const parsed = resolveGithubOwnerRepoStrict(params.repoUrl);
  if (!parsed) {
    return { ok: false, code: "REPO_NOT_GITHUB", message: "GitHub 저장소 URL이 아닙니다.", httpStatus: 400 };
  }
  const api = githubRestApiBase();
  const { owner, repo } = parsed;
  const headBranch = String(params.headBranch ?? "").trim();
  const baseBranch = String(params.baseBranch ?? "").trim();
  if (!headBranch || !baseBranch) {
    return { ok: false, code: "INVALID_BRANCH", message: "base/head 브랜치가 필요합니다.", httpStatus: 400 };
  }

  const title = ENV_TEST_PR_TITLE;
  const body = buildEnvTestPullRequestBody(headBranch);

  const existing = await findOpenPullRequestByHeadBranch({
    repoUrl: params.repoUrl,
    headBranch,
    githubAccessToken: token,
  }).catch(() => null);

  if (existing) {
    const patched = await patchPullRequest({
      api,
      token,
      owner,
      repo,
      pullNumber: existing.prNumber,
      title,
      body,
    });
    if (!patched.ok) {
      return {
        ok: false,
        code: "ENV_TEST_PR_PATCH_FAILED",
        message: patched.message,
        httpStatus: patched.httpStatus,
      };
    }
    return {
      ok: true,
      data: {
        pullRequestUrl: existing.prUrl,
        pullRequestNumber: existing.prNumber,
        reusedExisting: true,
      },
    };
  }

  const url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "JYOrchestration/env-test-pr",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title,
        head: headBranch,
        base: baseBranch,
        body,
        maintainer_can_modify: true,
      }),
    });
    const txt = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        code: "ENV_TEST_PR_CREATE_FAILED",
        message: `PR 생성 실패 (HTTP ${res.status}): ${txt.slice(0, 800)}`,
        httpStatus: res.status,
      };
    }
    const json = JSON.parse(txt) as PullRes;
    const prUrl = String(json.html_url ?? "").trim();
    const prNum = Number(json.number);
    if (!prUrl || !Number.isFinite(prNum) || prNum <= 0) {
      return {
        ok: false,
        code: "ENV_TEST_PR_INVALID_RESPONSE",
        message: "PR 생성 응답이 올바르지 않습니다.",
        httpStatus: 502,
      };
    }
    return {
      ok: true,
      data: {
        pullRequestUrl: prUrl,
        pullRequestNumber: prNum,
        reusedExisting: false,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "ENV_TEST_PR_EXCEPTION", message: msg, httpStatus: 502 };
  }
}

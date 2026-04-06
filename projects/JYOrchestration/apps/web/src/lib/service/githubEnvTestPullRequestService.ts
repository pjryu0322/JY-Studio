import { GITHUB_TOKEN_MISSING_IN_PROJECT_SETTINGS } from "@/lib/integration/githubProjectDbToken";
import {
  githubRestApiBase,
  GITHUB_REST_MISSING_TOKEN_USER_MESSAGE,
  resolveGithubOwnerRepoStrict,
  resolveGithubRestTokenAndLog,
} from "@/lib/integration/githubRestCommon";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { findOpenPullRequestByHeadBranch } from "@/lib/service/githubOpenPullRequestByHeadService";

/** ENV_TEST Stage 1 플랫폼 PR 제목(머지 가드와 동일 문자열). */
export const ENV_TEST_PR_TITLE = "[JYO][ENV_TEST] Hello World environment validation";

/** ENV_TEST Stage 2 — 역할 분리 readiness PR 제목(머지 가드가 이 문자열과 일치해야 함) */
export const ENV_TEST_STAGE2_PR_TITLE = "[JYO][ENV_TEST_STAGE2] Role-separated readiness validation";

export type EnvTestPullRequestStage = "stage1" | "stage2";

function buildEnvTestPullRequestBody(branchName: string, stage: EnvTestPullRequestStage): string {
  const taskType = stage === "stage2" ? "ENV_TEST_STAGE2" : "ENV_TEST";
  const taskName =
    stage === "stage2"
      ? "환경 연결 테스트 Stage 2 - 역할 분리 readiness"
      : "환경 연결 테스트 - Hello World";
  const purpose =
    stage === "stage2"
      ? "Platform hub: executor / reviewer / SCM separation readiness"
      : "AI-Cursor-Git-PR environment validation";
  return `<!-- JY_ORCH_META
taskType=${taskType}
taskName=${taskName}
purpose=${purpose}
branchName=${branchName}
-->

${stage === "stage2" ? "ENV_TEST Stage 2(readiness) PR — 플랫폼이 생성·갱신합니다." : "환경 연결 테스트(Hello World)용 PR입니다. JYOrchestration 플랫폼에서 생성·갱신됩니다."}`;
}

type PullRes = { html_url?: string; number?: number };

/**
 * GitHub `POST /repos/{owner}/{repo}/pulls`: 동일 저장소에서는 `head`=브랜치 ref 이름만.
 * `refs/heads/x`·저장소 owner와 동일한 `owner:branch` 중복 접두어는 정규화에서 제거한다.
 * Stage1 동일 저장소 스모크는 브랜치명만 POST. Stage2에서만 422 `head` invalid 시 `owner:branch` 폴백을 시도한다.
 */
export function normalizeGithubPrHeadForSameRepoCreate(
  repoOwner: string,
  headBranchRaw: string
): { headBranchRaw: string; headBranchNormalized: string; headSentToGithub: string } {
  const raw = String(headBranchRaw ?? "").trim();
  let s = raw.replace(/^refs\/heads\//i, "").trim();
  const colonIdx = s.indexOf(":");
  if (colonIdx > 0) {
    const ns = s.slice(0, colonIdx).trim();
    const rest = s.slice(colonIdx + 1).trim();
    if (ns.toLowerCase() === String(repoOwner).toLowerCase() && rest.length > 0) {
      s = rest;
    }
  }
  s = s.replace(/^\/+|\/+$/g, "").trim();
  return {
    headBranchRaw: raw,
    headBranchNormalized: s,
    headSentToGithub: s,
  };
}

/** Stage1 스모크: 저장소 owner 기준으로 `refs/heads/`·`owner:branch` 제거 후 plain head 한 번만 사용. */
export function normalizeStage1EnvTestHeadBranch(repoUrl: string, rawHead: string): string | null {
  const parsed = resolveGithubOwnerRepoStrict(repoUrl);
  if (!parsed) return null;
  const { headSentToGithub } = normalizeGithubPrHeadForSameRepoCreate(parsed.owner, rawHead);
  const s = String(headSentToGithub ?? "").trim();
  return s.length > 0 ? s : null;
}

function parseGithubPullRequestCreateError(bodyText: string): {
  headFieldInvalid: boolean;
  headBranchNotFoundish: boolean;
} {
  let headFieldInvalid = false;
  let headBranchNotFoundish = false;
  const lower = bodyText.toLowerCase();
  try {
    const j = JSON.parse(bodyText) as {
      errors?: Array<{ field?: string; code?: string; message?: string }>;
      message?: string;
    };
    const errors = j.errors;
    if (Array.isArray(errors)) {
      for (const e of errors) {
        const field = String(e?.field ?? "").toLowerCase();
        const code = String(e?.code ?? "").toLowerCase();
        const em = String(e?.message ?? "").toLowerCase();
        if (field === "head") {
          if (code === "invalid" || code === "missing_field" || code === "empty") {
            headFieldInvalid = true;
          }
          if (code === "not_found" || /unknown|does not exist|could not be resolved/i.test(em)) {
            headBranchNotFoundish = true;
          }
        }
      }
    }
  } catch {
    // ignore JSON parse
  }
  if (!headFieldInvalid && /"field"\s*:\s*"head"/i.test(bodyText) && /"code"\s*:\s*"invalid"/i.test(bodyText)) {
    headFieldInvalid = true;
  }
  if (!headFieldInvalid && /pullrequest.*head.*invalid|field head.*invalid/i.test(lower)) {
    headFieldInvalid = true;
  }
  if (!headBranchNotFoundish && /head branch.*not found|unknown ref|does not exist/i.test(lower)) {
    headBranchNotFoundish = true;
  }
  return { headFieldInvalid, headBranchNotFoundish };
}

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

export type EnvTestPrCreateFailed = {
  ok: false;
  code: "ENV_TEST_PR_CREATE_FAILED";
  message: string;
  httpStatus: number;
  githubErrorBody?: string;
  headSentToGithub?: string;
  headBranchRaw?: string;
  headBranchNormalized?: string;
  githubHeadFieldInvalid?: boolean;
  githubHeadBranchNotFoundish?: boolean;
  /** 예약 필드(내장 전파 루프 제거 후 0) */
  headPropagationRetriesUsed?: number;
  /** 브랜치명만 실패 후 `owner:branch` POST를 시도했는지 */
  triedOwnerPrefixedHeadFallback?: boolean;
};

/**
 * ENV_TEST 전용: head 브랜치 기준 열린 PR이 있으면 제목·본문 갱신, 없으면 생성.
 */
export async function createOrUpdateEnvTestPullRequest(params: {
  repoUrl: string;
  baseBranch: string;
  headBranch: string;
  githubAccessToken?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  execRunId?: string | null;
  /** 기본 stage1. Stage2는 별도 PR 제목·본문 메타 */
  envTestStage?: EnvTestPullRequestStage;
  /** Stage1 스모크: `env_test_pr_create_request_built` 등 GitHub PR 서비스 단 로그 생략(runEnvTestPlatformPrPhase가 attempt 로그 담당) */
  suppressProgressLogs?: boolean;
}): Promise<
  | {
      ok: true;
      data: { pullRequestUrl: string; pullRequestNumber: number; reusedExisting: boolean };
    }
  | { ok: false; code: string; message: string; httpStatus?: number }
  | EnvTestPrCreateFailed
> {
  const { token } = resolveGithubRestTokenAndLog("github_env_test_pull_request", params.githubAccessToken ?? null, {
    projectId: params.projectId,
  });
  if (!token) {
    return {
      ok: false,
      code: GITHUB_TOKEN_MISSING_IN_PROJECT_SETTINGS,
      message: GITHUB_REST_MISSING_TOKEN_USER_MESSAGE,
      httpStatus: 503,
    };
  }
  const parsed = resolveGithubOwnerRepoStrict(params.repoUrl);
  if (!parsed) {
    return { ok: false, code: "REPO_NOT_GITHUB", message: "GitHub 저장소 URL이 아닙니다.", httpStatus: 400 };
  }
  const api = githubRestApiBase();
  const { owner, repo } = parsed;
  const baseBranch = String(params.baseBranch ?? "").trim();
  const { headBranchRaw, headBranchNormalized, headSentToGithub } = normalizeGithubPrHeadForSameRepoCreate(
    owner,
    params.headBranch
  );
  if (!headSentToGithub || !baseBranch) {
    return { ok: false, code: "INVALID_BRANCH", message: "base/head 브랜치가 필요합니다.", httpStatus: 400 };
  }

  const stage: EnvTestPullRequestStage = params.envTestStage === "stage2" ? "stage2" : "stage1";
  const title = stage === "stage2" ? ENV_TEST_STAGE2_PR_TITLE : ENV_TEST_PR_TITLE;
  const body = buildEnvTestPullRequestBody(headSentToGithub, stage);
  const executionId = params.execRunId ?? null;
  const quiet = params.suppressProgressLogs === true;

  if (!quiet) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_pr_create_request_built",
      projectId: params.projectId ?? "",
      taskId: params.taskId ?? undefined,
      detail: {
        repoOwner: owner,
        repoName: repo,
        baseBranch,
        headBranchRaw,
        headBranchNormalized,
        headSentToGithub,
        finalHeadSentToGithub: headSentToGithub,
        executionId,
        httpStatus: null,
        envTestStage: stage,
        step: "lookup_open_pr",
      },
    });
  }

  const existing = await findOpenPullRequestByHeadBranch({
    repoUrl: params.repoUrl,
    headBranch: headSentToGithub,
    githubAccessToken: token,
    projectId: params.projectId,
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

  const buildPullJson = (headVal: string) =>
    JSON.stringify({
      title,
      head: headVal,
      base: baseBranch,
      body,
      maintainer_can_modify: true,
    });

  if (!quiet) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_pr_create_request_built",
      projectId: params.projectId ?? "",
      taskId: params.taskId ?? undefined,
      detail: {
        repoOwner: owner,
        repoName: repo,
        baseBranch,
        headBranchRaw,
        headBranchNormalized,
        headSentToGithub,
        finalHeadSentToGithub: headSentToGithub,
        executionId,
        httpStatus: null,
        envTestStage: stage,
        step: "post_create_pull",
        postBodyHead: headSentToGithub,
        postBodyBase: baseBranch,
      },
    });
  }

  try {
    const postHeaders = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "JYOrchestration/env-test-pr",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const doPost = async (headForPost: string) => {
      const res = await fetch(url, {
        method: "POST",
        headers: postHeaders,
        body: buildPullJson(headForPost),
      });
      const txt = await res.text();
      return { res, txt };
    };

    const headPropagationRetriesUsed = 0;
    let triedOwnerPrefixedHeadFallback = false;
    let post = await doPost(headSentToGithub);
    let res = post.res;
    let txt = post.txt;
    let parsedErr = parseGithubPullRequestCreateError(txt);

    if (
      stage === "stage2" &&
      !res.ok &&
      res.status === 422 &&
      parsedErr.headFieldInvalid &&
      !headSentToGithub.includes(":") &&
      headSentToGithub.length > 0
    ) {
      const altHead = `${owner}:${headSentToGithub}`;
      triedOwnerPrefixedHeadFallback = true;
      if (!quiet) {
        appendTaskProgressLog({
          kind: "execution",
          phase: "env_test_pr_create_request_built",
          projectId: params.projectId ?? "",
          taskId: params.taskId ?? undefined,
          detail: {
            repoOwner: owner,
            repoName: repo,
            baseBranch,
            headBranchRaw,
            headBranchNormalized,
            headSentToGithub: altHead,
            finalHeadSentToGithub: altHead,
            executionId,
            httpStatus: res.status,
            envTestStage: stage,
            step: "post_create_pull_owner_prefixed_fallback",
            postBodyHead: altHead,
            postBodyBase: baseBranch,
            reason: "github_422_head_invalid_try_owner_colon_branch",
          },
        });
      }
      post = await doPost(altHead);
      res = post.res;
      txt = post.txt;
      parsedErr = parseGithubPullRequestCreateError(txt);
    }

    if (!res.ok) {
      const headVal =
        triedOwnerPrefixedHeadFallback && headSentToGithub.length > 0
          ? `${owner}:${headSentToGithub}`
          : headSentToGithub;
      if (!quiet) {
        appendTaskProgressLog({
          kind: "execution",
          phase: "env_test_pr_create_github_error",
          projectId: params.projectId ?? "",
          taskId: params.taskId ?? undefined,
          detail: {
            repoOwner: owner,
            repoName: repo,
            baseBranch,
            headBranchRaw,
            headBranchNormalized,
            headSentToGithub: headVal,
            finalHeadSentToGithub: headVal,
            executionId,
            httpStatus: res.status,
            githubErrorBody: txt.slice(0, 8000),
            githubHeadFieldInvalid: parsedErr.headFieldInvalid,
            githubHeadBranchNotFoundish: parsedErr.headBranchNotFoundish,
            headPropagationRetriesUsed,
            triedOwnerPrefixedHeadFallback,
          },
        });
      }
      return {
        ok: false,
        code: "ENV_TEST_PR_CREATE_FAILED",
        message: `PR 생성 실패 (HTTP ${res.status}): ${txt.slice(0, 800)}`,
        httpStatus: res.status,
        githubErrorBody: txt.slice(0, 8000),
        headSentToGithub: headVal,
        headBranchRaw,
        headBranchNormalized,
        githubHeadFieldInvalid: parsedErr.headFieldInvalid,
        githubHeadBranchNotFoundish: parsedErr.headBranchNotFoundish,
        headPropagationRetriesUsed,
        triedOwnerPrefixedHeadFallback,
      };
    }

    const headValOk = triedOwnerPrefixedHeadFallback ? `${owner}:${headSentToGithub}` : headSentToGithub;
    if (!quiet) {
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_pr_create_post_success",
        projectId: params.projectId ?? "",
        taskId: params.taskId ?? undefined,
        detail: {
          repoOwner: owner,
          repoName: repo,
          baseBranch,
          finalHeadSentToGithub: headValOk,
          headPropagationRetriesUsed,
          triedOwnerPrefixedHeadFallback,
          executionId,
          envTestStage: stage,
        },
      });
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

export type EnvTestPullRequestErrorResult = Exclude<
  Awaited<ReturnType<typeof createOrUpdateEnvTestPullRequest>>,
  { ok: true }
>;

/**
 * Stage1 PR 외부 재시도: `ENV_TEST_PR_CREATE_FAILED` 만.
 * 422 `head` invalid는 **첫 실패(attemptCount===1)에서만** 1회 추가 시도, 이후 동일 422 반복 금지.
 */
export function isEnvTestPullRequestCreateRetryableForStage1HeadDelay(
  res: EnvTestPullRequestErrorResult,
  ctx: { attemptCount: number }
): boolean {
  if (res.ok !== false || res.code !== "ENV_TEST_PR_CREATE_FAILED") return false;
  const r = res as EnvTestPrCreateFailed;
  const http = r.httpStatus;
  if (http === 404) return true;
  if (http === 502 || http === 503 || http === 504) return true;
  if (http === 422 && r.githubHeadFieldInvalid === true && ctx.attemptCount === 1) return true;
  return false;
}

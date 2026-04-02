/**
 * ENV_TEST 전용: 플랫폼이 GitHub REST로 PR 머지 스모크 테스트(squash) + 검증.
 * 일반 Task 자동 머지에는 사용하지 않는다.
 */

import { isExecutionSafeMode } from "@/lib/production/safeMode";
import {
  getGithubRestToken,
  githubRestApiBase,
  resolveGithubOwnerRepoStrict,
} from "@/lib/integration/githubRestCommon";
import { isEnvTestHelloWorldBranchName } from "@/lib/execution/branchPolicy";
import { ENV_TEST_PR_TITLE } from "@/lib/service/githubEnvTestPullRequestService";
import { parseGithubPrUrl } from "@/lib/service/githubAutoMergeService";

/** 머지 가드: PR에 허용되는 유일한 변경 경로(정규화 후 비교). */
export const ENV_TEST_MERGE_ALLOWED_FILE_PATH = "orchestration-test/hello-world.md";

export function resolveEnvTestMergeGithubToken(setupGithubAccessToken: string | null | undefined): string | null {
  const fromSetup = getGithubRestToken(setupGithubAccessToken ?? null);
  if (fromSetup) return fromSetup;
  const envTok = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || "";
  return envTok || null;
}

function normalizePrFilePath(filename: string): string {
  return String(filename ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

type PullDetailJson = {
  state?: string;
  merged?: boolean;
  title?: string;
  base?: { ref?: string };
  head?: { ref?: string; sha?: string };
  number?: number;
  html_url?: string;
  merge_commit_sha?: string | null;
  mergeable?: boolean | null;
  mergeable_state?: string | null;
};

type PullFileJson = { filename?: string; status?: string };

async function githubFetchJson<T>(
  url: string,
  token: string,
  userAgent: string
): Promise<{ ok: true; data: T; status: number } | { ok: false; status: number; body: string }> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": userAgent,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const txt = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: txt };
  }
  try {
    return { ok: true, data: JSON.parse(txt) as T, status: res.status };
  } catch {
    return { ok: false, status: res.status, body: txt.slice(0, 500) };
  }
}

export async function fetchEnvTestPullDetail(input: {
  repoUrl: string;
  pullNumber: number;
  token: string;
}): Promise<
  | { ok: true; pr: PullDetailJson }
  | { ok: false; code: string; message: string; httpStatus?: number }
> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) {
    return { ok: false, code: "REPO_NOT_GITHUB", message: "GitHub 저장소 URL이 아닙니다.", httpStatus: 400 };
  }
  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/pulls/${input.pullNumber}`;
  const r = await githubFetchJson<PullDetailJson>(url, input.token, "JYOrchestration/env-test-merge");
  if (!r.ok) {
    return {
      ok: false,
      code: "GITHUB_PR_FETCH_FAILED",
      message: `PR 조회 실패 HTTP ${r.status}`,
      httpStatus: r.status,
    };
  }
  return { ok: true, pr: r.data };
}

export async function fetchEnvTestPullFiles(input: {
  repoUrl: string;
  pullNumber: number;
  token: string;
}): Promise<
  | { ok: true; files: PullFileJson[] }
  | { ok: false; code: string; message: string; httpStatus?: number }
> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) {
    return { ok: false, code: "REPO_NOT_GITHUB", message: "GitHub 저장소 URL이 아닙니다.", httpStatus: 400 };
  }
  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/pulls/${input.pullNumber}/files?per_page=100`;
  const r = await githubFetchJson<PullFileJson[]>(url, input.token, "JYOrchestration/env-test-merge-files");
  if (!r.ok) {
    return {
      ok: false,
      code: "GITHUB_PR_FILES_FAILED",
      message: `PR 파일 목록 실패 HTTP ${r.status}`,
      httpStatus: r.status,
    };
  }
  const arr = Array.isArray(r.data) ? r.data : [];
  return { ok: true, files: arr };
}

export type EnvTestMergeGuardResult =
  | { ok: true; pr: PullDetailJson; files: PullFileJson[] }
  | { ok: false; blockedReason: string; blockedCode: string };

/**
 * ENV_TEST 머지 전 안전 가드(전부 통과해야 머지 가능).
 */
export function evaluateEnvTestMergeGuards(input: {
  taskKind: string | null | undefined;
  localBranchName: string | null | undefined;
  pr: PullDetailJson;
  files: PullFileJson[];
  /** 실행 설정(ExecutionSetup)의 baseBranch — ENV_TEST 머지 가드의 단일 근거 */
  requiredBaseRef: string;
}): EnvTestMergeGuardResult {
  if (String(input.taskKind ?? "").trim() !== "ENV_TEST") {
    return { ok: false, blockedCode: "NOT_ENV_TEST", blockedReason: "taskKind가 ENV_TEST가 아닙니다." };
  }
  const headRef = String(input.pr.head?.ref ?? "").trim();
  if (!isEnvTestHelloWorldBranchName(headRef)) {
    return {
      ok: false,
      blockedCode: "HEAD_BRANCH_PATTERN",
      blockedReason: "헤드 브랜치가 envcheck/t-hello-world-* 패턴이 아닙니다.",
    };
  }
  const local = String(input.localBranchName ?? "").trim();
  if (local && local !== headRef) {
    return {
      ok: false,
      blockedCode: "HEAD_BRANCH_MISMATCH",
      blockedReason: "PR 헤드 브랜치와 로컬 기록 브랜치가 일치하지 않습니다.",
    };
  }
  const title = String(input.pr.title ?? "").trim();
  if (title !== ENV_TEST_PR_TITLE) {
    return {
      ok: false,
      blockedCode: "PR_TITLE",
      blockedReason: "PR 제목이 ENV_TEST 표준 제목과 일치하지 않습니다.",
    };
  }
  const requiredBase = String(input.requiredBaseRef ?? "").trim();
  if (!requiredBase) {
    return {
      ok: false,
      blockedCode: "BASE_BRANCH_UNCONFIGURED",
      blockedReason: "기본 브랜치 설정이 없어 ENV_TEST 머지 가드를 적용할 수 없습니다.",
    };
  }
  const baseRef = String(input.pr.base?.ref ?? "").trim();
  if (baseRef !== requiredBase) {
    return {
      ok: false,
      blockedCode: "BASE_BRANCH",
      blockedReason: `PR 베이스 브랜치가 실행 설정의 기본 브랜치(${requiredBase})와 일치하지 않습니다.`,
    };
  }
  if (!input.files.length) {
    return {
      ok: false,
      blockedCode: "NO_FILES",
      blockedReason: "PR에 변경 파일이 없어 머지할 수 없습니다.",
    };
  }
  const allowed = ENV_TEST_MERGE_ALLOWED_FILE_PATH;
  for (const f of input.files) {
    const fn = normalizePrFilePath(String(f.filename ?? ""));
    if (fn !== allowed) {
      return {
        ok: false,
        blockedCode: "FILE_OUT_OF_SCOPE",
        blockedReason: `변경 파일이 ENV_TEST 허용 범위를 벗어났습니다: ${fn}`,
      };
    }
  }
  return { ok: true, pr: input.pr, files: input.files };
}

export async function putEnvTestSquashMerge(input: {
  repoUrl: string;
  pullNumber: number;
  token: string;
}): Promise<
  | { ok: true; httpStatus: number }
  | { ok: false; code: string; message: string; httpStatus?: number; body?: string }
> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) {
    return { ok: false, code: "REPO_NOT_GITHUB", message: "GitHub 저장소 URL이 아닙니다.", httpStatus: 400 };
  }
  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/pulls/${input.pullNumber}/merge`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.token}`,
      "User-Agent": "JYOrchestration/env-test-merge",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ merge_method: "squash" }),
  });
  const txt = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      code: "GITHUB_MERGE_REJECTED",
      message: `머지 API 거절 HTTP ${res.status}`,
      httpStatus: res.status,
      body: txt.slice(0, 2000),
    };
  }
  return { ok: true, httpStatus: res.status };
}

export async function verifyEnvTestPullMerged(input: {
  repoUrl: string;
  pullNumber: number;
  token: string;
}): Promise<
  | { ok: true; mergeCommitSha: string | null; merged: boolean }
  | { ok: false; code: string; message: string; httpStatus?: number }
> {
  const d = await fetchEnvTestPullDetail({
    repoUrl: input.repoUrl,
    pullNumber: input.pullNumber,
    token: input.token,
  });
  if (!d.ok) return d;
  const pr = d.pr;
  const merged = pr.merged === true || String(pr.state ?? "").toUpperCase() === "MERGED";
  const sha = String(pr.merge_commit_sha ?? "").trim() || null;
  if (!merged) {
    return {
      ok: false,
      code: "MERGE_NOT_VERIFIED",
      message: "GitHub에서 PR merged 상태가 확인되지 않았습니다.",
      httpStatus: 409,
    };
  }
  return { ok: true, mergeCommitSha: sha, merged: true };
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 머지 직후 GitHub 반영 지연을 흡수한다. */
export async function verifyEnvTestPullMergedWithRetry(input: {
  repoUrl: string;
  pullNumber: number;
  token: string;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<
  | { ok: true; mergeCommitSha: string | null; merged: boolean }
  | { ok: false; code: string; message: string; httpStatus?: number }
> {
  const maxAttempts = Math.max(1, Math.min(20, input.maxAttempts ?? 8));
  const delayMs = Math.max(100, Math.min(5000, input.delayMs ?? 450));
  let last: Awaited<ReturnType<typeof verifyEnvTestPullMerged>> | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    const r = await verifyEnvTestPullMerged({
      repoUrl: input.repoUrl,
      pullNumber: input.pullNumber,
      token: input.token,
    });
    last = r;
    if (r.ok && r.merged) return r;
    if (!r.ok && r.code !== "MERGE_NOT_VERIFIED") return r;
    if (i + 1 < maxAttempts) await sleepMs(delayMs);
  }
  return (
    last ?? {
      ok: false,
      code: "MERGE_NOT_VERIFIED",
      message: "GitHub에서 PR merged 상태가 확인되지 않았습니다.",
      httpStatus: 409,
    }
  );
}

export async function deleteEnvTestRemoteBranch(input: {
  repoUrl: string;
  branchName: string;
  token: string;
}): Promise<
  | { ok: true }
  | { ok: false; code: string; message: string; httpStatus?: number }
> {
  const branch = String(input.branchName ?? "").trim();
  if (!isEnvTestHelloWorldBranchName(branch)) {
    return {
      ok: false,
      code: "BRANCH_DELETE_FORBIDDEN",
      message: "ENV_TEST Hello World 브랜치만 삭제할 수 있습니다.",
      httpStatus: 400,
    };
  }
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) {
    return { ok: false, code: "REPO_NOT_GITHUB", message: "GitHub 저장소 URL이 아닙니다.", httpStatus: 400 };
  }
  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/refs/heads/${encodeURIComponent(branch)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.token}`,
      "User-Agent": "JYOrchestration/env-test-branch-delete",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (res.status === 204 || res.status === 404) {
    return { ok: true };
  }
  const txt = await res.text();
  return {
    ok: false,
    code: "GITHUB_BRANCH_DELETE_FAILED",
    message: `브랜치 삭제 실패 HTTP ${res.status}`,
    httpStatus: res.status,
  };
}

export function parsePrNumberFromPrUrl(prUrl: string): number | null {
  const p = parseGithubPrUrl(prUrl);
  return p?.number ?? null;
}

export function assertEnvTestMergeNotSafeMode(): { ok: true } | { ok: false; message: string } {
  if (isExecutionSafeMode()) {
    return { ok: false, message: "Safe mode에서는 ENV_TEST 머지를 실행할 수 없습니다." };
  }
  return { ok: true };
}

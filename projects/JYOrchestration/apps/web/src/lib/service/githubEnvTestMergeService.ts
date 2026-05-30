/**
 * ENV_TEST 전용: 플랫폼이 GitHub REST로 PR 머지 스모크 테스트(squash) + 검증.
 * 일반 Task 자동 머지에는 사용하지 않는다.
 */

import { isExecutionSafeMode } from "@/lib/production/safeMode";
import {
  githubRestApiBase,
  resolveGithubOwnerRepoStrict,
  resolveGithubRestTokenAndLog,
} from "@/lib/integration/githubRestCommon";
import { isEnvTestHelloWorldBranchName } from "@/lib/execution/branchPolicy";
import {
  isEnvTestMergeFamilyTaskKind,
  isEnvTestStage1TaskKind,
  isEnvTestStage2TaskKind,
} from "@/lib/execution/envTestTaskKind";
import {
  ENV_TEST_MERGE_ALLOWED_ROOT_PREFIX,
  ENV_TEST_MERGE_WHITELIST_PATTERN_NESTED_MD,
  ENV_TEST_MERGE_WHITELIST_PATTERN_TOP_LEVEL_MD,
  ENV_TEST_STAGE1_MERGE_ALLOWED_RULE,
  envTestStage1AllowedPathGlobs,
  isEnvTestMergeWhitelistedPath,
  isEnvTestStage1MergeWhitelistedPath,
  normalizeEnvTestMergePrFilename,
} from "@/lib/service/envTestMergeFilePolicy";
import { ENV_TEST_PR_TITLE, ENV_TEST_STAGE2_PR_TITLE } from "@/lib/service/githubEnvTestPullRequestService";
import { parseGithubPrUrl } from "@/lib/service/githubAutoMergeService";
import {
  fetchGithubPullRequestDetail,
  fetchGithubPullRequestFiles,
  type GithubPullRequestDetail,
  type GithubPullRequestFile,
} from "@/lib/service/githubPullRequestOps";

export { isEnvTestMergeWhitelistedPath, isEnvTestStage1MergeWhitelistedPath } from "@/lib/service/envTestMergeFilePolicy";

/**
 * Stage1 대표 경로(문서·UI 힌트). 머지 허용 범위는 isEnvTestStage1MergeWhitelistedPath 와 동일하게 orchestration-test 트리 전체.
 * Stage2는 orchestration-test 아래의 .md 파일만 허용(대표 경로 hello-world.md).
 */
export const ENV_TEST_MERGE_ALLOWED_FILE_PATH = `${ENV_TEST_MERGE_ALLOWED_ROOT_PREFIX}hello.txt`;

export const ENV_TEST_STAGE2_MERGE_DOCUMENT_FILE_PATH = `${ENV_TEST_MERGE_ALLOWED_ROOT_PREFIX}hello-world.md`;

export function resolveEnvTestMergeGithubToken(
  setupGithubAccessToken: string | null | undefined,
  projectId?: string | null
): string | null {
  const r = resolveGithubRestTokenAndLog("env_test_merge_github_api", setupGithubAccessToken ?? null, {
    projectId,
  });
  return r.token;
}

export async function fetchEnvTestPullDetail(input: {
  repoUrl: string;
  pullNumber: number;
  token: string;
}): Promise<
  | { ok: true; pr: GithubPullRequestDetail }
  | { ok: false; code: string; message: string; httpStatus?: number }
> {
  return fetchGithubPullRequestDetail({
    repoUrl: input.repoUrl,
    pullNumber: input.pullNumber,
    token: input.token,
    userAgent: "JYOrchestration/env-test-merge",
  });
}

export async function fetchEnvTestPullFiles(input: {
  repoUrl: string;
  pullNumber: number;
  token: string;
}): Promise<
  | { ok: true; files: GithubPullRequestFile[] }
  | { ok: false; code: string; message: string; httpStatus?: number }
> {
  const result = await fetchGithubPullRequestFiles({
    repoUrl: input.repoUrl,
    pullNumber: input.pullNumber,
    token: input.token,
    userAgent: "JYOrchestration/env-test-merge-files",
  });
  if (!result.ok) return result;
  return { ok: true, files: [...result.files] };
}

export type EnvTestMergeGuardDiagnostics = {
  taskKind: string;
  guardStage: "stage1" | "stage2";
  blockedFiles?: string[];
  /** @deprecated 로그 호환용 — allowedRule / allowedPathGlobs 사용 권장 */
  allowedPaths: string[];
  allowedRule: string;
  allowedPathGlobs: string[];
  evaluatedScopeRule: string;
  ruleEvaluation: string;
};

export type EnvTestMergeGuardResult =
  | {
      ok: true;
      pr: GithubPullRequestDetail;
      files: GithubPullRequestFile[];
      /** 진단: 화이트리스트 통과 파일별 패턴 */
      envTestFileWhitelistMatches: Array<{ filename: string; matchedPathPattern: string }>;
    }
  | {
      ok: false;
      blockedReason: string;
      blockedCode: string;
      diagnostics?: EnvTestMergeGuardDiagnostics;
    };

export function envTestMergeGuardAllowedPathsForTaskKind(taskKind: string | null | undefined): string[] {
  const tk = String(taskKind ?? "").trim();
  if (isEnvTestStage1TaskKind(tk)) {
    return [...envTestStage1AllowedPathGlobs()];
  }
  return [ENV_TEST_MERGE_WHITELIST_PATTERN_TOP_LEVEL_MD, ENV_TEST_MERGE_WHITELIST_PATTERN_NESTED_MD];
}

/** Stage1·Stage2 공통: 머지 가드가 사용하는 허용 규칙(사람이 읽기 쉬운 문장). */
export function envTestMergeGuardAllowedRuleForTaskKind(taskKind: string | null | undefined): string {
  const tk = String(taskKind ?? "").trim();
  if (isEnvTestStage1TaskKind(tk)) {
    return ENV_TEST_STAGE1_MERGE_ALLOWED_RULE;
  }
  return `${ENV_TEST_MERGE_WHITELIST_PATTERN_TOP_LEVEL_MD}, ${ENV_TEST_MERGE_WHITELIST_PATTERN_NESTED_MD}`;
}

export function envTestMergeGuardAllowedPathGlobsForTaskKind(taskKind: string | null | undefined): string[] {
  const tk = String(taskKind ?? "").trim();
  if (isEnvTestStage1TaskKind(tk)) {
    return [...envTestStage1AllowedPathGlobs()];
  }
  return [ENV_TEST_MERGE_WHITELIST_PATTERN_TOP_LEVEL_MD, ENV_TEST_MERGE_WHITELIST_PATTERN_NESTED_MD];
}

/**
 * ENV_TEST 머지 전 안전 가드(전부 통과해야 머지 가능).
 */
export function evaluateEnvTestMergeGuards(input: {
  taskKind: string | null | undefined;
  localBranchName: string | null | undefined;
  pr: GithubPullRequestDetail;
  files: GithubPullRequestFile[];
  /** 실행 설정(ExecutionSetup)의 baseBranch — ENV_TEST 머지 가드의 단일 근거 */
  requiredBaseRef: string;
}): EnvTestMergeGuardResult {
  const tk = String(input.taskKind ?? "").trim();
  if (!isEnvTestMergeFamilyTaskKind(tk)) {
    return { ok: false, blockedCode: "NOT_ENV_TEST", blockedReason: "taskKind가 ENV_TEST 계열이 아닙니다." };
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
  const expectedTitle = isEnvTestStage2TaskKind(tk) ? ENV_TEST_STAGE2_PR_TITLE : ENV_TEST_PR_TITLE;
  if (title !== expectedTitle) {
    return {
      ok: false,
      blockedCode: "PR_TITLE",
      blockedReason: "PR 제목이 해당 ENV_TEST 단계의 표준 제목과 일치하지 않습니다.",
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
  const guardStage: "stage1" | "stage2" = isEnvTestStage2TaskKind(tk) ? "stage2" : "stage1";
  const allowedPathGlobs = envTestMergeGuardAllowedPathGlobsForTaskKind(tk);
  const allowedRule = envTestMergeGuardAllowedRuleForTaskKind(tk);
  const allowedPaths = envTestMergeGuardAllowedPathsForTaskKind(tk);

  const fileScopeDiagnostics = (blockedFiles: string[], ruleEvaluation: string): EnvTestMergeGuardDiagnostics => ({
    taskKind: tk,
    guardStage,
    blockedFiles,
    allowedPaths,
    allowedRule,
    allowedPathGlobs,
    evaluatedScopeRule: allowedRule,
    ruleEvaluation,
  });

  const envTestFileWhitelistMatches: Array<{ filename: string; matchedPathPattern: string }> = [];

  if (isEnvTestStage1TaskKind(tk)) {
    for (const f of input.files) {
      const fn = normalizeEnvTestMergePrFilename(String(f.filename ?? ""));
      if (!fn) {
        const blockedReason = `Stage1 merge blocked by scope rule. Blocked file: (empty path). Allowed rule: ${ENV_TEST_STAGE1_MERGE_ALLOWED_RULE}.`;
        return {
          ok: false,
          blockedCode: "FILE_OUT_OF_SCOPE",
          blockedReason,
          diagnostics: fileScopeDiagnostics(
            input.files.map((x) => normalizeEnvTestMergePrFilename(String(x.filename ?? ""))),
            "stage1_empty_filename"
          ),
        };
      }
      const w = isEnvTestStage1MergeWhitelistedPath(fn);
      if (!w.ok || !w.matchedPathPattern) {
        const blockedReason = `Stage1 merge blocked by scope rule. Blocked file: ${fn}. Allowed rule: ${ENV_TEST_STAGE1_MERGE_ALLOWED_RULE}.`;
        return {
          ok: false,
          blockedCode: "FILE_OUT_OF_SCOPE",
          blockedReason,
          diagnostics: fileScopeDiagnostics([fn], "stage1_path_not_under_orchestration_test"),
        };
      }
      envTestFileWhitelistMatches.push({ filename: fn, matchedPathPattern: w.matchedPathPattern });
    }
    return { ok: true, pr: input.pr, files: input.files, envTestFileWhitelistMatches };
  }

  for (const f of input.files) {
    const fn = normalizeEnvTestMergePrFilename(String(f.filename ?? ""));
    const w = isEnvTestMergeWhitelistedPath(fn);
    if (!w.ok || !w.matchedPathPattern) {
      const stage2Rule = `${ENV_TEST_MERGE_WHITELIST_PATTERN_TOP_LEVEL_MD} or ${ENV_TEST_MERGE_WHITELIST_PATTERN_NESTED_MD}`;
      const blockedReason = `Stage2 merge blocked by scope rule. Blocked file: ${fn}. Allowed rule: ${stage2Rule}.`;
      return {
        ok: false,
        blockedCode: "FILE_OUT_OF_SCOPE",
        blockedReason,
        diagnostics: fileScopeDiagnostics([fn], "stage2_path_must_be_markdown_under_orchestration_test"),
      };
    }
    envTestFileWhitelistMatches.push({ filename: fn, matchedPathPattern: w.matchedPathPattern });
  }
  return { ok: true, pr: input.pr, files: input.files, envTestFileWhitelistMatches };
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
  /** Stage1 스모크: 짧은 간격·적은 재시도로 머지 반영 확인 */
  envTestMergeVerifyPreset?: "stage1_fast" | "default";
}): Promise<
  | { ok: true; mergeCommitSha: string | null; merged: boolean }
  | { ok: false; code: string; message: string; httpStatus?: number }
> {
  const preset = input.envTestMergeVerifyPreset ?? "default";
  const defaultAttempts = preset === "stage1_fast" ? 6 : 8;
  const defaultDelay = preset === "stage1_fast" ? 200 : 450;
  const maxAttempts = Math.max(1, Math.min(20, input.maxAttempts ?? defaultAttempts));
  const delayMs = Math.max(100, Math.min(5000, input.delayMs ?? defaultDelay));
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

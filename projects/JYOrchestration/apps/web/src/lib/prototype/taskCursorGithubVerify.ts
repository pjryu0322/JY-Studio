import { githubRestApiBase, resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import { buildTaskCursorGithubBranchCandidates } from "@/lib/prototype/taskCursorGithubBranchCandidates";
import {
  defaultForbiddenTargetPathGlobs,
  validateTargetRepositoryChangedFiles,
} from "@/lib/prototype/targetRepositoryPathGuard";
import {
  TASK_CURSOR_FAILURE_MESSAGES,
  type TaskCursorExecutionV1,
  type TaskCursorFailureReason,
} from "@/lib/prototype/taskCursorExecution";

export type TaskCursorGithubVerifyInput = Readonly<{
  readonly execution: TaskCursorExecutionV1;
  readonly targetRepository: ProjectTargetRepository;
  readonly githubToken: string;
  readonly allowedPathGlobs: readonly string[];
  readonly userAgent?: string;
  /** Quick Run CodeTask — branch/commit message 매칭에 사용 (parent taskId와 다를 수 있음) */
  readonly codeTaskId?: string | null;
  /** P3-M38: explicit candidates; otherwise built from workBranch + codeTaskId aliases */
  readonly branchCandidates?: readonly string[];
  readonly runWorkBranch?: string | null;
  readonly promptWorkBranch?: string | null;
}>;

export type TaskCursorGithubVerifyPhase =
  | "branch_checking"
  | "head_commit_checking"
  | "run_state_syncing";

export type TaskCursorGithubVerifyUiReason =
  | "github_branch_found"
  | "github_branch_missing"
  | "github_head_commit_found"
  | "github_head_commit_missing"
  | "github_run_state_synced"
  | "github_verify_state_sync_failed";

export type TaskCursorGithubVerifyDetailReason =
  | "branch_not_found"
  | "commit_not_found"
  | "commit_message_missing_task_id"
  | "changed_files_empty"
  | "path_guard_failed";

export type TaskCursorGithubVerifyResult = Readonly<{
  readonly ok: boolean;
  readonly reason?: TaskCursorFailureReason;
  readonly detailReason?: TaskCursorGithubVerifyDetailReason;
  readonly message?: string;
  readonly verifiedChangedFiles?: readonly string[];
  readonly verifiedCommitSha?: string;
  /** Set only by explicit manual no-code-change verification; never inferred from GitHub API. */
  readonly noCodeChangeEvidence?: string;
  readonly resolvedBranch?: string;
  readonly candidateBranches?: readonly string[];
  readonly verifyPhase?: TaskCursorGithubVerifyPhase;
  readonly uiReason?: TaskCursorGithubVerifyUiReason;
  readonly branchRefFound?: boolean;
  readonly allBranchesMissing?: boolean;
}>;

/** branch/commit이 아직 push/reflection 안 된 경우 — failed 처리하지 않고 폴링 계속 */
export function isTransientTaskCursorGithubVerifyMiss(
  result: Pick<TaskCursorGithubVerifyResult, "ok" | "reason" | "detailReason">,
): boolean {
  if (result.ok) return false;
  const detail = result.detailReason;
  if (detail === "branch_not_found" || detail === "commit_not_found") return true;
  if (detail === "changed_files_empty") return true;
  if (result.reason === "commit_not_created" || result.reason === "no_changed_files") return true;
  return false;
}

type GithubCommitResponse = Readonly<{
  readonly sha?: string;
  readonly commit?: Readonly<{ readonly message?: string }>;
  readonly files?: readonly Readonly<{ readonly filename?: string }>[];
}>;

type GithubRefResponse = Readonly<{ readonly object?: Readonly<{ readonly sha?: string }> }>;

type GithubCommitListItem = Readonly<{ readonly sha?: string }>;

type GithubCompareFile = Readonly<{ readonly filename?: string }>;

type GithubCompareResponse = Readonly<{ readonly files?: readonly GithubCompareFile[] }>;

const BRANCH_COMMIT_WALK_LIMIT = 12;

function shouldTryOlderBranchCommits(result: TaskCursorGithubVerifyResult): boolean {
  if (result.ok) return false;
  return (
    result.detailReason === "commit_message_missing_task_id" ||
    result.detailReason === "changed_files_empty" ||
    result.detailReason === "path_guard_failed"
  );
}

function commitMessageMatchesTask(input: {
  readonly commitMessage: string;
  readonly branch: string;
  readonly taskId: string;
  readonly codeTaskId?: string | null;
}): boolean {
  const commitMessage = input.commitMessage;
  const branch = input.branch.toLowerCase();
  const taskSlug = input.taskId
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  const codeTaskId = String(input.codeTaskId ?? "").trim();
  const codeTaskSlug = codeTaskId
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return (
    commitMessage.includes(input.taskId) ||
    (codeTaskId &&
      (commitMessage.includes(codeTaskId) || branch.includes(codeTaskId.toLowerCase()))) ||
    (codeTaskSlug &&
      (commitMessage.toLowerCase().includes(codeTaskSlug) || branch.includes(codeTaskSlug))) ||
    (taskSlug &&
      (commitMessage.toLowerCase().includes(taskSlug) || branch.includes(taskSlug)))
  );
}

async function evaluateGithubCommitForTaskCursor(input: {
  readonly commitSha: string;
  readonly branch: string;
  readonly execution: TaskCursorExecutionV1;
  readonly targetRepository: ProjectTargetRepository;
  readonly githubToken: string;
  readonly allowedPathGlobs: readonly string[];
  readonly codeTaskId?: string | null;
  readonly userAgent: string;
  readonly api: string;
  readonly owner: string;
  readonly repo: string;
  readonly repoFullName: string;
}): Promise<TaskCursorGithubVerifyResult> {
  const commitUrl = `${input.api}/repos/${input.owner}/${input.repo}/commits/${encodeURIComponent(input.commitSha)}`;
  const commitRes = await githubFetchJson<GithubCommitResponse>(commitUrl, input.githubToken, input.userAgent);
  if (!commitRes.ok) {
    if (commitRes.status === 401 || commitRes.status === 403) {
      return {
        ok: false,
        reason: "github_auth_failed",
        message: TASK_CURSOR_FAILURE_MESSAGES.github_auth_failed,
      };
    }
    return {
      ok: false,
      reason: commitRes.status === 404 ? "commit_not_created" : "github_verify_failed",
      detailReason: commitRes.status === 404 ? "commit_not_found" : undefined,
      message: formatTaskCursorGithubCommitFailureMessage({
        commitSha: input.commitSha,
        repoFullName: input.repoFullName,
        httpStatus: commitRes.status,
      }),
    };
  }

  const commitMessage = String(commitRes.data.commit?.message ?? "");
  if (
    !commitMessageMatchesTask({
      commitMessage,
      branch: input.branch,
      taskId: input.execution.taskId,
      codeTaskId: input.codeTaskId,
    })
  ) {
    return {
      ok: false,
      reason: "github_verify_failed",
      detailReason: "commit_message_missing_task_id",
      message: `GitHub commit message에 taskId \`${input.execution.taskId}\`가 포함되어 있지 않습니다. WIP branch \`${input.branch}\`의 commit \`${input.commitSha.slice(0, 12)}\` message를 확인해 주세요.`,
    };
  }

  const apiFiles =
    commitRes.data.files?.map((f) => String(f.filename ?? "").trim()).filter(Boolean) ?? [];
  let changedFiles =
    apiFiles.length > 0 ? apiFiles : [...(input.execution.changedFiles ?? [])];
  if (!changedFiles.length) {
    const compareFiles = await listChangedFilesFromBranchCompare({
      api: input.api,
      owner: input.owner,
      repo: input.repo,
      baseBranch: input.execution.baseBranch,
      branch: input.branch,
      githubToken: input.githubToken,
      userAgent: input.userAgent,
    });
    if (compareFiles.length) changedFiles = compareFiles;
  }
  if (!changedFiles.length) {
    return {
      ok: false,
      reason: "no_changed_files",
      detailReason: "changed_files_empty",
      message: TASK_CURSOR_FAILURE_MESSAGES.no_changed_files,
    };
  }

  const pathValidation = validateTargetRepositoryChangedFiles({
    changedFiles,
    targetRepository: input.targetRepository,
    allowedPathGlobs: input.allowedPathGlobs,
    forbiddenPathGlobs: defaultForbiddenTargetPathGlobs(),
  });
  if (!pathValidation.ok) {
    return {
      ok: false,
      reason: "github_verify_failed",
      detailReason: "path_guard_failed",
      message: pathValidation.message,
    };
  }

  return { ok: true, verifiedChangedFiles: changedFiles, verifiedCommitSha: input.commitSha };
}

async function listChangedFilesFromBranchCompare(input: {
  readonly api: string;
  readonly owner: string;
  readonly repo: string;
  readonly baseBranch: string;
  readonly branch: string;
  readonly githubToken: string;
  readonly userAgent: string;
}): Promise<readonly string[]> {
  const base = String(input.baseBranch ?? "main").trim() || "main";
  const head = String(input.branch ?? "").trim();
  if (!head) return [];
  const url = `${input.api}/repos/${input.owner}/${input.repo}/compare/${encodeURIComponent(`${base}...${head}`)}`;
  const res = await githubFetchJson<GithubCompareResponse>(url, input.githubToken, input.userAgent);
  if (!res.ok) return [];
  return (res.data.files ?? [])
    .map((f) => String(f.filename ?? "").trim())
    .filter(Boolean);
}

async function listBranchCommitShas(input: {
  readonly api: string;
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
  readonly githubToken: string;
  readonly userAgent: string;
}): Promise<readonly string[]> {
  const url = `${input.api}/repos/${input.owner}/${input.repo}/commits?sha=${encodeURIComponent(input.branch)}&per_page=${BRANCH_COMMIT_WALK_LIMIT}`;
  const res = await githubFetchJson<readonly GithubCommitListItem[]>(url, input.githubToken, input.userAgent);
  if (!res.ok) return [];
  return (res.data ?? [])
    .map((item) => String(item.sha ?? "").trim())
    .filter(Boolean);
}

export function formatTaskCursorGithubRefFailureMessage(input: {
  readonly branch: string;
  readonly repoFullName: string;
  readonly httpStatus: number;
}): string {
  if (input.httpStatus === 404) {
    return `GitHub에 WIP branch \`${input.branch}\`가 없습니다. Cursor Agent가 ${input.repoFullName} 저장소에 WIP commit을 push했는지 확인해 주세요.`;
  }
  return TASK_CURSOR_FAILURE_MESSAGES.github_verify_failed;
}

export function formatTaskCursorGithubCommitFailureMessage(input: {
  readonly commitSha: string;
  readonly repoFullName: string;
  readonly httpStatus: number;
}): string {
  if (input.httpStatus === 404) {
    return `GitHub에서 commit \`${input.commitSha.slice(0, 12)}\`을(를) 찾지 못했습니다. WIP branch push가 완료되었는지 확인해 주세요.`;
  }
  return TASK_CURSOR_FAILURE_MESSAGES.github_verify_failed;
}

async function githubFetchJson<T>(
  url: string,
  token: string,
  userAgent: string,
): Promise<
  | Readonly<{ readonly ok: true; readonly data: T; readonly status: number }>
  | Readonly<{ readonly ok: false; readonly status: number; readonly body: string }>
> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": userAgent,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const txt = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: txt.slice(0, 500) };
  try {
    return { ok: true, data: JSON.parse(txt) as T, status: res.status };
  } catch {
    return { ok: false, status: res.status, body: txt.slice(0, 500) };
  }
}

export async function verifyTaskCursorGithubResult(
  input: TaskCursorGithubVerifyInput,
): Promise<TaskCursorGithubVerifyResult> {
  const token = input.githubToken.trim();
  if (!token) {
    return {
      ok: false,
      reason: "github_auth_failed",
      message: TASK_CURSOR_FAILURE_MESSAGES.github_auth_failed,
    };
  }

  const repoUrl = input.targetRepository.gitRepoUrl;
  const parsed = resolveGithubOwnerRepoStrict(repoUrl);
  if (!parsed) {
    return {
      ok: false,
      reason: "github_verify_failed",
      message: "GitHub 저장소 URL이 올바르지 않습니다.",
    };
  }

  const candidates =
    input.branchCandidates?.length
      ? [...input.branchCandidates]
      : buildTaskCursorGithubBranchCandidates({
          codeTaskId: input.codeTaskId,
          executionWorkBranch: input.execution.workBranch,
          runWorkBranch: input.runWorkBranch,
          promptWorkBranch: input.promptWorkBranch,
        });

  if (!candidates.length) {
    return {
      ok: false,
      reason: "github_verify_failed",
      message: "WIP branch(workBranch)가 없어 GitHub 검수를 할 수 없습니다.",
      uiReason: "github_branch_missing",
      allBranchesMissing: true,
      candidateBranches: candidates,
    };
  }

  let lastMiss: TaskCursorGithubVerifyResult | null = null;
  let anyBranchFound = false;

  for (const branch of candidates) {
    const executionForBranch = { ...input.execution, workBranch: branch };
    const result = await verifyTaskCursorGithubResultOnBranch({
      ...input,
      execution: executionForBranch,
      branch,
    });
    if (result.branchRefFound) anyBranchFound = true;
    if (result.ok) {
      return {
        ...result,
        resolvedBranch: branch,
        candidateBranches: candidates,
        uiReason: "github_head_commit_found",
        verifyPhase: "run_state_syncing",
      };
    }
    if (result.reason === "github_auth_failed") {
      return { ...result, candidateBranches: candidates, resolvedBranch: branch };
    }
    lastMiss = result;
    if (result.branchRefFound && !isTransientTaskCursorGithubVerifyMiss(result)) {
      return {
        ...result,
        resolvedBranch: branch,
        candidateBranches: candidates,
        uiReason:
          result.detailReason === "commit_not_found"
            ? "github_head_commit_missing"
            : "github_head_commit_missing",
        verifyPhase: "head_commit_checking",
      };
    }
  }

  if (!anyBranchFound) {
    const miss = lastMiss ?? {
      ok: false,
      reason: "github_verify_failed" as const,
      detailReason: "branch_not_found" as const,
      message: formatTaskCursorGithubRefFailureMessage({
        branch: candidates[0] ?? "",
        repoFullName: input.targetRepository.repoFullName,
        httpStatus: 404,
      }),
    };
    return {
      ...miss,
      candidateBranches: candidates,
      allBranchesMissing: true,
      uiReason: "github_branch_missing",
      verifyPhase: "branch_checking",
    };
  }

  const fallback = lastMiss ?? {
    ok: false,
    reason: "github_verify_failed" as const,
    message: TASK_CURSOR_FAILURE_MESSAGES.github_verify_failed,
  };
  return {
    ...fallback,
    candidateBranches: candidates,
    branchRefFound: true,
    uiReason: "github_head_commit_missing",
    verifyPhase: "head_commit_checking",
    resolvedBranch: fallback.resolvedBranch,
  };
}

async function verifyTaskCursorGithubResultOnBranch(
  input: TaskCursorGithubVerifyInput & { readonly branch: string },
): Promise<TaskCursorGithubVerifyResult & { readonly branchRefFound?: boolean }> {
  const token = input.githubToken.trim();
  const parsed = resolveGithubOwnerRepoStrict(input.targetRepository.gitRepoUrl)!;

  const commitShaFromExecution = String(input.execution.commitSha ?? "").trim();
  const hasStoredCommitSha =
    Boolean(commitShaFromExecution) && !commitShaFromExecution.startsWith("wip-stub");

  const userAgent = input.userAgent ?? "JYOrchestration/task-cursor-github-verify";
  const api = githubRestApiBase();
  const owner = encodeURIComponent(parsed.owner);
  const repo = encodeURIComponent(parsed.repo);
  const branch = String(input.branch ?? "").trim();
  if (!branch) {
    return {
      ok: false,
      reason: "github_verify_failed",
      message: "WIP branch(workBranch)가 없어 GitHub 검수를 할 수 없습니다.",
      branchRefFound: false,
    };
  }
  const repoFullName = input.targetRepository.repoFullName;
  const refUrl = `${api}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`;
  const refRes = await githubFetchJson<GithubRefResponse>(refUrl, token, userAgent);
  if (!refRes.ok) {
    if (refRes.status === 401 || refRes.status === 403) {
      return {
        ok: false,
        reason: "github_auth_failed",
        message: TASK_CURSOR_FAILURE_MESSAGES.github_auth_failed,
        branchRefFound: false,
      };
    }
    return {
      ok: false,
      reason: refRes.status === 404 ? "github_verify_failed" : "github_verify_failed",
      detailReason: refRes.status === 404 ? "branch_not_found" : undefined,
      message: formatTaskCursorGithubRefFailureMessage({
        branch,
        repoFullName,
        httpStatus: refRes.status,
      }),
      branchRefFound: false,
      uiReason: refRes.status === 404 ? "github_branch_missing" : undefined,
    };
  }

  const branchHeadSha = String(refRes.data?.object?.sha ?? "").trim();
  const commitSha = hasStoredCommitSha ? commitShaFromExecution : branchHeadSha;
  if (!commitSha) {
    return {
      ok: false,
      reason: "commit_not_created",
      message: TASK_CURSOR_FAILURE_MESSAGES.commit_not_created,
      branchRefFound: true,
      uiReason: "github_head_commit_missing",
    };
  }

  const evalInput = {
    branch,
    execution: input.execution,
    targetRepository: input.targetRepository,
    githubToken: token,
    allowedPathGlobs: input.allowedPathGlobs,
    codeTaskId: input.codeTaskId,
    userAgent,
    api,
    owner,
    repo,
    repoFullName,
  };

  let headResult = await evaluateGithubCommitForTaskCursor({
    ...evalInput,
    commitSha,
  });
  if (headResult.ok) {
    return { ...headResult, branchRefFound: true, uiReason: "github_branch_found" };
  }
  if (headResult.reason === "github_auth_failed") {
    return { ...headResult, branchRefFound: true };
  }

  if (shouldTryOlderBranchCommits(headResult)) {
    const shas = await listBranchCommitShas({
      api,
      owner,
      repo,
      branch,
      githubToken: token,
      userAgent,
    });
    for (const olderSha of shas) {
      if (olderSha === commitSha) continue;
      const candidate = await evaluateGithubCommitForTaskCursor({
        ...evalInput,
        commitSha: olderSha,
      });
      if (candidate.ok) {
        return { ...candidate, branchRefFound: true, uiReason: "github_branch_found" };
      }
      if (candidate.reason === "github_auth_failed") {
        return { ...candidate, branchRefFound: true };
      }
    }
  }

  return { ...headResult, branchRefFound: true };
}

export function evaluateTaskCursorGithubVerifyReadiness(input: {
  readonly setup?: import("@/lib/prototype/executionSetupSourceGeneration").ExecutionSetupSourceGenerationRow | null;
}): Readonly<
  | {
      readonly ok: true;
      readonly targetRepository: ProjectTargetRepository;
      readonly allowedPathGlobs: readonly string[];
    }
  | { readonly ok: false; readonly message: string }
> {
  const setup = input.setup ?? null;
  if (!setup) {
    return { ok: false, message: "실행환경 설정이 없습니다. 환경설정에서 GitHub 저장소를 저장해 주세요." };
  }
  const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
    gitRepoUrl: setup.gitRepoUrl,
    gitRepoName: setup.gitRepoName,
    gitRepoProvider: setup.gitRepoProvider,
    baseBranch: setup.baseBranch,
  });
  if (!targetRepository) {
    return { ok: false, message: "Git 저장소 설정이 없습니다. 환경설정에서 GitHub 저장소를 저장해 주세요." };
  }
  const hasGithubToken =
    setup.hasGithubAccessToken === true || Boolean(String(setup.githubAccessToken ?? "").trim());
  if (!hasGithubToken) {
    return { ok: false, message: TASK_CURSOR_FAILURE_MESSAGES.github_auth_failed };
  }
  const allowedPathGlobs = Array.isArray(setup.allowedPathGlobs)
    ? setup.allowedPathGlobs.map((g) => String(g).trim()).filter(Boolean)
    : [];
  return { ok: true, targetRepository, allowedPathGlobs };
}

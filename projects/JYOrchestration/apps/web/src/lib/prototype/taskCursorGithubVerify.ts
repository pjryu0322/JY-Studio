import { githubRestApiBase, resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
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
}>;

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
}>;

type GithubCommitResponse = Readonly<{
  readonly sha?: string;
  readonly commit?: Readonly<{ readonly message?: string }>;
  readonly files?: readonly Readonly<{ readonly filename?: string }>[];
}>;

type GithubRefResponse = Readonly<{ readonly object?: Readonly<{ readonly sha?: string }> }>;

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

  const commitShaFromExecution = String(input.execution.commitSha ?? "").trim();
  const hasStoredCommitSha =
    Boolean(commitShaFromExecution) && !commitShaFromExecution.startsWith("wip-stub");

  const userAgent = input.userAgent ?? "JYOrchestration/task-cursor-github-verify";
  const api = githubRestApiBase();
  const owner = encodeURIComponent(parsed.owner);
  const repo = encodeURIComponent(parsed.repo);
  const branch = String(input.execution.workBranch ?? "").trim();
  if (!branch) {
    return {
      ok: false,
      reason: "github_verify_failed",
      message: "WIP branch(workBranch)가 없어 GitHub 검수를 할 수 없습니다.",
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
    };
  }

  const branchHeadSha = String(refRes.data?.object?.sha ?? "").trim();
  const commitSha = hasStoredCommitSha ? commitShaFromExecution : branchHeadSha;
  if (!commitSha) {
    return {
      ok: false,
      reason: "commit_not_created",
      message: TASK_CURSOR_FAILURE_MESSAGES.commit_not_created,
    };
  }

  const commitUrl = `${api}/repos/${owner}/${repo}/commits/${encodeURIComponent(commitSha)}`;
  const commitRes = await githubFetchJson<GithubCommitResponse>(commitUrl, token, userAgent);
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
        commitSha,
        repoFullName,
        httpStatus: commitRes.status,
      }),
    };
  }

  const commitMessage = String(commitRes.data.commit?.message ?? "");
  if (!commitMessage.includes(input.execution.taskId)) {
    return {
      ok: false,
      reason: "github_verify_failed",
      detailReason: "commit_message_missing_task_id",
      message: `GitHub commit message에 taskId \`${input.execution.taskId}\`가 포함되어 있지 않습니다. WIP branch \`${branch}\`의 최신 commit message를 확인해 주세요.`,
    };
  }

  const apiFiles =
    commitRes.data.files?.map((f) => String(f.filename ?? "").trim()).filter(Boolean) ?? [];
  const changedFiles =
    apiFiles.length > 0 ? apiFiles : [...(input.execution.changedFiles ?? [])];
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

  return { ok: true, verifiedChangedFiles: changedFiles, verifiedCommitSha: commitSha };
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

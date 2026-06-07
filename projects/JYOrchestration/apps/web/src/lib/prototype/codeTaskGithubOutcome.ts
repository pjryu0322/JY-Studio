import type { CodeTaskExecutionRunStatus, CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { TaskCursorGithubVerifyResult } from "@/lib/prototype/taskCursorGithubVerify";

export type CodeTaskGithubOutcomeFailureReason =
  | "github_branch_missing"
  | "github_head_commit_missing"
  | "github_base_head_missing"
  | "github_no_new_commit"
  | "github_compare_failed"
  | "github_verify_timeout"
  | "github_api_error"
  | "github_verify_state_sync_failed";

export type CodeTaskGithubOutcomeV1 =
  | Readonly<{
      readonly status: "pending";
      readonly checkedAt?: string | null;
      readonly workBranch?: string | null;
    }>
  | Readonly<{
      readonly status: "verified";
      readonly checkedAt: string;
      readonly workBranch: string;
      readonly commitSha: string;
      readonly source: "github_rest";
      readonly repairedWorkBranch?: boolean;
      readonly previousWorkBranch?: string | null;
      readonly verifyQuality?: "verified" | "verified_with_empty_file_diff" | "verified_with_compare_warning";
      readonly headSha?: string;
      readonly baseHeadSha?: string;
      readonly legacyBranchUsed?: boolean;
    }>
  | Readonly<{
      readonly status: "failed";
      readonly checkedAt: string;
      readonly workBranch?: string | null;
      readonly reason: CodeTaskGithubOutcomeFailureReason;
      readonly retryable: boolean;
      readonly message?: string | null;
    }>;

export function parseCodeTaskGithubOutcomeV1(raw: unknown): CodeTaskGithubOutcomeV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = String(o.status ?? "").trim();
  if (status === "pending") {
    return {
      status: "pending",
      ...(o.checkedAt ? { checkedAt: String(o.checkedAt).trim() || null } : {}),
      ...(o.workBranch ? { workBranch: String(o.workBranch).trim() } : {}),
    };
  }
  if (status === "verified") {
    const commitSha = String(o.commitSha ?? "").trim();
    const workBranch = String(o.workBranch ?? "").trim();
    const checkedAt = String(o.checkedAt ?? "").trim();
    if (!commitSha || !workBranch || !checkedAt) return null;
    return {
      status: "verified",
      checkedAt,
      workBranch,
      commitSha,
      source: "github_rest",
      ...(o.repairedWorkBranch === true ? { repairedWorkBranch: true } : {}),
      ...(o.previousWorkBranch !== undefined
        ? { previousWorkBranch: String(o.previousWorkBranch ?? "").trim() || null }
        : {}),
      ...(o.verifyQuality === "verified_with_empty_file_diff" ||
      o.verifyQuality === "verified_with_compare_warning"
        ? { verifyQuality: o.verifyQuality as "verified_with_empty_file_diff" | "verified_with_compare_warning" }
        : {}),
      ...(typeof o.headSha === "string" && o.headSha.trim() ? { headSha: o.headSha.trim() } : {}),
      ...(typeof o.baseHeadSha === "string" && o.baseHeadSha.trim()
        ? { baseHeadSha: o.baseHeadSha.trim() }
        : {}),
      ...(o.legacyBranchUsed === true ? { legacyBranchUsed: true } : {}),
    };
  }
  if (status === "failed") {
    const reason = String(o.reason ?? "").trim() as CodeTaskGithubOutcomeFailureReason;
    const checkedAt = String(o.checkedAt ?? "").trim();
    if (!checkedAt || !reason) return null;
    return {
      status: "failed",
      checkedAt,
      reason,
      retryable: o.retryable === true,
      ...(o.workBranch ? { workBranch: String(o.workBranch).trim() } : {}),
      ...(o.message ? { message: String(o.message).trim() } : {}),
    };
  }
  return null;
}

export function normalizeCodeTaskGithubOutcomeFromRun(
  run: Pick<
    CodeTaskExecutionRunV1,
    "githubOutcome" | "commitSha" | "branchHeadCommitSha" | "workBranch" | "updatedAt"
  >,
  nowIso?: string,
): CodeTaskGithubOutcomeV1 | undefined {
  const parsed = run.githubOutcome ? parseCodeTaskGithubOutcomeV1(run.githubOutcome) : null;
  if (parsed) return parsed;
  const commitSha = String(run.commitSha ?? run.branchHeadCommitSha ?? "").trim();
  if (!commitSha) return undefined;
  const workBranch = String(run.workBranch ?? "").trim();
  if (!workBranch) return undefined;
  return {
    status: "verified",
    checkedAt: run.updatedAt ?? nowIso ?? new Date().toISOString(),
    workBranch,
    commitSha,
    source: "github_rest",
  };
}

export function runHasVerifiedGithubOutcome(
  run: Pick<
    CodeTaskExecutionRunV1,
    "githubOutcome" | "commitSha" | "branchHeadCommitSha" | "workBranch" | "updatedAt"
  > | null | undefined,
): boolean {
  if (!run) return false;
  return normalizeCodeTaskGithubOutcomeFromRun(run)?.status === "verified";
}

export function runHasTerminalGithubOutcome(
  run: Pick<CodeTaskExecutionRunV1, "githubOutcome" | "commitSha" | "branchHeadCommitSha" | "workBranch" | "updatedAt"> | null | undefined,
): boolean {
  const outcome = run ? normalizeCodeTaskGithubOutcomeFromRun(run) : undefined;
  return outcome?.status === "verified" || outcome?.status === "failed";
}

export function buildVerifiedCodeTaskGithubOutcome(input: {
  readonly checkedAt: string;
  readonly workBranch: string;
  readonly commitSha: string;
  readonly repairedWorkBranch?: boolean;
  readonly previousWorkBranch?: string | null;
  readonly verifyQuality?: "verified" | "verified_with_empty_file_diff" | "verified_with_compare_warning";
  readonly headSha?: string;
  readonly baseHeadSha?: string;
  readonly legacyBranchUsed?: boolean;
}): CodeTaskGithubOutcomeV1 {
  return {
    status: "verified",
    checkedAt: input.checkedAt,
    workBranch: input.workBranch.trim(),
    commitSha: input.commitSha.trim(),
    source: "github_rest",
    ...(input.repairedWorkBranch ? { repairedWorkBranch: true } : {}),
    ...(input.previousWorkBranch !== undefined
      ? { previousWorkBranch: input.previousWorkBranch }
      : {}),
    ...(input.verifyQuality && input.verifyQuality !== "verified"
      ? { verifyQuality: input.verifyQuality }
      : {}),
    ...(input.headSha?.trim() ? { headSha: input.headSha.trim() } : {}),
    ...(input.baseHeadSha?.trim() ? { baseHeadSha: input.baseHeadSha.trim() } : {}),
    ...(input.legacyBranchUsed ? { legacyBranchUsed: true } : {}),
  };
}

export function buildFailedCodeTaskGithubOutcome(input: {
  readonly checkedAt: string;
  readonly reason: CodeTaskGithubOutcomeFailureReason;
  readonly retryable: boolean;
  readonly workBranch?: string | null;
  readonly message?: string | null;
}): CodeTaskGithubOutcomeV1 {
  return {
    status: "failed",
    checkedAt: input.checkedAt,
    reason: input.reason,
    retryable: input.retryable,
    ...(input.workBranch?.trim() ? { workBranch: input.workBranch.trim() } : {}),
    ...(input.message?.trim() ? { message: input.message.trim() } : {}),
  };
}

export function buildPendingCodeTaskGithubOutcome(input: {
  readonly checkedAt?: string;
  readonly workBranch?: string | null;
}): CodeTaskGithubOutcomeV1 {
  return {
    status: "pending",
    ...(input.checkedAt ? { checkedAt: input.checkedAt } : {}),
    ...(input.workBranch?.trim() ? { workBranch: input.workBranch.trim() } : {}),
  };
}

export function mapVerifyResultToGithubOutcomeFailureReason(
  verify: Pick<TaskCursorGithubVerifyResult, "ok" | "uiReason" | "allBranchesMissing" | "detailReason" | "reason">,
): CodeTaskGithubOutcomeFailureReason {
  if (verify.detailReason === "no_new_commit") return "github_no_new_commit";
  if (verify.detailReason === "base_head_missing") return "github_base_head_missing";
  if (verify.allBranchesMissing || verify.uiReason === "github_branch_missing") {
    return "github_branch_missing";
  }
  if (verify.uiReason === "github_head_commit_missing" || verify.detailReason === "commit_not_found") {
    return "github_head_commit_missing";
  }
  if (verify.reason === "github_verify_timeout") return "github_verify_timeout";
  if (verify.reason === "github_verify_state_sync_failed") return "github_verify_state_sync_failed";
  if (verify.reason === "github_auth_failed" || verify.reason === "github_verify_failed") {
    return "github_api_error";
  }
  return "github_api_error";
}

export function buildGithubOutcomeFromVerifyResult(input: {
  readonly verify: TaskCursorGithubVerifyResult;
  readonly nowIso: string;
  readonly previousWorkBranch?: string | null;
  readonly resolvedWorkBranch?: string | null;
}): CodeTaskGithubOutcomeV1 {
  const nowIso = input.nowIso;
  if (input.verify.ok && input.verify.verifiedCommitSha) {
    const workBranch =
      String(input.resolvedWorkBranch ?? input.verify.resolvedBranch ?? "").trim() ||
      String(input.previousWorkBranch ?? "").trim();
    const previous = String(input.previousWorkBranch ?? "").trim();
    const repaired =
      Boolean(workBranch && previous && workBranch !== previous) ||
      Boolean(input.verify.resolvedBranch && previous && input.verify.resolvedBranch !== previous);
    return buildVerifiedCodeTaskGithubOutcome({
      checkedAt: nowIso,
      workBranch: workBranch || input.verify.resolvedBranch || "unknown",
      commitSha: input.verify.verifiedCommitSha,
      ...(repaired
        ? { repairedWorkBranch: true, previousWorkBranch: previous || null }
        : {}),
      ...(input.verify.verifyQuality && input.verify.verifyQuality !== "verified"
        ? { verifyQuality: input.verify.verifyQuality }
        : {}),
      ...(input.verify.headSha ? { headSha: input.verify.headSha } : {}),
      ...(input.verify.baseHeadSha ? { baseHeadSha: input.verify.baseHeadSha } : {}),
      ...(input.verify.legacyBranchUsed ? { legacyBranchUsed: true } : {}),
    });
  }
  const reason = mapVerifyResultToGithubOutcomeFailureReason(input.verify);
  const retryable =
    reason === "github_branch_missing" ||
    reason === "github_head_commit_missing" ||
    reason === "github_base_head_missing" ||
    reason === "github_verify_timeout" ||
    reason === "github_verify_state_sync_failed" ||
    reason === "github_api_error";
  return buildFailedCodeTaskGithubOutcome({
    checkedAt: nowIso,
    reason,
    retryable,
    workBranch: input.resolvedWorkBranch ?? input.verify.resolvedBranch ?? input.previousWorkBranch,
    message: input.verify.message ?? null,
  });
}

const RUN_STATUSES_PRESERVED_AFTER_VERIFIED_GITHUB = new Set<string>([
  "completed",
  "quality_gate_passed",
  "quality_gate_running",
  "no_code_change_completed",
  "skipped_by_user",
  "cancelled",
]);

/** verified githubOutcome 반영 시 run.status를 github_verified 이상으로 승격한다. */
export function resolveRunStatusAfterGithubOutcome(input: {
  readonly currentStatus: CodeTaskExecutionRunStatus | string | null | undefined;
  readonly githubOutcome: CodeTaskGithubOutcomeV1 | null | undefined;
}): CodeTaskExecutionRunStatus {
  if (input.githubOutcome?.status !== "verified") {
    const fallback = String(input.currentStatus ?? "").trim() as CodeTaskExecutionRunStatus;
    return fallback || "queued";
  }

  const current = String(input.currentStatus ?? "").trim();
  if (RUN_STATUSES_PRESERVED_AFTER_VERIFIED_GITHUB.has(current)) {
    return current as CodeTaskExecutionRunStatus;
  }

  return "github_verified";
}

export function patchRunWithGithubOutcome(input: {
  readonly run: CodeTaskExecutionRunV1;
  readonly githubOutcome: CodeTaskGithubOutcomeV1;
  readonly nowIso: string;
}): Partial<CodeTaskExecutionRunV1> {
  const patch: Partial<CodeTaskExecutionRunV1> = {
    githubOutcome: input.githubOutcome,
    updatedAt: input.nowIso,
  };
  if (input.githubOutcome.status === "verified") {
    patch.workBranch = input.githubOutcome.workBranch;
    patch.commitSha = input.githubOutcome.commitSha;
    patch.branchHeadCommitSha = input.githubOutcome.commitSha;
    patch.status = resolveRunStatusAfterGithubOutcome({
      currentStatus: input.run.status,
      githubOutcome: input.githubOutcome,
    });
  }
  if (input.githubOutcome.status === "failed") {
    patch.failureReason = input.githubOutcome.reason;
    patch.errorMessage = input.githubOutcome.message ?? undefined;
  }
  return patch;
}

export type CodeTaskGithubOutcomeFlowHint =
  | "github_verified"
  | "github_verifying"
  | "github_branch_missing"
  | "github_verify_timeout"
  | "failed"
  | "completed"
  | null;

export function deriveFlowHintFromRunGithubOutcome(
  run: Pick<
    CodeTaskExecutionRunV1,
    "status" | "githubOutcome" | "commitSha" | "branchHeadCommitSha" | "workBranch" | "updatedAt"
  > | null,
): CodeTaskGithubOutcomeFlowHint {
  if (!run) return null;
  if (run.status === "completed" || run.status === "no_code_change_completed") return "completed";
  const outcome = normalizeCodeTaskGithubOutcomeFromRun(run);
  if (!outcome) {
    if (run.status === "github_verifying") return "github_verifying";
    return null;
  }
  if (outcome.status === "verified") {
    if (run.status === "completed" || run.status === "no_code_change_completed") return "completed";
    if (run.status === "github_verified") return "github_verified";
    return "github_verified";
  }
  if (outcome.status === "failed") {
    if (outcome.reason === "github_branch_missing") return "github_branch_missing";
    if (outcome.reason === "github_verify_timeout") return "github_verify_timeout";
    return "failed";
  }
  if (outcome.status === "pending") return "github_verifying";
  return null;
}

import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  buildTaskCursorGithubBranchCandidates,
} from "@/lib/prototype/taskCursorGithubBranchCandidates";
import type { TaskCursorGithubVerifyDiagnosticsV1, TaskCursorExecutionV1, TaskCursorFailureReason } from "@/lib/prototype/taskCursorExecution";
import type {
  TaskCursorGithubVerifyPhase,
  TaskCursorGithubVerifyUiReason,
} from "@/lib/prototype/taskCursorGithubVerify";

export type TaskCursorGithubVerifyDiagnosticLine = Readonly<{
  readonly label: string;
  readonly value: string;
}>;

function formatLastCheckKo(iso: string | undefined): string | null {
  const raw = String(iso ?? "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function resolveTaskCursorGithubVerifyProgressLabelKo(input: {
  readonly execution?: TaskCursorExecutionV1 | null;
  readonly diagnostics?: TaskCursorGithubVerifyDiagnosticsV1 | null;
}): string {
  const execution = input.execution;
  const diagnostics = input.diagnostics ?? execution?.githubVerifyDiagnosticsV1 ?? null;
  const phase = diagnostics?.verifyPhase;
  if (phase === "branch_checking") return "GitHub branch 확인 중";
  if (phase === "head_commit_checking") return "GitHub head commit 확인 중";
  if (phase === "run_state_syncing") return "플랫폼 실행 상태 반영 중";
  if (execution?.failureReason === "github_verify_state_sync_failed") {
    return "GitHub 상태 반영 실패";
  }
  return "GitHub commit 확인 중";
}

export function buildTaskCursorGithubVerifyDiagnosticsView(input: {
  readonly codeTaskId?: string | null;
  readonly execution?: TaskCursorExecutionV1 | null;
  readonly run?: CodeTaskExecutionRunV1 | null;
}): Readonly<{
  readonly progressLabel: string;
  readonly technicalLines: readonly TaskCursorGithubVerifyDiagnosticLine[];
  readonly stateSyncFailed: boolean;
}> {
  const execution = input.execution ?? null;
  const run = input.run ?? null;
  const diagnostics = execution?.githubVerifyDiagnosticsV1 ?? null;
  const candidates =
    diagnostics?.candidateBranches?.length
      ? diagnostics.candidateBranches
      : buildTaskCursorGithubBranchCandidates({
          codeTaskId: input.codeTaskId,
          executionWorkBranch: execution?.workBranch,
          runWorkBranch: run?.workBranch,
        });

  const primaryBranch =
    diagnostics?.primaryBranch?.trim() ||
    diagnostics?.resolvedBranch?.trim() ||
    String(execution?.workBranch ?? run?.workBranch ?? candidates[0] ?? "").trim() ||
    "—";

  const branchStatus = diagnostics?.branchStatus;
  const branchStatusKo =
    branchStatus === "exists"
      ? "존재함"
      : branchStatus === "missing"
        ? "없음"
        : "확인 중";

  const headStatus = diagnostics?.headCommitStatus;
  const headSha =
    diagnostics?.headCommitShaPreview?.trim() ||
    String(run?.branchHeadCommitSha ?? run?.commitSha ?? execution?.commitSha ?? "").trim();
  const headCommitKo =
    execution?.failureReason === "github_verify_state_sync_failed" && headSha
      ? headSha.slice(0, 12)
      : headStatus === "found" && headSha
        ? headSha.slice(0, 12)
        : headStatus === "missing"
          ? "없음"
          : "확인 중";

  const lastCheck = formatLastCheckKo(
    execution?.githubProgressLastCheckAt ?? run?.updatedAt,
  );

  const stateSyncFailed = execution?.failureReason === "github_verify_state_sync_failed";

  const technicalLines: TaskCursorGithubVerifyDiagnosticLine[] = [
    { label: "검증 대상 branch", value: primaryBranch },
    { label: "GitHub branch", value: branchStatusKo },
    { label: "head commit", value: headCommitKo },
    ...(lastCheck ? [{ label: "마지막 확인", value: lastCheck }] : []),
  ];

  return {
    progressLabel: resolveTaskCursorGithubVerifyProgressLabelKo({ execution, diagnostics }),
    technicalLines,
    stateSyncFailed,
  };
}

export function buildTaskCursorGithubVerifyDiagnosticsPatch(input: {
  readonly verifyPhase?: TaskCursorGithubVerifyPhase;
  readonly lastUiReason?: TaskCursorGithubVerifyUiReason;
  readonly primaryBranch?: string;
  readonly resolvedBranch?: string;
  readonly candidateBranches?: readonly string[];
  readonly branchStatus?: "checking" | "exists" | "missing";
  readonly headCommitStatus?: "checking" | "found" | "missing";
  readonly headCommitShaPreview?: string;
}): TaskCursorGithubVerifyDiagnosticsV1 {
  return {
    ...(input.verifyPhase ? { verifyPhase: input.verifyPhase } : {}),
    ...(input.lastUiReason ? { lastUiReason: input.lastUiReason } : {}),
    ...(input.primaryBranch ? { primaryBranch: input.primaryBranch } : {}),
    ...(input.resolvedBranch ? { resolvedBranch: input.resolvedBranch } : {}),
    ...(input.candidateBranches?.length ? { candidateBranches: [...input.candidateBranches] } : {}),
    ...(input.branchStatus ? { branchStatus: input.branchStatus } : {}),
    ...(input.headCommitStatus ? { headCommitStatus: input.headCommitStatus } : {}),
    ...(input.headCommitShaPreview ? { headCommitShaPreview: input.headCommitShaPreview } : {}),
  };
}

export function isRetryableGithubVerifyStateSyncFailure(
  reason: TaskCursorFailureReason | undefined,
): boolean {
  return reason === "github_verify_state_sync_failed";
}

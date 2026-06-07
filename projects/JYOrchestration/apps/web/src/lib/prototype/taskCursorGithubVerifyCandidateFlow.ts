import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { buildTaskCursorGithubBranchCandidates } from "@/lib/prototype/taskCursorGithubBranchCandidates";
import {
  buildTaskCursorGithubVerifyDiagnosticsPatch,
} from "@/lib/prototype/taskCursorGithubVerifyView";
import {
  verifyTaskCursorGithubResult,
  type TaskCursorGithubVerifyResult,
} from "@/lib/prototype/taskCursorGithubVerify";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import {
  patchTaskCursorExecution,
  TASK_CURSOR_FAILURE_MESSAGES,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { evaluateWorkBranchRepairForVerify } from "@/lib/prototype/codeTaskRunTargetCanonical";

function githubVerifyTimelineEntry(input: {
  readonly action: string;
  readonly projectId: string;
  readonly taskId: string;
  readonly codeTaskId?: string;
  readonly fields?: Readonly<Record<string, string | number | boolean | undefined | null>>;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: input.action,
    orchestrationTraceGroup: "task_cursor_execution",
    routingDecision: input.taskId,
    fields: {
      projectId: input.projectId,
      taskId: input.taskId,
      ...(input.codeTaskId ? { codeTaskId: input.codeTaskId } : {}),
      ...input.fields,
    },
    nowIso: input.nowIso,
  });
}

export async function runTaskCursorGithubVerifyCandidateFlow(input: {
  readonly projectId: string;
  readonly execution: TaskCursorExecutionV1;
  readonly targetRepository: ProjectTargetRepository;
  readonly githubToken: string;
  readonly allowedPathGlobs: readonly string[];
  readonly codeTaskId?: string | null;
  readonly branchPlanWorkBranch?: string | null;
  readonly runWorkBranch?: string | null;
  readonly promptWorkBranch?: string | null;
  readonly executionRunId?: string | null;
  readonly branchPlanBaseBranch?: string | null;
  readonly branchGroup?: string | null;
  readonly nowIso?: string;
}): Promise<
  Readonly<{
    readonly verify: TaskCursorGithubVerifyResult;
    readonly execution: TaskCursorExecutionV1;
    readonly timeline: readonly RequirementsPromptTimelineEntry[];
    readonly repaired: boolean;
    readonly resolvedBranch: string | null;
  }>
> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const codeTaskId = String(input.codeTaskId ?? "").trim() || null;
  const candidateBranches = buildTaskCursorGithubBranchCandidates({
    codeTaskId,
    branchPlanWorkBranch: input.branchPlanWorkBranch,
    executionWorkBranch: input.execution.workBranch,
    runWorkBranch: input.runWorkBranch,
    promptWorkBranch: input.promptWorkBranch,
  });

  const timeline: RequirementsPromptTimelineEntry[] = [
    githubVerifyTimelineEntry({
      action: "task_cursor_github_branch_candidates_built",
      projectId: input.projectId,
      taskId: input.execution.taskId,
      codeTaskId: codeTaskId ?? undefined,
      fields: { candidateBranches: candidateBranches.join(",") },
      nowIso,
    }),
  ];

  const primaryBranch = candidateBranches[0] ?? String(input.execution.workBranch ?? "").trim();

  let execution = patchTaskCursorExecution(input.execution, {
    githubProgressLastCheckAt: nowIso,
    githubVerifyDiagnosticsV1: buildTaskCursorGithubVerifyDiagnosticsPatch({
      verifyPhase: "branch_checking",
      primaryBranch,
      candidateBranches,
      branchStatus: "checking",
      headCommitStatus: "checking",
    }),
    nowIso,
  });

  const verify = await verifyTaskCursorGithubResult({
    execution,
    targetRepository: input.targetRepository,
    githubToken: input.githubToken,
    allowedPathGlobs: input.allowedPathGlobs,
    codeTaskId,
    branchPlanWorkBranch: input.branchPlanWorkBranch,
    branchCandidates: candidateBranches,
    runWorkBranch: input.runWorkBranch,
    promptWorkBranch: input.promptWorkBranch,
    onBranchLookupRetry: (event) => {
      timeline.push(
        githubVerifyTimelineEntry({
          action: "task_cursor_github_branch_lookup_retry",
          projectId: input.projectId,
          taskId: execution.taskId,
          codeTaskId: codeTaskId ?? undefined,
          fields: {
            branchName: event.branchName,
            attempt: event.attempt,
            ...(event.apiStatus !== undefined ? { apiStatus: event.apiStatus } : {}),
            reason: event.reason,
          },
          nowIso,
        }),
      );
    },
  });

  const resolvedBranch = String(verify.resolvedBranch ?? "").trim() || null;
  const wouldRepair =
    Boolean(resolvedBranch) && resolvedBranch !== String(input.execution.workBranch ?? "").trim();
  let repaired = false;

  if (resolvedBranch && verify.branchRefFound) {
    timeline.push(
      githubVerifyTimelineEntry({
        action: "task_cursor_github_branch_found",
        projectId: input.projectId,
        taskId: execution.taskId,
        codeTaskId: codeTaskId ?? undefined,
        fields: {
          workBranch: resolvedBranch,
          ...(verify.lookupSource ? { lookupSource: verify.lookupSource } : {}),
        },
        nowIso,
      }),
    );
  }

  if (!verify.ok && verify.allBranchesMissing) {
    timeline.push(
      githubVerifyTimelineEntry({
        action: "task_cursor_github_branch_missing_after_retries",
        projectId: input.projectId,
        taskId: execution.taskId,
        codeTaskId: codeTaskId ?? undefined,
        fields: {
          branchName: primaryBranch,
          candidateBranches: candidateBranches.join(","),
          attempts: verify.lookupAttempts ?? 0,
          ...(verify.branchLookupDiagnostics?.apiStatus !== undefined
            ? { lastApiStatus: verify.branchLookupDiagnostics.apiStatus }
            : {}),
          ...(verify.branchLookupDiagnostics?.apiErrorMessage
            ? { lastErrorMessage: String(verify.branchLookupDiagnostics.apiErrorMessage) }
            : {}),
        },
        nowIso,
      }),
    );
  }

  if (wouldRepair && resolvedBranch) {
    const fromBranch = String(input.execution.workBranch ?? "").trim();
    const repairEval = evaluateWorkBranchRepairForVerify({
      fromBranch,
      toBranch: resolvedBranch,
      branchPlanWorkBranch: input.branchPlanWorkBranch,
      branchPlanBaseBranch: input.branchPlanBaseBranch,
      branchGroup: input.branchGroup,
    });
    if (repairEval.allow) {
      repaired = true;
      execution = patchTaskCursorExecution(execution, {
        workBranch: resolvedBranch,
        nowIso,
      });
      timeline.push(
        githubVerifyTimelineEntry({
          action: "task_cursor_github_work_branch_repaired",
          projectId: input.projectId,
          taskId: execution.taskId,
          codeTaskId: codeTaskId ?? undefined,
          fields: { from: fromBranch, to: resolvedBranch },
          nowIso,
        }),
      );
    } else {
      timeline.push(
        githubVerifyTimelineEntry({
          action: "task_cursor_github_work_branch_repair_blocked",
          projectId: input.projectId,
          taskId: execution.taskId,
          codeTaskId: codeTaskId ?? undefined,
          fields: {
            from: fromBranch,
            to: resolvedBranch,
            reason: repairEval.reason ?? "cross_code_task_branch_repair_forbidden",
          },
          nowIso,
        }),
      );
    }
  }

  if (verify.verifiedCommitSha) {
    timeline.push(
      githubVerifyTimelineEntry({
        action: "task_cursor_github_head_commit_found",
        projectId: input.projectId,
        taskId: execution.taskId,
        codeTaskId: codeTaskId ?? undefined,
        fields: {
          commitSha: verify.verifiedCommitSha.slice(0, 12),
          ...(verify.headSha ? { headSha: verify.headSha.slice(0, 12) } : {}),
          ...(verify.baseHeadSha ? { baseHeadSha: verify.baseHeadSha.slice(0, 12) } : {}),
          ...(input.executionRunId ? { runId: input.executionRunId } : {}),
        },
        nowIso,
      }),
    );
  }

  execution = patchTaskCursorExecution(execution, {
    githubVerifyDiagnosticsV1: buildTaskCursorGithubVerifyDiagnosticsPatch({
      verifyPhase: verify.ok ? "run_state_syncing" : verify.branchRefFound ? "head_commit_checking" : "branch_checking",
      lastUiReason: verify.uiReason,
      primaryBranch,
      resolvedBranch: resolvedBranch ?? undefined,
      candidateBranches,
      branchStatus: verify.branchRefFound ? "exists" : verify.allBranchesMissing ? "missing" : "checking",
      headCommitStatus: verify.verifiedCommitSha ? "found" : verify.branchRefFound ? "missing" : "checking",
      headCommitShaPreview: verify.verifiedCommitSha?.slice(0, 12),
    }),
    nowIso,
  });

  return { verify, execution, timeline, repaired, resolvedBranch };
}

export async function applyGithubVerifyStateSyncGuard(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly execution: TaskCursorExecutionV1;
  readonly verify: TaskCursorGithubVerifyResult;
  readonly nowIso?: string;
}): Promise<
  Readonly<{
    readonly execution: TaskCursorExecutionV1;
    readonly timeline?: RequirementsPromptTimelineEntry;
    readonly stateSyncFailed: boolean;
  }>
> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  if (!input.verify.ok || !input.verify.verifiedCommitSha) {
    return { execution: input.execution, stateSyncFailed: false };
  }

  const execSha = String(input.execution.commitSha ?? input.verify.verifiedCommitSha ?? "").trim();
  if (!execSha) {
    return { execution: input.execution, stateSyncFailed: false };
  }

  const bundle = await getImplementationRuntimeBundle(input.projectId.trim());
  const run = bundle.runs.find((r) => r.codeTaskId === input.codeTaskId.trim());
  const dbSha = String(run?.commitSha ?? run?.branchHeadCommitSha ?? "").trim();
  if (dbSha) {
    const timeline = githubVerifyTimelineEntry({
      action: "task_cursor_github_run_state_synced",
      projectId: input.projectId,
      taskId: input.execution.taskId,
      codeTaskId: input.codeTaskId,
      fields: { commitSha: dbSha.slice(0, 12) },
      nowIso,
    });
    return { execution: input.execution, timeline, stateSyncFailed: false };
  }

  if (!run) {
    return { execution: input.execution, stateSyncFailed: false };
  }

  const execution = patchTaskCursorExecution(input.execution, {
    status: "github_verify_failed",
    failureReason: "github_verify_state_sync_failed",
    errorMessage: TASK_CURSOR_FAILURE_MESSAGES.github_verify_state_sync_failed,
    githubVerifyDiagnosticsV1: buildTaskCursorGithubVerifyDiagnosticsPatch({
      verifyPhase: "run_state_syncing",
      lastUiReason: "github_verify_state_sync_failed",
      headCommitStatus: "found",
      headCommitShaPreview: execSha.slice(0, 12),
      branchStatus: "exists",
      resolvedBranch: input.verify.resolvedBranch,
    }),
    nowIso,
  });

  const timeline = githubVerifyTimelineEntry({
    action: "task_cursor_github_verify_state_sync_failed",
    projectId: input.projectId,
    taskId: input.execution.taskId,
    codeTaskId: input.codeTaskId,
    fields: { commitSha: execSha.slice(0, 12), reason: "commit_found_but_run_update_failed" },
    nowIso,
  });

  return { execution, timeline, stateSyncFailed: true };
}

export function mapManualGithubVerifyApiStatus(input: {
  readonly verify: TaskCursorGithubVerifyResult;
  readonly execution: TaskCursorExecutionV1;
  readonly stateSyncFailed: boolean;
}):
  | "github_verified"
  | "github_branch_missing"
  | "github_head_commit_missing"
  | "github_verify_state_sync_failed" {
  if (input.stateSyncFailed || input.execution.failureReason === "github_verify_state_sync_failed") {
    return "github_verify_state_sync_failed";
  }
  if (input.verify.ok) return "github_verified";
  if (input.verify.uiReason === "github_branch_missing" || input.verify.allBranchesMissing) {
    return "github_branch_missing";
  }
  if (
    input.verify.uiReason === "github_head_commit_missing" ||
    (input.verify.branchRefFound && !input.verify.verifiedCommitSha)
  ) {
    return "github_head_commit_missing";
  }
  if (input.verify.detailReason === "branch_not_found") return "github_branch_missing";
  if (input.verify.detailReason === "commit_not_found") return "github_head_commit_missing";
  return "github_branch_missing";
}

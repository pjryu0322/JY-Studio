import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import {
  buildImplementationCodeTaskSummaryCounts,
  listVisibleImplementationCodeTaskIds,
  type ImplementationCodeTaskSummaryCountsV1,
} from "@/lib/prototype/implementationCodeTaskSummary";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import { summarizeCodeTaskExecutionQueueRuns } from "@/lib/prototype/codeTaskExecutionRunUi";
import {
  formatCodeTaskExecutionFlowPhaseKo,
  type CodeTaskExecutionFlowPhase,
} from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import {
  formatRuntimeStateKo,
  isRuntimeInFlight,
  type ImplementationRuntimeStateV1,
  type RuntimeState,
} from "@/lib/prototype/implementationRuntimeState";

export type ImplementationExecutionOverview = Readonly<{
  readonly processTaskCount: number;
  readonly codeTaskCount: number;
  readonly inProgressCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly currentTitle?: string;
  readonly isRunning: boolean;
  readonly needsAttention: boolean;
  readonly headerTitle: string;
  readonly runtimeState?: RuntimeState;
  readonly runtimeStateLabel?: string;
  readonly flowPhaseLabel?: string;
  readonly codeTaskSummary?: ImplementationCodeTaskSummaryCountsV1;
}>;

export type SelectedCodeTaskExecutionProgress = Readonly<{
  readonly done: number;
  readonly total: number;
}>;

export function resolveSelectedCodeTaskExecutionProgress(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly queue?: CodeTaskExecutionQueueV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
}): SelectedCodeTaskExecutionProgress | null {
  const total = input.selectedCodeTaskIds.length;
  if (!total) return null;
  const queue = input.queue;
  if (!queue || queue.status === "idle") return null;

  const summary = summarizeCodeTaskExecutionQueueRuns({
    runs: input.runs ?? [],
    selectedCodeTaskIds: input.selectedCodeTaskIds,
  });
  const terminalDone = summary.completed + summary.noCodeChange;

  if (queue.status === "running") {
    const position = Math.min(queue.currentIndex + 1, total);
    const done = Math.max(terminalDone, position);
    return { done: Math.min(done, total), total };
  }

  if (
    queue.status === "completed" ||
    queue.status === "completed_with_issues" ||
    queue.status === "failed" ||
    queue.status === "paused"
  ) {
    return { done: Math.min(terminalDone, total), total };
  }

  return null;
}

function formatOverviewRuntimeStateLabel(input: {
  readonly runtimeState: RuntimeState;
  readonly activeCodeTaskRun?: Pick<
    CodeTaskExecutionRunV1,
    "commitSha" | "branchHeadCommitSha" | "cursorRunId" | "workBranch"
  > | null;
}): string {
  const commit = String(
    input.activeCodeTaskRun?.commitSha ?? input.activeCodeTaskRun?.branchHeadCommitSha ?? "",
  ).trim();
  const cursorRunId = String(input.activeCodeTaskRun?.cursorRunId ?? "").trim();
  const workBranch = String(input.activeCodeTaskRun?.workBranch ?? "").trim();
  const githubPending = Boolean(commit || (cursorRunId && workBranch));
  if (githubPending) {
    if (
      input.runtimeState === "failed" ||
      input.runtimeState === "cursor_running" ||
      input.runtimeState === "dispatching"
    ) {
      return "GitHub commit 확인 중";
    }
  }
  if (
    input.runtimeState === "failed" &&
    String(input.activeCodeTaskRun?.cursorRunId ?? "").trim() &&
    !commit
  ) {
    return "Cursor 실행 중";
  }
  return formatRuntimeStateKo(input.runtimeState);
}

export function buildImplementationExecutionOverview(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly activeTaskId?: string | null;
  readonly activeCodeTaskTitle?: string | null;
  readonly runtime?: ImplementationRuntimeStateV1 | null;
  /** DB Runtime Engine (P2) — JSON보다 우선 */
  readonly dbRuntimeState?: RuntimeState | null;
  readonly activeCodeTaskRun?: Pick<
    CodeTaskExecutionRunV1,
    "commitSha" | "branchHeadCommitSha" | "cursorRunId" | "workBranch"
  > | null;
  readonly activeFlowPhase?: CodeTaskExecutionFlowPhase | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly codeTaskRuns?: readonly CodeTaskExecutionRunV1[] | null;
}): ImplementationExecutionOverview {
  const processTaskCount = input.board.taskRows.length;
  const codeTaskSummary = buildImplementationCodeTaskSummaryCounts({
    codeTaskPlan: input.codeTaskPlan,
    selectedCodeTaskIds: input.selectedCodeTaskIds,
    runs: input.codeTaskRuns,
  });
  const visibleTotal = codeTaskSummary.totalCodeTaskCount;
  const planTasksCount = listVisibleImplementationCodeTaskIds(input.codeTaskPlan).length;
  const codeTaskCount =
    visibleTotal > 0
      ? visibleTotal
      : planTasksCount > 0
        ? planTasksCount
        : input.codeTaskPlan?.tasks.length ?? processTaskCount;

  const inProgressCount = input.board.summary.inProgressTasks;
  const completedCount = input.board.summary.completedTasks;
  const failedCount =
    (input.board.summary.reworkRequiredTasks ?? 0) +
    input.board.taskRows.filter((row) => row.developerStatus === "failed").length;

  const activeRow = input.activeTaskId
    ? input.board.taskRows.find((row) => row.taskId === input.activeTaskId)
    : undefined;
  const currentTitle =
    input.activeCodeTaskTitle?.trim() ||
    activeRow?.title?.trim() ||
    undefined;
  const runtimeState = input.dbRuntimeState ?? input.runtime?.runtimeState;
  const runCommit = String(
    input.activeCodeTaskRun?.commitSha ?? input.activeCodeTaskRun?.branchHeadCommitSha ?? "",
  ).trim();
  const runtimeLooksStaleFailed =
    runtimeState === "failed" &&
    Boolean(
      runCommit ||
        String(input.activeCodeTaskRun?.cursorRunId ?? "").trim() ||
        String(input.activeCodeTaskRun?.workBranch ?? "").trim(),
    );

  const attentionPhases = new Set<CodeTaskExecutionFlowPhase>([
    "github_branch_missing",
    "github_verify_timeout",
    "dispatch_failed_retryable",
    "next_code_task_dispatch_failed",
  ]);
  const flowPhase = input.activeFlowPhase ?? null;
  const needsAttention = flowPhase != null && attentionPhases.has(flowPhase);
  const flowPhaseLabel = flowPhase ? formatCodeTaskExecutionFlowPhaseKo(flowPhase) : undefined;

  const isRunning =
    !needsAttention &&
    (isRuntimeInFlight(runtimeState) ||
      inProgressCount > 0 ||
      runtimeLooksStaleFailed ||
      flowPhase === "github_verifying" ||
      flowPhase === "cursor_running" ||
      flowPhase === "lightweight_checking" ||
      flowPhase === "next_code_task_dispatch_pending" ||
      flowPhase === "next_code_task_dispatch_connecting");

  const headerTitle = needsAttention
    ? "구현 확인 필요"
    : isRunning || flowPhase === "github_verifying" || flowPhase === "cursor_running"
      ? "구현 실행 중"
      : "구현 실행 대기";

  const runtimeStateLabel =
    flowPhaseLabel ??
    (runtimeState
      ? formatOverviewRuntimeStateLabel({
          runtimeState,
          activeCodeTaskRun: input.activeCodeTaskRun,
        })
      : undefined);

  return {
    processTaskCount,
    codeTaskCount,
    inProgressCount,
    completedCount,
    failedCount,
    ...(currentTitle ? { currentTitle } : {}),
    isRunning: isRunning || flowPhase === "github_verifying" || flowPhase === "cursor_running",
    needsAttention,
    headerTitle,
    ...(runtimeState
      ? {
          runtimeState,
          runtimeStateLabel,
        }
      : flowPhaseLabel
        ? { runtimeStateLabel: flowPhaseLabel }
        : {}),
    ...(flowPhaseLabel ? { flowPhaseLabel } : {}),
    codeTaskSummary,
  };
}

export function formatImplementationExecutionOverviewLines(
  overview: ImplementationExecutionOverview,
  input?: {
    readonly selectedCodeTaskCount?: number;
    readonly selectedExecutionProgress?: SelectedCodeTaskExecutionProgress | null;
    readonly selectedCompletedCount?: number;
    readonly queueRunning?: boolean;
  },
): readonly string[] {
  const summary = overview.codeTaskSummary;
  const totalForDisplay = summary?.totalCodeTaskCount ?? overview.codeTaskCount;
  const selectedTotal = summary?.selectedCodeTaskCount ?? input?.selectedCodeTaskCount ?? 0;
  const completedTotal = summary?.completedCodeTaskCount ?? input?.selectedCompletedCount ?? 0;

  const lines: string[] = [`전체 CodeTask: ${totalForDisplay}개`];

  if (typeof input?.selectedCodeTaskCount === "number" || summary) {
    lines.push(`선택 CodeTask: ${selectedTotal || input?.selectedCodeTaskCount || 0}개`);
  }

  const progress = input?.selectedExecutionProgress;

  const showSelectedProgress =
    (progress && progress.total > 0 && (input?.queueRunning || overview.isRunning)) ||
    (summary && selectedTotal > 0);

  if (showSelectedProgress && summary) {
    const seqTotal = Math.min(selectedTotal || totalForDisplay, totalForDisplay);
    const sequenceIndex = progress
      ? Math.min(progress.done, progress.total)
      : Math.min(completedTotal, seqTotal);
    lines.push(`선택 실행 순서: ${sequenceIndex} / ${seqTotal}`);
    lines.push(`완료 CodeTask: ${Math.min(completedTotal, totalForDisplay)} / ${totalForDisplay}`);
  } else if (summary && totalForDisplay > 0 && selectedTotal > 0) {
    lines.push(`완료 CodeTask: ${Math.min(completedTotal, totalForDisplay)} / ${totalForDisplay}`);
  }

  if (overview.currentTitle) {
    lines.push(`현재 CodeTask: ${overview.currentTitle}`);
  }

  if (overview.flowPhaseLabel || overview.runtimeStateLabel) {
    lines.push(`상태: ${overview.flowPhaseLabel ?? overview.runtimeStateLabel}`);
  } else if (overview.isRunning && overview.runtimeStateLabel) {
    lines.push(`상태: ${overview.runtimeStateLabel}`);
  } else if (overview.runtimeState === "failed" && overview.runtimeStateLabel) {
    lines.push(`상태: ${overview.runtimeStateLabel}`);
  } else if (
    typeof input?.selectedCodeTaskCount === "number" &&
    input.selectedCodeTaskCount > 0 &&
    !showSelectedProgress
  ) {
    lines.push("상태: 선택한 CodeTask 실행 대기");
  } else if (!overview.isRunning) {
    lines.push("상태: 대기");
  }

  if (overview.failedCount > 0) {
    lines.push(`실패: ${overview.failedCount}`);
  }

  return lines;
}

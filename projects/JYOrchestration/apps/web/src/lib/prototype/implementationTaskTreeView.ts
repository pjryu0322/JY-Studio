import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  checkCodeTaskDependencyReady,
  formatCodeTaskDependencyTreeHint,
} from "@/lib/prototype/codeTaskDependencyResolver";
import {
  findLatestRunForCodeTask,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { isInFlightCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";
import { formatCodeTaskExecutionRunStatusKo } from "@/lib/prototype/codeTaskExecutionRunUi";
import {
  buildCodeTaskExecutionFlowSteps,
  deriveCodeTaskExecutionFlowPhase,
  formatCodeTaskExecutionFlowPhaseKo,
  formatCodeTaskExecutionProgressLine,
  type CodeTaskExecutionFlowStepVm,
} from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import type {
  ImplementationBoardStepStatus,
  ImplementationExecutionBoardTaskRowV1,
  ImplementationExecutionBoardV1,
} from "@/lib/prototype/implementationExecutionBoard";
import { isPerTaskPipelineComplete } from "@/lib/prototype/implementationTaskPipelinePolicy";
import { evaluateCodeTaskReviewSecurityPolicy } from "@/lib/prototype/implementationReviewSecurityPolicy";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { resolveTaskRowUserRestartCapability } from "@/lib/prototype/implementationExecutionBoard";
import {
  computeTaskTreeDependencyViews,
  formatTaskTreeDependencyLabel,
  normalizeSelectedTaskIds,
  orderTaskRowsForTreeDisplay,
} from "@/lib/prototype/implementationTaskTreeSelection";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

export type ImplementationTaskTreeMetaLine = Readonly<{
  readonly label: string;
  readonly value: string;
}>;

export type ImplementationCodeTaskTreeNode = Readonly<{
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly title: string;
  readonly metaLines: readonly ImplementationTaskTreeMetaLine[];
  readonly collapsedSummary: string;
  readonly executionFlowSteps: readonly CodeTaskExecutionFlowStepVm[];
  readonly isActive: boolean;
  readonly isSelected: boolean;
  readonly failureReason?: string;
  readonly nextActionHint?: string;
}>;

export type ImplementationProcessTaskTreeNode = Readonly<{
  readonly taskId: string;
  readonly title: string;
  readonly metaLines: readonly ImplementationTaskTreeMetaLine[];
  readonly collapsedSummary: string;
  readonly isActive: boolean;
  readonly isSelected: boolean;
  readonly isChecked: boolean;
  readonly treeDepth: number;
  readonly dependencyLabel?: string;
  readonly defaultExpanded: boolean;
  readonly codeTasks: readonly ImplementationCodeTaskTreeNode[];
  readonly canRestart: boolean;
  readonly canStop?: boolean;
  readonly canResumeStatusCheck?: boolean;
  readonly pollStatusLabel?: string;
  readonly restartBlockedReason?: string;
  readonly needsReworkRegistration: boolean;
}>;

/** @deprecated flat step — kept for legacy tests; prefer codeTasks + executionFlowSteps */
export type ImplementationTaskTreeChildStep = Readonly<{
  readonly roleLabel: string;
  readonly statusLabel: string;
}>;

/** @deprecated use ImplementationProcessTaskTreeNode */
export type ImplementationTaskTreeNode = ImplementationProcessTaskTreeNode;

export function stripLeadingTaskIdFromTitle(taskId: string, title: string): string {
  const id = taskId.trim();
  const t = title.trim();
  if (!id || !t) return t || id;
  if (t.startsWith(`${id} `)) return t.slice(id.length + 1).trim();
  if (t.startsWith(id)) return t.replace(new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\-–—:]+`), "").trim();
  return t;
}

function formatMetaLine(label: string, value: string): ImplementationTaskTreeMetaLine {
  return { label, value };
}

function formatBoardStepStatusKo(status: ImplementationBoardStepStatus): string {
  switch (status) {
    case "not_started":
      return "대기";
    case "ready":
      return "준비";
    case "queued":
      return "대기열";
    case "in_progress":
      return "진행";
    case "done":
      return "완료";
    case "failed":
      return "실패";
    case "skipped":
      return "생략";
    default:
      return status;
  }
}

function resolveProcessProgressLabel(row: ImplementationExecutionBoardTaskRowV1): string {
  if (row.failureReason === "blocked_by_dependency") return "선행 작업 대기";
  if (row.developerStatus === "in_progress") return "진행 중";
  if (row.developerStatus === "done" && isPerTaskPipelineComplete(row)) return "실행 가능";
  if (row.developerStatus === "done") return "개발 완료";
  if (row.developerStatus === "failed") return "재작업 필요";
  if (row.developerStatus === "ready" || row.developerStatus === "queued") return "실행 가능";
  return "Quick 실행 대기";
}

function resolveProcessStatusLabel(row: ImplementationExecutionBoardTaskRowV1): string {
  if (row.failureReason === "blocked_by_dependency") return "차단";
  if (row.developerStatus === "failed") return "실패";
  if (isPerTaskPipelineComplete(row)) return "완료";
  if (row.developerStatus === "in_progress") return "실행 중";
  return formatBoardStepStatusKo(row.developerStatus);
}

function buildProcessMetaLines(row: ImplementationExecutionBoardTaskRowV1): readonly ImplementationTaskTreeMetaLine[] {
  return [
    formatMetaLine("상태", resolveProcessStatusLabel(row)),
    formatMetaLine("진행", resolveProcessProgressLabel(row)),
    formatMetaLine("역할", "AI 개발자"),
    formatMetaLine("ID", row.taskId),
  ];
}

function buildCodeTaskNode(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly row: ImplementationExecutionBoardTaskRowV1;
  readonly workItem?: CursorWorkItem | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly codeTaskExecutionRuns?: readonly CodeTaskExecutionRunV1[] | null;
  readonly isActive: boolean;
  readonly isSelected: boolean;
}): ImplementationCodeTaskTreeNode {
  const policy = evaluateCodeTaskReviewSecurityPolicy({
    codeTask: input.codeTask,
    workItem: input.workItem ?? null,
  });
  const latestRun = findLatestRunForCodeTask(
    input.codeTaskExecutionRuns,
    input.codeTask.codeTaskId,
  );
  const dependencyCheck = input.codeTaskPlan
    ? checkCodeTaskDependencyReady({
        codeTaskId: input.codeTask.codeTaskId,
        codeTaskPlan: input.codeTaskPlan,
        runs: input.codeTaskExecutionRuns ?? [],
      })
    : null;
  const dependencyBlocked =
    latestRun?.status === "blocked_by_dependency" ||
    (dependencyCheck &&
      dependencyCheck.status !== "ready" &&
      (!latestRun || !isInFlightCodeTaskExecutionRunStatus(latestRun.status)));
  let phase = deriveCodeTaskExecutionFlowPhase({
    parentTaskId: input.row.taskId,
    taskCursorExecution: input.taskCursorExecution,
    autoGate: input.autoGate,
    developerStatus: input.row.developerStatus,
    failureReason: dependencyBlocked
      ? "blocked_by_dependency"
      : latestRun?.status === "rework_required" ||
          latestRun?.status === "failed" ||
          latestRun?.status === "status_check_stopped"
        ? latestRun.failureReason ?? "commit_not_created"
        : input.row.failureReason,
  });
  if (latestRun?.status === "completed" || latestRun?.status === "no_code_change_completed") {
    phase = "completed";
  } else if (latestRun && isInFlightCodeTaskExecutionRunStatus(latestRun.status)) {
    phase =
      latestRun.status === "github_verifying"
        ? "github_verifying"
        : latestRun.status === "cursor_running" || latestRun.status === "cursor_requested"
          ? "cursor_running"
          : "prompt_ready";
  } else if (dependencyBlocked) {
    phase = "blocked_by_dependency";
  }
  const executionFlowSteps = buildCodeTaskExecutionFlowSteps({ phase, policy });
  const title = stripLeadingTaskIdFromTitle(input.codeTask.codeTaskId, input.codeTask.title);

  let collapsedSummary = formatCodeTaskExecutionFlowPhaseKo(phase);
  if (phase === "prompt_ready") collapsedSummary = "대기";
  if (phase === "completed") collapsedSummary = "완료";
  if (phase === "failed") collapsedSummary = "재작업 필요";
  if (phase === "blocked_by_dependency") collapsedSummary = "선행 작업 필요";

  const dependencyHint = dependencyCheck
    ? formatCodeTaskDependencyTreeHint(dependencyCheck)
    : undefined;
  const statusLabel =
    latestRun && !dependencyBlocked
      ? formatCodeTaskExecutionRunStatusKo(latestRun.status)
      : formatCodeTaskExecutionFlowPhaseKo(phase);
  const progressLabel =
    phase === "blocked_by_dependency"
      ? dependencyHint ?? "선행 작업 필요"
      : latestRun && isInFlightCodeTaskExecutionRunStatus(latestRun.status)
        ? formatCodeTaskExecutionRunStatusKo(latestRun.status)
        : phase === "prompt_ready"
          ? "Quick 실행 대기"
          : formatCodeTaskExecutionProgressLine(phase);

  const metaLines: ImplementationTaskTreeMetaLine[] = [
    formatMetaLine("상태", statusLabel),
    formatMetaLine("진행", progressLabel),
    formatMetaLine("역할", "AI 개발자"),
    formatMetaLine("ID", input.codeTask.codeTaskId),
  ];

  const failureReason =
    phase === "failed"
      ? latestRun?.failureReason ??
        input.taskCursorExecution?.failureReason ??
        "commit_not_created"
      : undefined;

  return {
    codeTaskId: input.codeTask.codeTaskId,
    parentTaskId: input.codeTask.parentTaskId,
    title,
    metaLines,
    collapsedSummary,
    executionFlowSteps,
    isActive: input.isActive,
    isSelected: input.isSelected,
    ...(failureReason ? { failureReason } : {}),
    ...(phase === "failed"
      ? { nextActionHint: "다음 처리: Cursor 재실행 대기" }
      : phase === "blocked_by_dependency"
        ? { nextActionHint: dependencyHint ?? "선행 CodeTask 완료 후 실행 가능" }
        : {
            nextActionHint:
              "다음 처리: AI 개발자 실행 → GitHub commit 확인 → 경량검사 → 필요 시 검수/보안",
          }),
  };
}

function groupCodeTasksByParent(
  plan: ImplementationCodeTaskPlanV1 | null | undefined,
): ReadonlyMap<string, readonly ImplementationCodeTaskV1[]> {
  const map = new Map<string, ImplementationCodeTaskV1[]>();
  for (const task of plan?.tasks ?? []) {
    const parentId = task.parentTaskId.trim();
    if (!parentId) continue;
    const list = map.get(parentId) ?? [];
    list.push(task);
    map.set(parentId, list);
  }
  return map;
}

function findWorkItemForCodeTask(
  workItems: readonly CursorWorkItem[] | undefined,
  codeTaskId: string,
): CursorWorkItem | null {
  if (!workItems?.length) return null;
  return (
    workItems.find((wi) => wi.codeTaskId === codeTaskId || wi.taskId === codeTaskId) ?? null
  );
}

export function buildImplementationProcessTaskTreeNodes(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly codeTaskExecutionRuns?: readonly CodeTaskExecutionRunV1[] | null;
  readonly activeTaskId?: string | null;
  readonly selectedTaskId?: string | null;
  readonly selectedCodeTaskId?: string | null;
  readonly checkedTaskIds?: readonly string[] | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly implementationAutoQualityGateV1?: ImplementationAutoQualityGateV1 | null;
}): readonly ImplementationProcessTaskTreeNode[] {
  const activeTaskId = input.activeTaskId?.trim() || null;
  const selectedTaskId = input.selectedTaskId?.trim() || activeTaskId;
  const selectedCodeTaskId = input.selectedCodeTaskId?.trim() || null;
  const taskCursorExecution = input.taskCursorExecution ?? null;
  const codeTasksByParent = groupCodeTasksByParent(input.codeTaskPlan);
  const orderedRows = orderTaskRowsForTreeDisplay(input.board.taskRows);
  const dependencyViews = computeTaskTreeDependencyViews(input.board.taskRows);
  const checkedTaskIds = new Set(
    normalizeSelectedTaskIds({
      selectedTaskIds: input.checkedTaskIds,
      taskRows: input.board.taskRows,
    }),
  );

  return orderedRows.map((row) => {
    const dependencyView = dependencyViews.get(row.taskId);
    const isActive = activeTaskId === row.taskId;
    const isSelected = selectedTaskId === row.taskId;
    const isChecked = checkedTaskIds.has(row.taskId);
    const restart = resolveTaskRowUserRestartCapability({
      row,
      board: input.board,
      taskCursorExecution,
    });
    const codeTasksForParent = codeTasksByParent.get(row.taskId) ?? [];
    const codeTasks: ImplementationCodeTaskTreeNode[] = codeTasksForParent.map((codeTask) =>
      buildCodeTaskNode({
        codeTask,
        row,
        workItem: findWorkItemForCodeTask(input.cursorWorkItems ?? undefined, codeTask.codeTaskId),
        taskCursorExecution,
        autoGate: input.implementationAutoQualityGateV1,
        codeTaskPlan: input.codeTaskPlan,
        codeTaskExecutionRuns: input.codeTaskExecutionRuns,
        isActive: isActive && (selectedCodeTaskId === codeTask.codeTaskId || (!selectedCodeTaskId && codeTasksForParent[0]?.codeTaskId === codeTask.codeTaskId)),
        isSelected: selectedCodeTaskId === codeTask.codeTaskId,
      }),
    );

    const collapsedSummary = isPerTaskPipelineComplete(row)
      ? "완료"
      : row.developerStatus === "done"
        ? "개발 완료"
        : row.developerStatus === "in_progress" || isActive
          ? "Cursor 실행 중"
          : row.developerStatus === "failed"
            ? "재작업 필요"
            : row.failureReason === "blocked_by_dependency"
              ? "의존 차단"
              : "개발 대기";

    return {
      taskId: row.taskId,
      title: stripLeadingTaskIdFromTitle(row.taskId, row.title),
      metaLines: buildProcessMetaLines(row),
      collapsedSummary,
      isActive,
      isSelected,
      isChecked,
      treeDepth: dependencyView?.depth ?? 0,
      ...(formatTaskTreeDependencyLabel(dependencyView)
        ? { dependencyLabel: formatTaskTreeDependencyLabel(dependencyView) }
        : {}),
      defaultExpanded: isActive || isSelected || codeTasks.some((ct) => ct.isSelected),
      codeTasks,
      canRestart: restart.canRestart,
      ...(restart.blockedReason ? { restartBlockedReason: restart.blockedReason } : {}),
      needsReworkRegistration: restart.needsReworkRegistration,
    };
  });
}

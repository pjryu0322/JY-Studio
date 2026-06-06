import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  findLatestRunForCodeTask,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import {
  buildCodeTaskRowView,
  summarizeCodeTaskRowViewsForProcess,
} from "@/lib/prototype/codeTaskExecutionRunView";
import { formatCodeTaskExecutionRunStatusKo } from "@/lib/prototype/codeTaskExecutionRunUi";
import {
  isProcessTaskCodeTasksFullySelected,
  normalizeSelectedCodeTaskIds,
} from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import { PROMPT_PREFLIGHT_USER_BLOCK_MESSAGE } from "@/lib/prototype/codeTaskPromptPreflightFailure";
import { normalizeCodeTaskDisplayLabel } from "@/lib/prototype/codeTaskDisplayNameNormalize";
import {
  buildCodeTaskExecutionFlowSteps,
  deriveCodeTaskExecutionFlowPhase,
  enrichCodeTaskRunForFlowPhase,
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
import {
  computeTaskTreeDependencyViews,
  orderTaskRowsForTreeDisplay,
} from "@/lib/prototype/implementationTaskTreeSelection";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { resolveTaskCursorExecutionForRow } from "@/lib/prototype/codeAgentExecutionProgressView";
import { buildTaskCursorGithubVerifyDiagnosticsView } from "@/lib/prototype/taskCursorGithubVerifyView";
import type { ImplementationRuntimeRunView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

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
  readonly isChecked: boolean;
  readonly failureReason?: string;
  readonly nextActionHint?: string;
  readonly pollStatusLabel?: string;
  readonly githubVerifyTechnicalLines?: readonly ImplementationTaskTreeMetaLine[];
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
  readonly defaultExpanded: boolean;
  readonly codeTasks: readonly ImplementationCodeTaskTreeNode[];
  /** @deprecated Process Task는 직접 실행하지 않음 — CodeTask 버튼 사용 */
  readonly canRestart: boolean;
  readonly canStop?: boolean;
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
  if (row.developerStatus === "in_progress") return "진행 중";
  if (row.developerStatus === "done" && isPerTaskPipelineComplete(row)) return "실행 가능";
  if (row.developerStatus === "done") return "개발 완료";
  if (row.developerStatus === "failed") return "재작업 필요";
  if (row.developerStatus === "ready" || row.developerStatus === "queued") return "실행 가능";
  return "Quick 실행 대기";
}

function resolveProcessStatusLabel(row: ImplementationExecutionBoardTaskRowV1): string {
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
  readonly taskCursorExecutionHistory?: readonly TaskCursorExecutionV1[] | null;
  readonly dbRuntimeRuns?: readonly ImplementationRuntimeRunView[] | null;
  readonly dbCurrentRun?: ImplementationRuntimeRunView | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly codeTaskExecutionRuns?: readonly CodeTaskExecutionRunV1[] | null;
  readonly isActive: boolean;
  readonly isSelected: boolean;
  readonly isChecked: boolean;
  /** DB Quick Run Job 순서 — 이 목록에 있으면 plan 그래프 선행 검사로 UI/phase를 막지 않는다. */
  readonly sequentialQuickRunCodeTaskIds?: readonly string[] | null;
  readonly promptTimeline?: readonly import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry[] | null;
}): ImplementationCodeTaskTreeNode {
  const policy = evaluateCodeTaskReviewSecurityPolicy({
    codeTask: input.codeTask,
    workItem: input.workItem ?? null,
  });
  const executionForParent = resolveTaskCursorExecutionForRow({
    taskId: input.row.taskId,
    taskCursorExecutionV1: input.taskCursorExecution,
    taskCursorExecutionHistoryV1: input.taskCursorExecutionHistory,
  });
  const dbRun =
    input.dbCurrentRun?.codeTaskId === input.codeTask.codeTaskId
      ? input.dbCurrentRun
      : (input.dbRuntimeRuns?.find((run) => run.codeTaskId === input.codeTask.codeTaskId) ?? null);
  const latestRun = enrichCodeTaskRunForFlowPhase({
    run: findLatestRunForCodeTask(input.codeTaskExecutionRuns, input.codeTask.codeTaskId),
    execution: executionForParent,
    dbRun,
  });
  const autoGateForCodeTask =
    input.autoGate?.taskId === input.codeTask.parentTaskId ? input.autoGate : null;
  let phase = deriveCodeTaskExecutionFlowPhase({
    parentTaskId: input.codeTask.parentTaskId,
    taskCursorExecution: executionForParent,
    autoGate: autoGateForCodeTask,
    promptTimeline: input.promptTimeline,
    latestRun,
    failureReason:
      latestRun?.status === "rework_required" ||
      latestRun?.status === "failed" ||
      latestRun?.status === "status_check_stopped"
        ? latestRun.failureReason ?? "commit_not_created"
        : latestRun?.failureReason === "prompt_preflight_failed"
          ? "prompt_preflight_failed"
          : undefined,
  });
  const executionFlowSteps = buildCodeTaskExecutionFlowSteps({ phase, policy });
  const title = normalizeCodeTaskDisplayLabel(
    stripLeadingTaskIdFromTitle(input.codeTask.codeTaskId, input.codeTask.title),
  );
  const rowView = buildCodeTaskRowView({
    codeTask: input.codeTask,
    runs: input.codeTaskExecutionRuns,
    codeTaskPlan: input.codeTaskPlan,
  });

  let collapsedSummary = rowView.collapsedSummary || formatCodeTaskExecutionFlowPhaseKo(phase);
  if (phase === "prompt_ready") collapsedSummary = "대기";
  if (phase === "completed") collapsedSummary = "완료";
  if (phase === "failed") collapsedSummary = "재작업 필요";
  if (phase === "prompt_preflight_failed") collapsedSummary = "프롬프트 품질 검사 실패";

  const statusLabel = rowView.statusLabel;
  let progressLabel = rowView.progressLabel;

  const githubVerifyView =
    phase === "github_verifying" ||
    executionForParent?.status === "github_verifying" ||
    executionForParent?.failureReason === "github_verify_state_sync_failed"
      ? buildTaskCursorGithubVerifyDiagnosticsView({
          codeTaskId: input.codeTask.codeTaskId,
          execution: executionForParent,
          run: latestRun,
        })
      : null;
  if (githubVerifyView) {
    progressLabel = githubVerifyView.progressLabel;
  }

  const metaLines: ImplementationTaskTreeMetaLine[] = [
    formatMetaLine("상태", statusLabel),
    formatMetaLine("진행", progressLabel),
    formatMetaLine("역할", "AI 개발자"),
    formatMetaLine("ID", input.codeTask.codeTaskId),
  ];

  const failureReason =
    phase === "prompt_preflight_failed"
      ? PROMPT_PREFLIGHT_USER_BLOCK_MESSAGE
      : phase === "failed"
        ? latestRun?.failureReason ??
          executionForParent?.failureReason ??
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
    isChecked: input.isChecked,
    ...(githubVerifyView?.technicalLines.length
      ? {
          githubVerifyTechnicalLines: githubVerifyView.technicalLines.map((line) =>
            formatMetaLine(line.label, line.value),
          ),
        }
      : {}),
    ...(failureReason ? { failureReason } : {}),
    ...(githubVerifyView?.stateSyncFailed
      ? {
          failureReason:
            "GitHub commit은 확인했지만 플랫폼 실행 상태 반영에 실패했습니다. 상태 재확인을 다시 시도해 주세요.",
        }
      : {}),
    ...(phase === "prompt_preflight_failed"
      ? {
          nextActionHint:
            "프롬프트를 수정하거나 개발 프롬프트를 다시 생성한 뒤 실행해 주세요.",
        }
      : phase === "failed"
      ? { nextActionHint: "다음 처리: Cursor 재실행 대기" }
      : {
            nextActionHint:
              "다음 처리: AI 개발자 실행 → GitHub 결과 확인",
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

/** CodeTask만 동일 레벨 평면 목록 (Process Task 그룹/접기 없음). */
export function buildImplementationFlatCodeTaskTreeNodes(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly codeTaskExecutionRuns?: readonly CodeTaskExecutionRunV1[] | null;
  readonly activeCodeTaskId?: string | null;
  readonly selectedCodeTaskId?: string | null;
  readonly checkedCodeTaskIds?: readonly string[] | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistory?: readonly TaskCursorExecutionV1[] | null;
  readonly dbRuntimeRuns?: readonly ImplementationRuntimeRunView[] | null;
  readonly dbCurrentRun?: ImplementationRuntimeRunView | null;
  readonly implementationAutoQualityGateV1?: ImplementationAutoQualityGateV1 | null;
  readonly sequentialQuickRunCodeTaskIds?: readonly string[] | null;
  readonly promptTimeline?: readonly import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry[] | null;
}): readonly ImplementationCodeTaskTreeNode[] {
  const plan = input.codeTaskPlan;
  if (!plan?.tasks.length) return [];

  const rowByParentId = new Map(
    input.board.taskRows.map((row) => [row.taskId.trim(), row] as const),
  );
  const checkedCodeTaskIds = new Set(
    normalizeSelectedCodeTaskIds({
      selectedCodeTaskIds: input.checkedCodeTaskIds,
      codeTaskPlan: plan,
    }),
  );
  const activeCodeTaskId = input.activeCodeTaskId?.trim() || null;
  const selectedCodeTaskId = input.selectedCodeTaskId?.trim() || null;
  const taskCursorExecution = input.taskCursorExecution ?? null;

  const nodes: ImplementationCodeTaskTreeNode[] = [];
  for (const codeTask of plan.tasks) {
    const parentTaskId = codeTask.parentTaskId.trim();
    const row = rowByParentId.get(parentTaskId);
    if (!row) continue;

    const isSelected = selectedCodeTaskId === codeTask.codeTaskId;
    const isActive = activeCodeTaskId === codeTask.codeTaskId;

    nodes.push(
      buildCodeTaskNode({
        codeTask,
        row,
        workItem: findWorkItemForCodeTask(input.cursorWorkItems ?? undefined, codeTask.codeTaskId),
        taskCursorExecution,
        taskCursorExecutionHistory: input.taskCursorExecutionHistory,
        dbRuntimeRuns: input.dbRuntimeRuns,
        dbCurrentRun: input.dbCurrentRun,
        autoGate: input.implementationAutoQualityGateV1,
        codeTaskPlan: plan,
        codeTaskExecutionRuns: input.codeTaskExecutionRuns,
        isActive,
        isSelected,
        isChecked: checkedCodeTaskIds.has(codeTask.codeTaskId),
        sequentialQuickRunCodeTaskIds: input.sequentialQuickRunCodeTaskIds,
        promptTimeline: input.promptTimeline,
      }),
    );
  }
  return nodes;
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
  readonly checkedCodeTaskIds?: readonly string[] | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistory?: readonly TaskCursorExecutionV1[] | null;
  readonly dbRuntimeRuns?: readonly ImplementationRuntimeRunView[] | null;
  readonly dbCurrentRun?: ImplementationRuntimeRunView | null;
  readonly implementationAutoQualityGateV1?: ImplementationAutoQualityGateV1 | null;
}): readonly ImplementationProcessTaskTreeNode[] {
  const activeTaskId = input.activeTaskId?.trim() || null;
  const selectedTaskId = input.selectedTaskId?.trim() || activeTaskId;
  const selectedCodeTaskId = input.selectedCodeTaskId?.trim() || null;
  const taskCursorExecution = input.taskCursorExecution ?? null;
  const codeTasksByParent = groupCodeTasksByParent(input.codeTaskPlan);
  const orderedRows = orderTaskRowsForTreeDisplay(input.board.taskRows);
  const dependencyViews = computeTaskTreeDependencyViews(input.board.taskRows);
  const checkedCodeTaskIds = new Set(
    normalizeSelectedCodeTaskIds({
      selectedCodeTaskIds: input.checkedCodeTaskIds ?? input.checkedTaskIds,
      codeTaskPlan: input.codeTaskPlan,
    }),
  );

  return orderedRows.map((row) => {
    const dependencyView = dependencyViews.get(row.taskId);
    const isActive = activeTaskId === row.taskId;
    const isSelected = selectedTaskId === row.taskId;
    const codeTasksForParent = codeTasksByParent.get(row.taskId) ?? [];
    const codeTaskRowViews = codeTasksForParent.map((codeTask) =>
      buildCodeTaskRowView({
        codeTask,
        runs: input.codeTaskExecutionRuns,
        codeTaskPlan: input.codeTaskPlan,
      }),
    );
    const isChecked =
      codeTasksForParent.length > 0
        ? isProcessTaskCodeTasksFullySelected({
            parentTaskId: row.taskId,
            selectedCodeTaskIds: [...checkedCodeTaskIds],
            codeTaskPlan: input.codeTaskPlan,
          })
        : false;
    const codeTasks: ImplementationCodeTaskTreeNode[] = codeTasksForParent.map((codeTask) =>
      buildCodeTaskNode({
        codeTask,
        row,
        workItem: findWorkItemForCodeTask(input.cursorWorkItems ?? undefined, codeTask.codeTaskId),
        taskCursorExecution,
        taskCursorExecutionHistory: input.taskCursorExecutionHistory,
        dbRuntimeRuns: input.dbRuntimeRuns,
        dbCurrentRun: input.dbCurrentRun,
        autoGate: input.implementationAutoQualityGateV1,
        codeTaskPlan: input.codeTaskPlan,
        codeTaskExecutionRuns: input.codeTaskExecutionRuns,
        isActive: isActive && (selectedCodeTaskId === codeTask.codeTaskId || (!selectedCodeTaskId && codeTasksForParent[0]?.codeTaskId === codeTask.codeTaskId)),
        isSelected: selectedCodeTaskId === codeTask.codeTaskId,
        isChecked: checkedCodeTaskIds.has(codeTask.codeTaskId),
      }),
    );

    const collapsedSummary =
      codeTaskRowViews.length > 0
        ? summarizeCodeTaskRowViewsForProcess(codeTaskRowViews)
        : isPerTaskPipelineComplete(row)
          ? "완료"
          : row.developerStatus === "done"
            ? "개발 완료"
            : row.developerStatus === "in_progress" || isActive
              ? "Cursor 실행 중"
              : row.developerStatus === "failed"
                ? "재작업 필요"
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
      defaultExpanded: isActive || isSelected || codeTasks.some((ct) => ct.isSelected),
      codeTasks,
      canRestart: false,
      needsReworkRegistration: false,
    };
  });
}

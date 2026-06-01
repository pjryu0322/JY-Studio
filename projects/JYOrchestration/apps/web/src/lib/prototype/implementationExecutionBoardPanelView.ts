import { isPerTaskPipelineComplete } from "@/lib/prototype/implementationTaskPipelinePolicy";
import {
  evaluateCursorExecutionAvailability,
  type CursorExecutionAvailability,
  type CursorExecutionAvailabilityStatus,
} from "@/lib/prototype/cursorExecutionAvailability";
import {
  buildImplementationBoardEnvDetailLines,
  evaluateTaskCursorExecutionSetupReadiness,
  formatTaskCursorSetupReadinessPillValue,
  type TaskCursorSetupReadiness,
} from "@/lib/prototype/implementationBoardEnvDetailView";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import {
  explainExecutableTaskSelection,
  pickFirstExecutableDeveloperTaskId,
  resolveTaskRowUserRestartCapability,
  type ImplementationBoardStepStatus,
  type ImplementationExecutionBoardIntegratedRowV1,
  type ImplementationExecutionBoardTaskRowV1,
  type ImplementationExecutionBoardV1,
  type ImplementationUserConfirmationStatus,
} from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationCodeTaskFeedbackSummaryV1 } from "@/lib/prototype/implementationCodeTaskFeedbackUi";
import { formatCodeTaskFeedbackBoardLine } from "@/lib/prototype/implementationCodeTaskFeedbackUi";
import type { ImplementationCodeTaskReworkVmV1 } from "@/lib/prototype/implementationCodeTaskReworkVm";
import { formatCodeTaskReworkBoardSummaryLine } from "@/lib/prototype/implementationCodeTaskReworkVm";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  deriveImplementationUserTestReadiness,
  type ImplementationUserTestReadiness,
} from "@/lib/prototype/implementationUserTestReadiness";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ImplementationStageNextAction } from "@/lib/prototype/implementationStageNextActions";
import { parseExecutionLogResponseFields } from "@/lib/prototype/promptTimelineExecutionLogTabs";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
import { isServerTaskCursorPolling } from "@/lib/prototype/taskCursorPollingMode";
import { evaluateTaskCursorJobObservability } from "@/lib/prototype/taskCursorJobObservability";
import {
  buildTaskCursorExecutionJobSummaryVm,
  formatTaskCursorExecutionJobBoardLabel,
} from "@/lib/prototype/taskCursorExecutionJobUi";
import {
  formatTaskCursorElapsedMinutes,
  isActiveTaskCursorExecution,
  isTaskCursorCloudAgentPollingCancellable,
} from "@/lib/prototype/taskCursorClientPollLoop";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import {
  computeTaskTreeDependencyViews,
  formatTaskTreeDependencyLabel,
  normalizeSelectedTaskIds,
  orderTaskRowsForTreeDisplay,
} from "@/lib/prototype/implementationTaskTreeSelection";

const IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE = "IMPLEMENTATION_TASK_LIST_READY_V1" as const;

export type ImplementationRequirementsBoardOrchestrationSlice = Readonly<{
  readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
  readonly implementationTaskExecutionStateV1?: ImplementationTaskExecutionStateV1 | null;
  readonly cursorWorkItemsV1?: readonly unknown[] | null;
}>;

export function hasImplementationExecutionBoardOrchestrationData(
  orchestration: ImplementationRequirementsBoardOrchestrationSlice,
): boolean {
  if (orchestration.implementationTaskListV1?.tasks?.length) return true;
  if (orchestration.cursorWorkItemsV1?.length) return true;
  if (orchestration.implementationTaskExecutionStateV1?.items?.length) return true;
  return false;
}

export function resolveImplementationExecutionBoardSelectedTaskId(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly taskCursorExecutionV1?: import("@/lib/prototype/taskCursorExecution").TaskCursorExecutionV1 | null;
}): string | null {
  const cursorTaskId = input.taskCursorExecutionV1?.taskId?.trim();
  const cursorStatus = input.taskCursorExecutionV1?.status;
  if (cursorTaskId && cursorStatus && cursorStatus !== "scm_pending") {
    return cursorTaskId;
  }
  const fromBoard = input.board.currentTaskId?.trim();
  if (fromBoard) return fromBoard;
  const fromWip = input.codeAgentWipExecutionV1?.selectedTaskId?.trim();
  if (fromWip) return fromWip;
  return pickFirstExecutableDeveloperTaskId(input.board) ?? input.board.taskRows[0]?.taskId ?? null;
}

export function formatImplementationBoardStepStatusKo(status: ImplementationBoardStepStatus): string {
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

export function formatMobileCursorEnvPillValue(status: CursorExecutionAvailabilityStatus): string {
  switch (status) {
    case "ready":
      return "준비됨";
    case "missing_workspace":
      return "Workspace 필요";
    case "missing_cursor_api":
    case "missing_cursor_api_url":
      return "Cursor API 필요";
    case "missing_cursor_token":
      return "Cursor Key 필요";
    case "missing_git_repo":
      return "Git 저장소 필요";
    case "configured_but_unverified":
      return "미검증";
    default:
      return status;
  }
}

export function buildMobileBoardEnvPills(input: {
  readonly executionSetup?: ExecutionSetupSourceGenerationRow | null;
}): readonly { readonly label: string; readonly value: string; readonly tone: "ok" | "warn" | "muted" }[] {
  const readiness = evaluateTaskCursorExecutionSetupReadiness({ setup: input.executionSetup });
  const availability = evaluateCursorExecutionAvailability({ setup: input.executionSetup });
  const setupStatus = input.executionSetup?.status;
  return [
    {
      label: "Task Cursor",
      value: formatTaskCursorSetupReadinessPillValue(readiness),
      tone: readiness.ready ? "ok" : "warn",
    },
    {
      label: "GitHub",
      value: availability.hasGithubToken ? "설정됨" : "미설정",
      tone: availability.hasGithubToken ? "ok" : "warn",
    },
    {
      label: "검증",
      value: setupStatus === "validated" ? "완료" : setupStatus === "invalid" ? "실패" : "필요",
      tone: setupStatus === "validated" ? "ok" : setupStatus === "invalid" ? "warn" : "muted",
    },
  ];
}

export type ImplementationNextTaskCardView = Readonly<{
  readonly taskId: string;
  readonly title: string;
  readonly priority: string;
  readonly statusLabel: string;
  readonly developerStatusLabel: string;
  readonly selectionReason: string;
  readonly dependencies: readonly string[];
}>;

export function resolveNextTaskCardView(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly taskCursorExecutionV1?: import("@/lib/prototype/taskCursorExecution").TaskCursorExecutionV1 | null;
}): ImplementationNextTaskCardView | null {
  const taskId = resolveImplementationExecutionBoardSelectedTaskId(input);
  if (!taskId) return null;
  const row = input.board.taskRows.find((r) => r.taskId === taskId);
  if (!row) return null;
  return {
    taskId: row.taskId,
    title: row.title,
    priority: row.priority,
    statusLabel: row.statusLabel,
    developerStatusLabel: formatCompactRoleStepStatusKo("developer", row.developerStatus),
    selectionReason: explainExecutableTaskSelection({ board: input.board, taskId: row.taskId }),
    dependencies: row.dependencies,
  };
}

export function formatCompactRoleStepStatusKo(
  role: "developer" | "reviewer" | "security" | "scm",
  status: ImplementationBoardStepStatus,
): string {
  const roleKo =
    role === "developer"
      ? "개발"
      : role === "reviewer"
        ? "검수"
        : role === "security"
          ? "보안"
          : "SCM";
  const statusKo = formatImplementationBoardStepStatusKo(status);
  if (statusKo === "대기" || statusKo === "준비") return `${roleKo} ${statusKo}`;
  if (statusKo === "진행") return `${roleKo} 진행`;
  if (statusKo === "완료") return `${roleKo} 완료`;
  if (statusKo === "실패") return `${roleKo} 실패`;
  return `${roleKo} ${statusKo}`;
}

export type ImplementationTaskRowCardView = Readonly<{
  readonly taskId: string;
  readonly title: string;
  readonly priority: string;
  readonly developerStatusLabel: string;
  readonly reviewerStatusLabel: string;
  readonly securityStatusLabel: string;
  readonly scmStatusLabel: string;
  readonly reworkCount: number;
  readonly userConfirmationLabel: string;
  readonly statusLabel: string;
}>;

export function buildTaskRowCardView(row: ImplementationExecutionBoardTaskRowV1): ImplementationTaskRowCardView {
  return {
    taskId: row.taskId,
    title: row.title,
    priority: row.priority,
    developerStatusLabel: formatCompactRoleStepStatusKo("developer", row.developerStatus),
    reviewerStatusLabel: formatCompactRoleStepStatusKo("reviewer", row.reviewerStatus),
    securityStatusLabel: formatCompactRoleStepStatusKo("security", row.securityStatus),
    scmStatusLabel: formatCompactRoleStepStatusKo("scm", row.scmStatus),
    reworkCount: row.reworkCount,
    userConfirmationLabel: formatImplementationBoardUserConfirmationKo(row.userConfirmation),
    statusLabel: row.statusLabel,
  };
}

export function countIntegratedStepsCompleted(
  rows: readonly ImplementationExecutionBoardIntegratedRowV1[],
): number {
  return rows.filter((row) => row.status === "done" || row.status === "skipped").length;
}

export function shouldEmphasizeIntegratedStep(status: ImplementationBoardStepStatus): boolean {
  return status === "ready" || status === "in_progress" || status === "failed";
}

export type MobileBoardActionPartition = Readonly<{
  readonly primary: ImplementationStageNextAction | null;
  readonly secondary: readonly ImplementationStageNextAction[];
  readonly more: readonly ImplementationStageNextAction[];
}>;

export function partitionMobileBoardActions(
  actions: readonly ImplementationStageNextAction[],
): MobileBoardActionPartition {
  const deduped = dedupeImplementationStageNextActions(actions);
  const primary = deduped.find((action) => action.priority === "primary") ?? null;
  const withoutPrimary = deduped.filter((action) => action !== primary);
  const secondary = withoutPrimary.filter((action) => action.priority === "secondary").slice(0, 2);
  const secondarySet = new Set(secondary);
  const more = withoutPrimary.filter((action) => !secondarySet.has(action));
  return { primary, secondary, more };
}

export function extractBoardVisibleActionLabels(
  actions: readonly ImplementationStageNextAction[],
): readonly string[] {
  const partition = partitionMobileBoardActions(actions);
  const labels: string[] = [];
  if (partition.primary) labels.push(partition.primary.label);
  for (const action of partition.secondary) labels.push(action.label);
  return labels;
}

export function filterBoardDuplicateChatInterviewSuggestions(
  messages: readonly RequirementsMessage[],
  boardPanelActive: boolean,
  boardActionLabels: readonly string[],
): readonly RequirementsMessage[] {
  if (!boardPanelActive || boardActionLabels.length === 0) return messages;
  const suppress = new Set(boardActionLabels);
  return messages.map((message) => {
    const suggestions = (message.meta as { interviewSuggestions?: readonly string[] } | undefined)
      ?.interviewSuggestions;
    if (!Array.isArray(suggestions) || suggestions.length === 0) return message;
    const filtered = suggestions.filter((label) => !suppress.has(label));
    if (filtered.length === suggestions.length) return message;
    if (filtered.length === 0) {
      return {
        ...message,
        meta: {
          ...message.meta,
          interviewSuggestions: undefined,
        },
      };
    }
    return {
      ...message,
      meta: {
        ...message.meta,
        interviewSuggestions: filtered,
      },
    };
  });
}

export function buildCompactBoardSummaryLine(board: ImplementationExecutionBoardV1): string {
  return buildDashboardProgressHeadline(board);
}

export function buildDashboardProgressHeadline(board: ImplementationExecutionBoardV1): string {
  const total = board.summary.totalTasks;
  const completed = board.summary.completedTasks;
  const inProgress = board.summary.inProgressTasks;
  const rework = board.summary.reworkRequiredTasks ?? 0;
  const blocked = board.summary.blockedByDependencyTasks ?? 0;
  if (total <= 0) return "작업 없음";
  if (rework > 0 || blocked > 0) {
    const parts = [`${total}개 중 ${completed}개 완료`];
    if (rework > 0) parts.push(`${rework}개 재작업 필요`);
    if (blocked > 0) parts.push(`${blocked}개 차단`);
    return parts.join(" · ");
  }
  if (inProgress > 0) {
    const current = Math.min(completed + inProgress, total);
    return `${current}/${total} 진행 중`;
  }
  if (completed >= total) return `${total}/${total} 완료`;
  return `${completed}/${total} 대기`;
}

export type ImplementationTaskTreeChildStep = Readonly<{
  readonly roleLabel: string;
  readonly statusLabel: string;
}>;

export type ImplementationTaskTreeNode = Readonly<{
  readonly taskId: string;
  readonly title: string;
  readonly isActive: boolean;
  readonly isSelected: boolean;
  readonly isChecked: boolean;
  readonly treeDepth: number;
  readonly dependencyLabel?: string;
  readonly defaultExpanded: boolean;
  readonly collapsedSummary: string;
  readonly childSteps: readonly ImplementationTaskTreeChildStep[];
  readonly canRestart: boolean;
  readonly canStop: boolean;
  readonly pollStatusLabel?: string;
  readonly restartBlockedReason?: string;
  readonly needsReworkRegistration: boolean;
}>;

export type TaskCursorPollTickSnapshot = Readonly<{
  readonly round?: number;
  readonly agentStatus?: string;
  readonly executionStatus?: string;
  readonly updatedAt?: string;
}>;

export function findLatestTaskCursorPollTickForTask(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  taskId: string,
): TaskCursorPollTickSnapshot | null {
  const normalizedTaskId = taskId.trim();
  if (!normalizedTaskId || !timeline?.length) return null;
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const entry = timeline[index];
    if (entry?.action !== "task_cursor_poll_tick") continue;
    const fields = parseExecutionLogResponseFields(entry.responseText);
    if (fields.taskId !== normalizedTaskId) continue;
    const round = Number(fields.round);
    return {
      ...(Number.isFinite(round) && round > 0 ? { round } : {}),
      ...(fields.agentStatus?.trim() ? { agentStatus: fields.agentStatus.trim() } : {}),
      ...(fields.executionStatus?.trim()
        ? { executionStatus: fields.executionStatus.trim() }
        : {}),
      ...(entry.createdAt?.trim() ? { updatedAt: entry.createdAt.trim() } : {}),
    };
  }
  return null;
}

export function buildTaskCursorPollStatusLabel(input: {
  readonly taskId: string;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly developerStatus?: ImplementationBoardStepStatus | null;
  readonly serverJob?: TaskCursorJobSummary | null;
}): string | undefined {
  const execution = input.taskCursorExecution;
  if (!execution || execution.taskId !== input.taskId) return undefined;
  if (
    !isActiveTaskCursorExecution(execution, { developerStatus: input.developerStatus ?? null })
  ) {
    return undefined;
  }
  if (isServerTaskCursorPolling() && input.serverJob?.taskId === input.taskId) {
    const summaryVm = buildTaskCursorExecutionJobSummaryVm({
      serverPolling: true,
      serverJob: input.serverJob,
    });
    const summaryLabel = formatTaskCursorExecutionJobBoardLabel(summaryVm);
    if (summaryLabel) return summaryLabel;

    const observability = evaluateTaskCursorJobObservability({
      serverPolling: true,
      serverJob: input.serverJob,
    });
    if (observability.statusLabel) return observability.statusLabel;
    const parts = ["서버 Worker", input.serverJob.status];
    if (input.serverJob.pollCount > 0) parts.push(`${input.serverJob.pollCount}회`);
    if (input.serverJob.lastPollAt) {
      parts.push(`last ${input.serverJob.lastPollAt.slice(11, 19)}`);
    }
    if (input.serverJob.nextPollAt) {
      parts.push(`next ${input.serverJob.nextPollAt.slice(11, 19)}`);
    }
    if (input.serverJob.failureReason) parts.push(input.serverJob.failureReason);
    if (input.serverJob.cursorRunId) parts.push(`run ${input.serverJob.cursorRunId.slice(0, 8)}`);
    const elapsed = formatTaskCursorElapsedMinutes(
      input.serverJob.lastPollAt ?? execution.updatedAt ?? execution.createdAt,
    );
    if (elapsed != null) parts.push(`${elapsed}분 경과`);
    return parts.join(" · ");
  }
  const tick = findLatestTaskCursorPollTickForTask(input.promptTimeline, input.taskId);
  const parts = ["Cloud Agent 폴링"];
  if (tick?.round != null) parts.push(`${tick.round}회`);
  const agentStatus = tick?.agentStatus?.trim() || execution.status?.trim();
  if (agentStatus) parts.push(agentStatus);
  const elapsed = formatTaskCursorElapsedMinutes(
    tick?.updatedAt ?? execution.updatedAt ?? execution.createdAt,
  );
  if (elapsed != null) parts.push(`${elapsed}분 경과`);
  return parts.join(" · ");
}

export function resolveTaskRowStopCapability(input: {
  readonly taskId: string;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly developerStatus?: ImplementationBoardStepStatus;
}): boolean {
  const execution = input.taskCursorExecution;
  if (!execution || execution.taskId !== input.taskId) return false;
  if (
    !isActiveTaskCursorExecution(execution, { developerStatus: input.developerStatus ?? null })
  ) {
    return false;
  }
  return isTaskCursorCloudAgentPollingCancellable(execution);
}

function formatTaskTreeRoleStatus(
  role: "developer" | "reviewer" | "security" | "scm",
  status: ImplementationBoardStepStatus,
): string {
  const roleKo =
    role === "developer"
      ? "AI 개발자"
      : role === "reviewer"
        ? "검수"
        : role === "security"
          ? "보안"
          : "SCM";
  const statusKo = formatImplementationBoardStepStatusKo(status);
  if (statusKo === "진행") return `${roleKo}: 진행 중`;
  if (statusKo === "완료") return `${roleKo}: 완료`;
  if (statusKo === "실패") return `${roleKo}: 실패`;
  return `${roleKo}: ${statusKo === "준비" ? "대기" : statusKo}`;
}

export function buildImplementationTaskTreeNodes(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly activeTaskId?: string | null;
  readonly selectedTaskId?: string | null;
  readonly checkedTaskIds?: readonly string[] | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly serverJob?: TaskCursorJobSummary | null;
}): readonly ImplementationTaskTreeNode[] {
  const activeTaskId = input.activeTaskId?.trim() || null;
  const selectedTaskId = input.selectedTaskId?.trim() || activeTaskId;
  const taskCursorExecution = input.taskCursorExecution ?? null;
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
    const pollStatusLabel = buildTaskCursorPollStatusLabel({
      taskId: row.taskId,
      taskCursorExecution,
      promptTimeline: input.promptTimeline,
      developerStatus: row.developerStatus,
      serverJob: input.serverJob,
    });
    const canStop = resolveTaskRowStopCapability({
      taskId: row.taskId,
      taskCursorExecution,
      developerStatus: row.developerStatus,
    });
    const childSteps: ImplementationTaskTreeChildStep[] = [
      { roleLabel: "AI 개발자", statusLabel: formatTaskTreeRoleStatus("developer", row.developerStatus) },
      {
        roleLabel: "GitHub",
        statusLabel:
          row.developerStatus === "done" || row.developerStatus === "skipped"
            ? "GitHub: 완료"
            : "GitHub: 대기",
      },
    ];
    const collapsedSummary = isPerTaskPipelineComplete({
      developerStatus: row.developerStatus,
      reviewerStatus: row.reviewerStatus,
    })
      ? "완료"
      : row.developerStatus === "done"
        ? "개발 완료"
        : row.developerStatus === "in_progress"
          ? "개발 진행"
          : row.developerStatus === "failed"
            ? "재작업 필요"
            : row.failureReason === "blocked_by_dependency"
              ? "의존 차단"
              : pollStatusLabel
                ? "Cursor 실행 중"
                : "개발 대기";
    return {
      taskId: row.taskId,
      title: row.title,
      isActive,
      isSelected,
      isChecked,
      treeDepth: dependencyView?.depth ?? 0,
      ...(formatTaskTreeDependencyLabel(dependencyView)
        ? { dependencyLabel: formatTaskTreeDependencyLabel(dependencyView) }
        : {}),
      defaultExpanded: isActive || isSelected,
      collapsedSummary,
      childSteps,
      canRestart: restart.canRestart,
      canStop,
      ...(pollStatusLabel ? { pollStatusLabel } : {}),
      ...(!pollStatusLabel && restart.blockedReason
        ? { restartBlockedReason: restart.blockedReason }
        : {}),
      needsReworkRegistration: restart.needsReworkRegistration,
    };
  });
}

export function buildCompactBoardSecondarySummaryLine(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly previewReady: boolean;
  readonly reviewReady: boolean;
  readonly feedbackSummary?: ImplementationCodeTaskFeedbackSummaryV1 | null;
  readonly reworkVm?: ImplementationCodeTaskReworkVmV1 | null;
}): string {
  const parts = [
    input.previewReady ? "Preview 준비됨" : "Preview 미준비",
    input.reviewReady ? "검토단계 이동 가능" : "검토단계 불가",
  ];
  if (input.board.summary.userConfirmationRequired > 0) {
    parts.unshift(`사용자 확인 ${input.board.summary.userConfirmationRequired}`);
  }
  const reworkLine = formatCodeTaskReworkBoardSummaryLine(input.reworkVm);
  if (reworkLine) {
    parts.push(reworkLine);
  } else {
    const feedbackLine = formatCodeTaskFeedbackBoardLine(input.feedbackSummary);
    if (feedbackLine) parts.push(feedbackLine);
  }
  return parts.join(" · ");
}

export function formatImplementationBoardUserConfirmationKo(
  status: ImplementationUserConfirmationStatus,
): string {
  switch (status) {
    case "none":
      return "-";
    case "optional":
      return "선택";
    case "required_non_blocking":
      return "권장";
    case "blocking":
      return "차단";
    default:
      return status;
  }
}

export function formatImplementationBoardRoleKo(
  role: ImplementationExecutionBoardTaskRowV1["currentRole"],
): string {
  switch (role) {
    case "developer":
      return "개발";
    case "reviewer":
      return "검수";
    case "security":
      return "보안";
    case "scm":
      return "SCM";
    case "completed":
      return "완료";
    default:
      return role;
  }
}

export type ImplementationExecutionBoardRowWipOverlay = Readonly<{
  readonly branchName?: string;
  readonly commitMessage?: string;
  readonly commitSha?: string;
  readonly changedFileCount?: number;
  readonly testResultCount?: number;
}>;

export function buildImplementationExecutionBoardRowWipOverlay(input: {
  readonly row: ImplementationExecutionBoardTaskRowV1;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
}): ImplementationExecutionBoardRowWipOverlay | null {
  const wip = input.codeAgentWipExecutionV1;
  if (!wip) return null;
  const selectedTaskId = wip.selectedTaskId?.trim();
  if (selectedTaskId && selectedTaskId !== input.row.taskId) return null;
  const latestCommit = wip.commits[wip.commits.length - 1];
  return {
    branchName: wip.branchName || latestCommit?.branchName,
    commitMessage: latestCommit?.commitMessage,
    commitSha: latestCommit?.sha,
    changedFileCount: latestCommit?.changedFiles.length,
    testResultCount: latestCommit?.testResults.length,
  };
}

export type ImplementationExecutionBoardSummaryView = Readonly<{
  readonly cursorAvailability: CursorExecutionAvailability;
  readonly cursorAvailabilityLabel: string;
  readonly taskCursorSetupReadiness: TaskCursorSetupReadiness;
  readonly envPills: readonly { readonly label: string; readonly value: string; readonly tone: "ok" | "warn" | "muted" }[];
  readonly envDiagnosticLines: readonly string[];
  readonly testReadiness: ImplementationUserTestReadiness;
  readonly previewReady: boolean;
}>;

export function buildImplementationExecutionBoardSummaryView(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly executionSetup?: ExecutionSetupSourceGenerationRow | null;
  readonly previewReady?: boolean;
  readonly hasExecutionState?: boolean;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
}): ImplementationExecutionBoardSummaryView {
  const cursorAvailability = evaluateCursorExecutionAvailability({ setup: input.executionSetup });
  const taskCursorSetupReadiness = evaluateTaskCursorExecutionSetupReadiness({
    setup: input.executionSetup,
  });
  const testReadiness = deriveImplementationUserTestReadiness({
    board: input.board,
    previewReady: input.previewReady === true,
    hasTaskList: true,
    hasExecutionState: input.hasExecutionState !== false,
    boardState: input.boardState,
  });

  const setupStatus = input.executionSetup?.status;

  const envPills = [
    {
      label: "Task Cursor",
      value: formatTaskCursorSetupReadinessPillValue(taskCursorSetupReadiness),
      tone: taskCursorSetupReadiness.ready ? ("ok" as const) : ("warn" as const),
    },
    {
      label: "GitHub",
      value: cursorAvailability.hasGithubToken ? "설정됨" : "미설정",
      tone: cursorAvailability.hasGithubToken ? ("ok" as const) : ("warn" as const),
    },
    {
      label: "검증",
      value: setupStatus === "validated" ? "완료" : setupStatus === "invalid" ? "실패" : "필요",
      tone:
        setupStatus === "validated"
          ? ("ok" as const)
          : setupStatus === "invalid"
            ? ("warn" as const)
            : ("muted" as const),
    },
  ] as const;

  return {
    cursorAvailability,
    cursorAvailabilityLabel: cursorAvailability.status,
    taskCursorSetupReadiness,
    envPills,
    envDiagnosticLines: buildImplementationBoardEnvDetailLines({
      setup: input.executionSetup,
    }),
    testReadiness,
    previewReady: input.previewReady === true,
  };
}

export function isLongImplementationBoardChatMessage(content: string): boolean {
  return (
    content.includes("TASK ID | 작업 | 개발자 | 검수자 | 보안관 | SCM") ||
    content.includes("작업 목록:") ||
    content.includes("통합 정리 단계:")
  );
}

const IMPLEMENTATION_DASHBOARD_ROUTINE_AI_INTERNAL_TYPES = new Set<string>([
  "IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_V1",
  "IMPLEMENTATION_WORK_PLAN_DRAFT_MESSAGE_V1",
  "IMPLEMENTATION_TASK_PLAN_SUMMARY_V1",
  "IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT_MESSAGE_V1",
  "IMPLEMENTATION_ROLE_CHECK_DETAILS_V1",
  "IMPLEMENTATION_SCM_CHECK_DETAILS_V1",
  "IMPLEMENTATION_ENVIRONMENT_CHECK_DETAILS_V1",
  "IMPLEMENTATION_REVIEWER_CHECK_DETAILS_V1",
  "IMPLEMENTATION_SECURITY_CHECK_DETAILS_V1",
]);

const IMPLEMENTATION_DASHBOARD_ALWAYS_SHOW_AI_INTERNAL_TYPES = new Set<string>([
  "IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_V1",
  "IMPLEMENTATION_BLOCKED_QUICK_DESIGN_UNCONFIRMED_V1",
  "IMPLEMENTATION_USER_FEEDBACK_APPLIED_V1",
]);

const IMPLEMENTATION_DASHBOARD_INTERVENTION_CONTENT = [
  /실패|오류|중단|차단|\bfailed\b|\berror\b/i,
  /재작업|보완 요청|보완이 필요|remediation/i,
  /프로토타입.*완료|Preview URL|Preview를 확인|preview.*ready/i,
  /검수.*(실패|수정)|보안.*(실패|수정)|품질.*실패/,
  /Task Cursor.*(실패|오류)|GitHub.*(실패|오류)|commit.*실패/i,
  /자동실행이 중단/,
  /SCM.*(실패|재시도)|merge|승인.*필요/i,
  /사용자 확인.*필요|blocking feedback/i,
  /피드백.*(등록|blocking)/i,
] as const;

export function isImplementationDashboardInterventionMessage(content: string): boolean {
  const text = String(content ?? "").trim();
  if (!text) return false;
  return IMPLEMENTATION_DASHBOARD_INTERVENTION_CONTENT.some((pattern) => pattern.test(text));
}

export function shouldShowImplementationDashboardChatMessage(message: RequirementsMessage): boolean {
  if (message.role === "user") return true;

  const internalType = String(message.meta?.internalType ?? "").trim();
  if (IMPLEMENTATION_DASHBOARD_ALWAYS_SHOW_AI_INTERNAL_TYPES.has(internalType)) return true;
  if (IMPLEMENTATION_DASHBOARD_ROUTINE_AI_INTERNAL_TYPES.has(internalType)) return false;

  if (internalType === IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE) {
    if (isLongImplementationBoardChatMessage(message.content)) return false;
    return isImplementationDashboardInterventionMessage(message.content);
  }

  if (internalType === "PROTOTYPE_EXECUTION_NOTICE") {
    return isImplementationDashboardInterventionMessage(message.content);
  }

  if (message.role === "ai") {
    return isImplementationDashboardInterventionMessage(message.content);
  }

  return true;
}

export function filterImplementationDashboardChatMessages(
  messages: readonly RequirementsMessage[],
  boardPanelActive: boolean,
): readonly RequirementsMessage[] {
  if (!boardPanelActive) return messages;
  return messages.filter(shouldShowImplementationDashboardChatMessage);
}

export function collapseImplementationBoardChatMessagesForPanelView(
  messages: readonly RequirementsMessage[],
  boardPanelActive: boolean,
): readonly RequirementsMessage[] {
  return filterImplementationDashboardChatMessages(messages, boardPanelActive);
}

export function dedupeImplementationStageNextActions(
  actions: readonly ImplementationStageNextAction[],
): readonly ImplementationStageNextAction[] {
  const seen = new Set<string>();
  const out: ImplementationStageNextAction[] = [];
  for (const action of actions) {
    const key = `${action.actionId}::${action.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out;
}

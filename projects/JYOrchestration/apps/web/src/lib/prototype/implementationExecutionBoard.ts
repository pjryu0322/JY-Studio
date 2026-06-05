import { derivePerTaskPipelineRole, isPerTaskPipelineComplete } from "@/lib/prototype/implementationTaskPipelinePolicy";
import {
  countActiveReworkRequestsForTask,
  getUserConfirmationForTask,
} from "@/lib/prototype/implementationExecutionBoardState";
import {
  deriveIntegratedExecutionStateReadiness,
  type ImplementationIntegratedExecutionStateV1,
  type ImplementationIntegratedStep,
  type ImplementationIntegratedStepStatus,
} from "@/lib/prototype/implementationIntegratedExecutionState";
import { resolveIntegrationPipelineUnlocked } from "@/lib/prototype/implementationCodeTaskIntegrationContext";
import {
  compareImplementationTaskListPriority,
  enrichCursorWorkItemsWithBoardReworkContext,
  type CursorWorkItem,
} from "@/lib/prototype/implementationCursorWorkItems";
import type {
  ImplementationQualityGateResultV1,
  ImplementationQualityGateRole,
} from "@/lib/prototype/implementationQualityGate";
import { getLatestImplementationQualityGateResultForRole } from "@/lib/prototype/implementationQualityGate";
import type {
  ImplementationTaskExecutionStateV1,
  ImplementationTaskExecutionStatus,
} from "@/lib/prototype/implementationTaskExecutionState";
import type {
  ImplementationTaskListV1,
  ImplementationTaskPriority,
  ImplementationTaskV1,
} from "@/lib/requirements/implementationTaskList";
import {
  RUN_FINAL_SCM_CHIP,
  RUN_INTEGRATED_REVIEW_CHIP,
  RUN_INTEGRATED_SECURITY_CHIP,
  RUN_REFACTOR_COMMON_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import {
  isActiveTaskCursorExecution,
  isStaleAbandonedTaskCursorExecution,
} from "@/lib/prototype/taskCursorClientPollLoop";

export { deriveImplementationBoardInterviewChips } from "@/lib/prototype/implementationChipPolicy";

export const IMPLEMENTATION_EXECUTION_BOARD_VERSION =
  "implementation_execution_board_v1" as const;

export type ImplementationBoardRoleStep = "developer" | "reviewer" | "security" | "scm";

export type ImplementationBoardIntegratedStep = ImplementationIntegratedStep;

export type ImplementationBoardStepStatus =
  | "not_started"
  | "ready"
  | "queued"
  | "in_progress"
  | "done"
  | "failed"
  | "skipped";

export type ImplementationUserConfirmationStatus =
  | "none"
  | "optional"
  | "required_non_blocking"
  | "blocking";

export type ImplementationFailureReason =
  | "none"
  | "failed_by_cursor"
  | "failed_by_review"
  | "failed_by_security"
  | "failed_by_scm"
  | "failed_by_user_rejection"
  | "blocked_by_env"
  | "blocked_by_user_confirmation"
  | "unknown";

export type ImplementationQualityGateRowStatus = "passed" | "failed" | "none";

export type ImplementationExecutionBoardTaskRowV1 = Readonly<{
  taskId: string;
  title: string;
  priority: ImplementationTaskPriority;
  dependencies: readonly string[];
  currentRole: ImplementationBoardRoleStep | "completed";
  developerStatus: ImplementationBoardStepStatus;
  reviewerStatus: ImplementationBoardStepStatus;
  securityStatus: ImplementationBoardStepStatus;
  scmStatus: ImplementationBoardStepStatus;
  reviewerResultStatus: ImplementationQualityGateRowStatus;
  securityResultStatus: ImplementationQualityGateRowStatus;
  qualityGateFailedTaskIds: readonly string[];
  userConfirmation: ImplementationUserConfirmationStatus;
  userConfirmationReason?: string;
  failureReason: ImplementationFailureReason;
  reworkCount: number;
  canContinueWithoutUserConfirmation: boolean;
  statusLabel: string;
}>;

export type ImplementationExecutionBoardIntegratedRowV1 = Readonly<{
  step: ImplementationBoardIntegratedStep;
  title: string;
  status: ImplementationBoardStepStatus;
  ownerRole: "developer" | "reviewer" | "security" | "scm";
  failureReason: ImplementationFailureReason;
  reworkCount: number;
}>;

export type ImplementationExecutionBoardV1 = Readonly<{
  version: typeof IMPLEMENTATION_EXECUTION_BOARD_VERSION;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  source: "implementation_task_list_and_execution_state";
  mode: "sequential";
  taskRows: readonly ImplementationExecutionBoardTaskRowV1[];
  integratedRows: readonly ImplementationExecutionBoardIntegratedRowV1[];
  currentTaskId?: string;
  currentStep?: ImplementationBoardRoleStep | ImplementationBoardIntegratedStep;
  summary: Readonly<{
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    failedTasks: number;
    reworkRequiredTasks: number;
    userConfirmationRequired: number;
    blockingUserConfirmation: number;
    integratedCompleted: number;
  }>;
}>;

const INTEGRATED_STEP_DEFS: readonly {
  step: ImplementationBoardIntegratedStep;
  title: string;
  ownerRole: "developer" | "reviewer" | "security" | "scm";
}[] = [
  { step: "refactor_common", title: "리팩토링/공통화", ownerRole: "developer" },
  { step: "integrated_review", title: "통합 검수", ownerRole: "reviewer" },
  { step: "integrated_security", title: "통합 보안 점검", ownerRole: "security" },
  { step: "final_scm", title: "최종 SCM 반영", ownerRole: "scm" },
];

const EXECUTION_TO_BOARD_STATUS: Readonly<
  Record<ImplementationTaskExecutionStatus, ImplementationBoardStepStatus>
> = {
  ready: "ready",
  queued: "queued",
  in_progress: "in_progress",
  done: "done",
  failed: "failed",
  skipped: "skipped",
};

const INTEGRATED_TO_BOARD_STATUS: Readonly<
  Record<ImplementationIntegratedStepStatus, ImplementationBoardStepStatus>
> = {
  not_started: "not_started",
  ready: "ready",
  queued: "queued",
  in_progress: "in_progress",
  done: "done",
  failed: "failed",
  skipped: "skipped",
};

const BOARD_STATUS_RANK: Readonly<Record<ImplementationBoardStepStatus, number>> = {
  failed: 0,
  in_progress: 1,
  queued: 2,
  ready: 3,
  not_started: 4,
  done: 5,
  skipped: 6,
};

export function canContinueTaskDespiteUserConfirmation(
  status: ImplementationUserConfirmationStatus,
): boolean {
  return status !== "blocking";
}

export function deriveQualityGateStatusForTask(input: {
  readonly taskId: string;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly role: ImplementationQualityGateRole;
}): ImplementationQualityGateRowStatus {
  const latest = getLatestImplementationQualityGateResultForRole(input.qualityGateResults, input.role);
  if (!latest) return "none";
  if ((latest.failedTaskIds ?? []).includes(input.taskId)) return "failed";
  if (latest.status === "passed") {
    const passedForTask = latest.checks.some(
      (check) =>
        check.status === "passed" &&
        (!check.targetTaskIds?.length || check.targetTaskIds.includes(input.taskId)),
    );
    return passedForTask ? "passed" : "none";
  }
  return "none";
}

/** Developer task row의 검수/보안 상태 — 전역 reviewer/security task 완료를 그대로 물려받지 않는다. */
function derivePostDeveloperRoleStatusForTaskRow(input: {
  readonly taskId: string;
  readonly developerStatus: ImplementationBoardStepStatus;
  readonly role: ImplementationQualityGateRole;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly globalRoleStatus: ImplementationBoardStepStatus;
}): ImplementationBoardStepStatus {
  const gate = deriveQualityGateStatusForTask({
    taskId: input.taskId,
    qualityGateResults: input.qualityGateResults,
    role: input.role,
  });
  if (gate === "failed") return "failed";

  if (input.developerStatus === "skipped") return "skipped";
  if (input.developerStatus === "failed" || !isRoleStepComplete(input.developerStatus)) {
    return "not_started";
  }
  if (gate === "passed") return "done";

  if (
    input.globalRoleStatus === "in_progress" ||
    input.globalRoleStatus === "queued" ||
    input.globalRoleStatus === "ready"
  ) {
    return input.globalRoleStatus;
  }

  return "not_started";
}

function completedDeveloperTaskIds(board: ImplementationExecutionBoardV1): Set<string> {
  return new Set(
    board.taskRows
      .filter((row) => row.developerStatus === "done" || row.developerStatus === "skipped")
      .map((row) => row.taskId),
  );
}

function isDeveloperRowExecutableForWip(
  row: ImplementationExecutionBoardTaskRowV1,
  _completedDeveloperIds: Set<string>,
): boolean {
  if (row.userConfirmation === "blocking") return false;

  const needsRemediation =
    row.reviewerResultStatus === "failed" ||
    row.securityResultStatus === "failed" ||
    row.reworkCount > 0;
  if (needsRemediation) return true;

  if (row.developerStatus === "done" || row.developerStatus === "skipped") return false;
  if (row.developerStatus === "failed") return false;

  return true;
}

function collectExecutableDeveloperRows(
  board: ImplementationExecutionBoardV1,
): readonly ImplementationExecutionBoardTaskRowV1[] {
  const completedDeveloperIds = completedDeveloperTaskIds(board);
  return board.taskRows.filter((row) => isDeveloperRowExecutableForWip(row, completedDeveloperIds));
}

/** Count of developer tasks on the execution board (TaskList WIP candidate pool). */
export function countTaskListWipCandidateTasks(board: ImplementationExecutionBoardV1): number {
  return board.taskRows.length;
}

function sortDeveloperTaskRowsByPriority(
  rows: readonly ImplementationExecutionBoardTaskRowV1[],
): readonly ImplementationExecutionBoardTaskRowV1[] {
  return [...rows].sort(
    (a, b) =>
      compareImplementationTaskListPriority(a.priority, b.priority) ||
      a.taskId.localeCompare(b.taskId),
  );
}

function pickFirstFromExecutableDeveloperRows(
  executable: readonly ImplementationExecutionBoardTaskRowV1[],
): string | null {
  if (!executable.length) return null;

  const qualityFailed = executable.filter(
    (row) => row.reviewerResultStatus === "failed" || row.securityResultStatus === "failed",
  );
  if (qualityFailed.length) return qualityFailed[0]?.taskId ?? null;

  const rework = executable.filter((row) => row.reworkCount > 0);
  if (rework.length) return rework[0]?.taskId ?? null;

  return executable[0]?.taskId ?? null;
}

/** First developer task for WIP: quality-failed → rework → next ready (dependencies met, priority order). */
export function pickFirstExecutableDeveloperTaskId(
  board: ImplementationExecutionBoardV1,
  allowedTaskIds?: readonly string[] | null,
): string | null {
  let executable = sortDeveloperTaskRowsByPriority(collectExecutableDeveloperRows(board));
  if (allowedTaskIds?.length) {
    const allowed = new Set(allowedTaskIds.map((id) => String(id ?? "").trim()).filter(Boolean));
    executable = executable.filter((row) => allowed.has(row.taskId));
  }
  return pickFirstFromExecutableDeveloperRows(executable);
}

/**
 * After a task failure: pick next executable task without treating the failed task as a
 * satisfied dependency (unlike `pickFirstExecutableDeveloperTaskIdExcluding`).
 */
export function pickFirstExecutableDeveloperTaskIdAfterFailure(
  board: ImplementationExecutionBoardV1,
  failedTaskId: string,
  allowedTaskIds?: readonly string[] | null,
): string | null {
  const failed = String(failedTaskId ?? "").trim();
  if (!failed) return pickFirstExecutableDeveloperTaskId(board, allowedTaskIds);

  const completedDeveloperIds = completedDeveloperTaskIds(board);
  let executable = sortDeveloperTaskRowsByPriority(
    board.taskRows.filter((row) => {
      if (row.taskId === failed) return false;
      return isDeveloperRowExecutableForWip(row, completedDeveloperIds);
    }),
  );
  if (allowedTaskIds?.length) {
    const allowed = new Set(allowedTaskIds.map((id) => String(id ?? "").trim()).filter(Boolean));
    executable = executable.filter((row) => allowed.has(row.taskId));
  }
  return pickFirstFromExecutableDeveloperRows(executable);
}

/** Auto-chain: treat completed task as done even if board execution state is stale. */
export function pickFirstExecutableDeveloperTaskIdExcluding(
  board: ImplementationExecutionBoardV1,
  excludeTaskIds?: readonly string[],
  allowedTaskIds?: readonly string[] | null,
): string | null {
  const extraCompleted = new Set(
    (excludeTaskIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean),
  );
  const completedDeveloperIds = completedDeveloperTaskIds(board);
  for (const taskId of extraCompleted) completedDeveloperIds.add(taskId);
  let executable = sortDeveloperTaskRowsByPriority(
    board.taskRows.filter(
      (row) => !extraCompleted.has(row.taskId) && isDeveloperRowExecutableForWip(row, completedDeveloperIds),
    ),
  );
  if (allowedTaskIds?.length) {
    const allowed = new Set(allowedTaskIds.map((id) => String(id ?? "").trim()).filter(Boolean));
    executable = executable.filter((row) => allowed.has(row.taskId));
  }
  return pickFirstFromExecutableDeveloperRows(executable);
}

/** Why `pickFirstExecutableDeveloperTaskId` would select this developer task. */
export function explainExecutableTaskSelection(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly taskId: string;
}): string {
  const taskId = input.taskId.trim();
  const row = input.board.taskRows.find((r) => r.taskId === taskId);
  if (!row) return "다음 실행 가능 작업";
  if (row.reviewerResultStatus === "failed") return "검수 실패 보완 우선";
  if (row.securityResultStatus === "failed") return "보안 실패 보완 우선";
  if (row.reworkCount > 0) return "재작업 요청 우선";
  if (row.developerStatus === "failed") return "기존 실행 실패 보완";
  if (row.userConfirmation === "blocking") return "사용자 확인 차단 없음";
  if (row.priority === "high") return "우선순위 high";
  return "선행 의존성 없음";
}

/** Human-readable reason why a task was selected for rework registration. */
export function explainReworkRequestTarget(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly taskId: string;
}): string {
  const taskId = input.taskId.trim();
  const row = input.board.taskRows.find((r) => r.taskId === taskId);
  if (!row) return "다음 실행 가능 작업";
  if (row.reviewerResultStatus === "failed") return "AI 검수자 점검 실패 작업";
  if (row.securityResultStatus === "failed") return "AI 보안관 점검 실패 작업";
  if (row.developerStatus === "failed") return "개발자 작업 실패";
  if (row.reworkCount > 0) return "기존 재작업 요청 존재";
  return "다음 실행 가능 작업";
}

export function buildReworkRequestRegistrationNotice(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly taskId: string;
  readonly remediationChipLabel?: string;
}): string {
  const reason = explainReworkRequestTarget({ board: input.board, taskId: input.taskId });
  const remediationLabel = input.remediationChipLabel?.trim() || "AI 개발자에게 보완 요청";
  return [
    `${input.taskId} 작업에 재작업 요청을 등록했습니다.`,
    `선정 사유: ${reason}`,
    `다음 작업: [${remediationLabel}]으로 Cursor 보완 작업을 진행하세요.`,
  ].join("\n");
}

/** Target task for REQUEST_TASK_REWORK — preferredTaskId가 유효하면 우선 사용. */
export function pickTaskIdForReworkRequest(
  board: ImplementationExecutionBoardV1,
  preferredTaskId?: string | null,
): string | null {
  const preferred = String(preferredTaskId ?? "").trim();
  if (preferred) {
    const row = board.taskRows.find((item) => item.taskId === preferred);
    if (row) {
      const capability = resolveTaskRowUserRestartCapability({
        row,
        board,
      });
      if (capability.canRestart && capability.needsReworkRegistration) {
        return preferred;
      }
    }
  }

  const qualityFailed = board.taskRows.filter(
    (row) => row.reviewerResultStatus === "failed" || row.securityResultStatus === "failed",
  );
  if (qualityFailed.length) return qualityFailed[0]?.taskId ?? null;

  const failedWithoutRework = board.taskRows.filter(
    (row) => row.developerStatus === "failed" && row.reworkCount === 0,
  );
  if (failedWithoutRework.length) return failedWithoutRework[0]?.taskId ?? null;

  return pickFirstExecutableDeveloperTaskId(board);
}

export type TaskRowUserRestartCapability = Readonly<{
  readonly canRestart: boolean;
  readonly needsReworkRegistration: boolean;
  readonly blockedReason?: string;
}>;

export function resolveTaskRowUserRestartCapability(input: {
  readonly row: ImplementationExecutionBoardTaskRowV1;
  readonly board: ImplementationExecutionBoardV1;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
}): TaskRowUserRestartCapability {
  const execution = input.taskCursorExecution ?? null;
  if (
    execution &&
    isActiveTaskCursorExecution(execution, { developerStatus: input.row.developerStatus })
  ) {
    if (execution.taskId === input.row.taskId) {
      return {
        canRestart: false,
        needsReworkRegistration: false,
        blockedReason: "이 Task의 Cursor 실행이 진행 중입니다.",
      };
    }
    return {
      canRestart: false,
      needsReworkRegistration: false,
      blockedReason: "다른 Task의 Cursor 실행이 진행 중입니다.",
    };
  }
  if (input.row.userConfirmation === "blocking") {
    return {
      canRestart: false,
      needsReworkRegistration: false,
      blockedReason: "사용자 확인이 필요합니다.",
    };
  }
  if (input.row.developerStatus === "in_progress") {
    const sameTaskStaleExecution =
      execution?.taskId === input.row.taskId &&
      isStaleAbandonedTaskCursorExecution(execution, { developerStatus: input.row.developerStatus });
    if (!sameTaskStaleExecution) {
      return {
        canRestart: false,
        needsReworkRegistration: false,
        blockedReason: "이 Task는 현재 실행 중입니다.",
      };
    }
  }
  if (
    isPerTaskPipelineComplete({
      developerStatus: input.row.developerStatus,
      reviewerStatus: input.row.reviewerStatus,
    })
  ) {
    return {
      canRestart: false,
      needsReworkRegistration: false,
      blockedReason: "이미 완료된 Task입니다.",
    };
  }

  const needsReworkRegistration =
    (input.row.developerStatus === "failed" && input.row.reworkCount === 0) ||
    ((input.row.reviewerResultStatus === "failed" || input.row.securityResultStatus === "failed") &&
      input.row.reworkCount === 0);

  return {
    canRestart: true,
    needsReworkRegistration,
  };
}

export function boardShowsRequestTaskReworkChip(board: ImplementationExecutionBoardV1): boolean {
  if (board.summary.failedTasks > 0) return true;
  if (
    board.taskRows.some(
      (row) => row.reviewerResultStatus === "failed" || row.securityResultStatus === "failed",
    )
  ) {
    return true;
  }
  if (board.summary.userConfirmationRequired > 0) return true;
  if (board.taskRows.some((row) => row.reworkCount > 0)) return true;
  return false;
}

export function pickQualityGateTargetTaskIds(input: {
  readonly role: "reviewer" | "security";
  readonly board: ImplementationExecutionBoardV1;
  readonly taskCursorTaskId?: string | null;
}): readonly string[] {
  const { role, board } = input;
  const resultStatusKey =
    role === "reviewer" ? ("reviewerResultStatus" as const) : ("securityResultStatus" as const);
  const roleStatusKey = role === "reviewer" ? ("reviewerStatus" as const) : ("securityStatus" as const);

  const fromFailedResult = board.taskRows
    .filter((row) => row[resultStatusKey] === "failed")
    .map((row) => row.taskId);
  if (fromFailedResult.length) return fromFailedResult;

  const fromRework = board.taskRows.filter((row) => row.reworkCount > 0).map((row) => row.taskId);
  if (fromRework.length) return fromRework;

  const fromPendingReview = board.taskRows
    .filter(
      (row) =>
        (row.developerStatus === "done" || row.developerStatus === "skipped") &&
        row[roleStatusKey] !== "done" &&
        row[roleStatusKey] !== "skipped",
    )
    .map((row) => row.taskId);
  if (fromPendingReview.length) return fromPendingReview;

  const taskCursorTaskId = String(input.taskCursorTaskId ?? "").trim();
  if (taskCursorTaskId && board.taskRows.some((row) => row.taskId === taskCursorTaskId)) {
    return [taskCursorTaskId];
  }

  return [];
}

export function filterCursorWorkItemsForExecutableTask(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly allowedTaskIds?: readonly string[] | null;
}): {
  readonly selectedTaskId: string | null;
  readonly selectedWorkItems: readonly CursorWorkItem[];
  readonly blockedReason?: string;
} {
  const selectedTaskId = pickFirstExecutableDeveloperTaskId(input.board, input.allowedTaskIds);
  if (!selectedTaskId) {
    return {
      selectedTaskId: null,
      selectedWorkItems: [],
      blockedReason: "실행 가능한 개발자 작업이 없습니다.",
    };
  }
  const selectedWorkItems = input.workItems.filter((item) => item.taskId === selectedTaskId);
  if (!selectedWorkItems.length) {
    return {
      selectedTaskId,
      selectedWorkItems: [],
      blockedReason: `${selectedTaskId}에 해당하는 Cursor WorkItem이 없습니다.`,
    };
  }
  return { selectedTaskId, selectedWorkItems };
}

export type ImplementationExecutionBoardOrchestrationInput = Readonly<{
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly integratedExecutionState?: ImplementationIntegratedExecutionStateV1 | null;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly nowIso?: string;
  readonly integrationPipelineUnlocked?: boolean;
}>;

/** Requirements/orchestration slice used to build the execution board. */
export type ImplementationRequirementsBoardOrchestrationSlice = Readonly<{
  readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
  readonly implementationTaskExecutionStateV1?: ImplementationTaskExecutionStateV1 | null;
  readonly implementationIntegratedExecutionStateV1?: ImplementationIntegratedExecutionStateV1 | null;
  readonly implementationExecutionBoardStateV1?: ImplementationExecutionBoardStateV1 | null;
  readonly implementationQualityGateResultsV1?: readonly ImplementationQualityGateResultV1[] | null;
  readonly implementationCodeTaskPlanV1?: import("@/lib/prototype/implementationCodeTaskPlan").ImplementationCodeTaskPlanV1 | null;
  readonly codeTaskExecutionRunsV1?: readonly import("@/lib/prototype/codeTaskExecutionRun").CodeTaskExecutionRunV1[] | null;
  readonly taskCursorExecutionV1?: import("@/lib/prototype/taskCursorExecution").TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistoryV1?: readonly import("@/lib/prototype/taskCursorExecution").TaskCursorExecutionV1[] | null;
  readonly implementationAutoQualityGateV1?: import("@/lib/prototype/implementationAutoQualityGate").ImplementationAutoQualityGateV1 | null;
  readonly implementationPreviewScopeV1?: import("@/lib/prototype/implementationPreviewScopeV1").ImplementationPreviewScopeV1 | null;
  readonly implementationPreviewRuntimeV1?: import("@/lib/prototype/implementationPreviewRuntimeV1").ImplementationPreviewRuntimeV1 | null;
}>;

export { resolveIntegrationPipelineUnlocked } from "@/lib/prototype/implementationCodeTaskIntegrationContext";

export function buildImplementationExecutionBoardFromOrchestration(
  input: ImplementationExecutionBoardOrchestrationInput,
): ImplementationExecutionBoardV1 {
  return buildImplementationExecutionBoard(input);
}

export function buildImplementationExecutionBoardFromRequirementsState(input: {
  readonly projectId: string;
  readonly orchestration: ImplementationRequirementsBoardOrchestrationSlice;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly integratedExecutionState?: ImplementationIntegratedExecutionStateV1 | null;
  readonly nowIso?: string;
}): ImplementationExecutionBoardV1 | null {
  const taskList = input.taskList ?? input.orchestration.implementationTaskListV1 ?? null;
  if (!taskList) return null;
  const projectId = input.projectId.trim() || taskList.projectId;
  const integrationPipelineUnlocked = resolveIntegrationPipelineUnlocked({
    codeTaskPlan: input.orchestration.implementationCodeTaskPlanV1 ?? null,
    taskList,
    codeTaskRuns: input.orchestration.codeTaskExecutionRunsV1 ?? null,
    taskCursorExecution: input.orchestration.taskCursorExecutionV1 ?? null,
    taskCursorExecutionHistory: input.orchestration.taskCursorExecutionHistoryV1 ?? null,
    autoQualityGate: input.orchestration.implementationAutoQualityGateV1 ?? null,
  });
  return buildImplementationExecutionBoard({
    projectId,
    taskList,
    executionState: input.orchestration.implementationTaskExecutionStateV1,
    integratedExecutionState:
      input.integratedExecutionState ?? input.orchestration.implementationIntegratedExecutionStateV1,
    boardState: input.orchestration.implementationExecutionBoardStateV1,
    qualityGateResults: input.orchestration.implementationQualityGateResultsV1,
    integrationPipelineUnlocked,
    nowIso: input.nowIso,
  });
}

export function selectCursorWorkItemsForWipExecution(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly allowedTaskIds?: readonly string[] | null;
}): {
  readonly selectedTaskId: string | null;
  readonly selectedWorkItems: readonly CursorWorkItem[];
  readonly blockedReason?: string;
} {
  const scoped = filterCursorWorkItemsForExecutableTask({
    board: input.board,
    workItems: input.workItems,
    allowedTaskIds: input.allowedTaskIds,
  });
  if (!scoped.selectedWorkItems.length) {
    return scoped;
  }
  return {
    ...scoped,
    selectedWorkItems: enrichCursorWorkItemsWithBoardReworkContext({
      workItems: scoped.selectedWorkItems,
      boardState: input.boardState,
      qualityGateResults: input.qualityGateResults,
    }),
  };
}

const ROLE_LABEL_KO: Readonly<Record<string, string>> = {
  developer: "AI 개발자",
  reviewer: "AI 검수자",
  security: "AI 보안관",
  scm: "SCM",
  refactor_common: "리팩토링/공통화",
  integrated_review: "통합 검수",
  integrated_security: "통합 보안 점검",
  final_scm: "최종 SCM 반영",
};

export function buildNextDeveloperTaskContinuationNotice(
  board: ImplementationExecutionBoardV1,
): string | null {
  const nextTaskId = pickFirstExecutableDeveloperTaskId(board);
  if (!nextTaskId) return null;
  const row = board.taskRows.find((task) => task.taskId === nextTaskId);
  if (!row) return null;
  return [
    "AI 개발자 작업이 완료되었습니다.",
    `다음 실행 가능 작업: ${nextTaskId} ${row.title}`,
    "[생성요청]으로 다음 작업을 이어갈 수 있습니다.",
  ].join("\n");
}

export function formatBoardExecutionTargetLines(
  board: ImplementationExecutionBoardV1,
): readonly string[] {
  const integratedInProgress = board.integratedRows.find((row) => row.status === "in_progress");
  if (integratedInProgress && board.currentStep) {
    const roleLabel =
      integratedInProgress.step === "refactor_common"
        ? "리팩토링/공통화"
        : integratedInProgress.step === "integrated_review"
          ? "통합 검수"
          : integratedInProgress.step === "integrated_security"
            ? "통합 보안 점검"
            : integratedInProgress.step === "final_scm"
              ? "최종 SCM 반영"
              : board.currentStep;
    return [`현재 실행 중:`, `${roleLabel} / ${integratedInProgress.status}`];
  }

  const taskInProgress = board.taskRows.find(
    (row) =>
      row.developerStatus === "in_progress" ||
      row.reviewerStatus === "in_progress" ||
      row.securityStatus === "in_progress" ||
      row.scmStatus === "in_progress",
  );
  if (taskInProgress) {
    const role =
      taskInProgress.developerStatus === "in_progress"
        ? "AI 개발자"
        : taskInProgress.reviewerStatus === "in_progress"
          ? "AI 검수자"
          : taskInProgress.securityStatus === "in_progress"
            ? "AI 보안관"
            : "SCM";
    return [`현재 실행 중:`, `${taskInProgress.taskId} / ${role} / ${taskInProgress.statusLabel}`];
  }

  const readyIntegrated = board.integratedRows.find((row) => row.status === "ready");
  if (readyIntegrated) {
    return [`다음 실행 대상:`, `${readyIntegrated.title} / ${ROLE_LABEL_KO[readyIntegrated.step] ?? readyIntegrated.ownerRole}`];
  }

  const nextTaskId = pickFirstExecutableDeveloperTaskId(board);
  if (nextTaskId) {
    const row = board.taskRows.find((r) => r.taskId === nextTaskId);
    const statusLabel = row?.statusLabel ?? "개발 대기";
    const reason = explainExecutableTaskSelection({ board, taskId: nextTaskId });
    return [
      `다음 실행 대상:`,
      `${nextTaskId} / AI 개발자 / ${statusLabel}`,
      `선정 사유: ${reason}`,
    ];
  }

  return [];
}

function collectQualityGateFailedTaskIds(
  qualityGateResults: readonly ImplementationQualityGateResultV1[] | null | undefined,
): readonly string[] {
  const ids = new Set<string>();
  for (const result of qualityGateResults ?? []) {
    if (result.status === "failed") {
      for (const id of result.failedTaskIds ?? []) ids.add(id);
    }
  }
  return [...ids];
}

function mapExecutionStatus(
  status: ImplementationTaskExecutionStatus | undefined,
): ImplementationBoardStepStatus {
  if (!status) return "not_started";
  return EXECUTION_TO_BOARD_STATUS[status];
}

function mapIntegratedStatus(status: ImplementationIntegratedStepStatus): ImplementationBoardStepStatus {
  return INTEGRATED_TO_BOARD_STATUS[status];
}

function aggregateRoleBoardStatus(
  executionState: ImplementationTaskExecutionStateV1 | null | undefined,
  role: ImplementationBoardRoleStep,
): ImplementationBoardStepStatus {
  const items = (executionState?.items ?? []).filter((item) => item.ownerRole === role);
  if (!items.length) return "not_started";

  let worst: ImplementationBoardStepStatus = "done";
  for (const item of items) {
    const mapped = mapExecutionStatus(item.status);
    if (BOARD_STATUS_RANK[mapped] < BOARD_STATUS_RANK[worst]) {
      worst = mapped;
    }
  }
  return worst;
}

function isRoleStepComplete(status: ImplementationBoardStepStatus): boolean {
  return status === "done" || status === "skipped";
}

function isRoleStepFailed(status: ImplementationBoardStepStatus): boolean {
  return status === "failed";
}

function deriveCurrentRole(input: {
  readonly developerStatus: ImplementationBoardStepStatus;
  readonly reviewerStatus: ImplementationBoardStepStatus;
  readonly securityStatus: ImplementationBoardStepStatus;
  readonly scmStatus: ImplementationBoardStepStatus;
}): ImplementationBoardRoleStep | "completed" {
  if (isRoleStepFailed(input.developerStatus) || !isRoleStepComplete(input.developerStatus)) {
    return "developer";
  }
  if (isRoleStepFailed(input.reviewerStatus) || !isRoleStepComplete(input.reviewerStatus)) {
    return "reviewer";
  }
  if (isRoleStepFailed(input.securityStatus) || !isRoleStepComplete(input.securityStatus)) {
    return "security";
  }
  if (isRoleStepFailed(input.scmStatus) || !isRoleStepComplete(input.scmStatus)) {
    return "scm";
  }
  return "completed";
}

function deriveFailureReason(input: {
  readonly developerStatus: ImplementationBoardStepStatus;
  readonly reviewerStatus: ImplementationBoardStepStatus;
  readonly securityStatus: ImplementationBoardStepStatus;
  readonly scmStatus: ImplementationBoardStepStatus;
  readonly userConfirmation: ImplementationUserConfirmationStatus;
}): ImplementationFailureReason {
  if (input.userConfirmation === "blocking") return "blocked_by_user_confirmation";
  if (input.developerStatus === "failed") return "failed_by_cursor";
  if (input.reviewerStatus === "failed") return "failed_by_review";
  if (input.securityStatus === "failed") return "failed_by_security";
  if (input.scmStatus === "failed") return "failed_by_scm";
  return "none";
}

function deriveStatusLabel(input: {
  readonly currentRole: ImplementationBoardRoleStep | "completed";
  readonly developerStatus: ImplementationBoardStepStatus;
  readonly reviewerStatus: ImplementationBoardStepStatus;
  readonly securityStatus: ImplementationBoardStepStatus;
  readonly scmStatus: ImplementationBoardStepStatus;
  readonly userConfirmation: ImplementationUserConfirmationStatus;
}): string {
  if (input.currentRole === "completed") return "완료";
  if (input.userConfirmation === "required_non_blocking") return "사용자 확인 필요";
  if (input.userConfirmation === "blocking") return "사용자 확인 차단";
  if (input.currentRole === "developer") {
    if (input.developerStatus === "in_progress") return "Cursor 작업 중";
    if (input.developerStatus === "failed") return "재작업 필요";
    if (input.developerStatus === "done") return "개발 완료";
    return "개발 대기";
  }
  if (input.currentRole === "reviewer") {
    if (input.reviewerStatus === "in_progress") return "검수 진행 중";
    if (input.reviewerStatus === "failed") return "검수 실패";
    return "검수 대기";
  }
  if (input.currentRole === "security") {
    if (input.securityStatus === "in_progress") return "보안 점검 중";
    if (input.securityStatus === "failed") return "보안 실패";
    return "보안 대기";
  }
  if (input.scmStatus === "in_progress") return "SCM 반영 중";
  if (input.scmStatus === "failed") return "SCM 실패";
  return "SCM 대기";
}

function buildTaskRow(input: {
  readonly task: ImplementationTaskV1;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly reviewerGlobal: ImplementationBoardStepStatus;
  readonly securityGlobal: ImplementationBoardStepStatus;
  readonly scmGlobal: ImplementationBoardStepStatus;
  readonly qualityGateFailedTaskIds: readonly string[];
}): ImplementationExecutionBoardTaskRowV1 {
  const devItem = (input.executionState?.items ?? []).find((item) => item.taskId === input.task.taskId);
  const developerStatus = mapExecutionStatus(devItem?.status ?? input.task.status);

  const reviewerGate = deriveQualityGateStatusForTask({
    taskId: input.task.taskId,
    qualityGateResults: input.qualityGateResults,
    role: "reviewer",
  });
  const securityGate = deriveQualityGateStatusForTask({
    taskId: input.task.taskId,
    qualityGateResults: input.qualityGateResults,
    role: "security",
  });

  const reviewerStatus = derivePostDeveloperRoleStatusForTaskRow({
    taskId: input.task.taskId,
    developerStatus,
    role: "reviewer",
    qualityGateResults: input.qualityGateResults,
    globalRoleStatus: input.reviewerGlobal,
  });
  const securityStatus = derivePostDeveloperRoleStatusForTaskRow({
    taskId: input.task.taskId,
    developerStatus,
    role: "security",
    qualityGateResults: input.qualityGateResults,
    globalRoleStatus: input.securityGlobal,
  });
  const scmStatus = input.scmGlobal;

  const confirmation = getUserConfirmationForTask(input.boardState, input.task.taskId);
  const userConfirmation: ImplementationUserConfirmationStatus =
    confirmation?.resolvedAt ? "none" : (confirmation?.status ?? "none");
  const userConfirmationReason = confirmation?.resolvedAt ? undefined : confirmation?.reason;

  const currentRole = derivePerTaskPipelineRole({
    developerStatus,
    reviewerStatus,
  });
  const failureReason = deriveFailureReason({
    developerStatus,
    reviewerStatus,
    securityStatus,
    scmStatus,
    userConfirmation,
  });

  const reworkCount = countActiveReworkRequestsForTask(input.boardState, input.task.taskId);

  return {
    taskId: input.task.taskId,
    title: input.task.title,
    priority: input.task.priority,
    dependencies: input.task.dependencies,
    currentRole,
    developerStatus,
    reviewerStatus,
    securityStatus,
    scmStatus,
    reviewerResultStatus: reviewerGate,
    securityResultStatus: securityGate,
    qualityGateFailedTaskIds: input.qualityGateFailedTaskIds.filter((id) => id === input.task.taskId),
    userConfirmation,
    ...(userConfirmationReason ? { userConfirmationReason } : {}),
    failureReason,
    reworkCount,
    canContinueWithoutUserConfirmation: canContinueTaskDespiteUserConfirmation(userConfirmation),
    statusLabel: deriveStatusLabel({
      currentRole,
      developerStatus,
      reviewerStatus,
      securityStatus,
      scmStatus,
      userConfirmation,
    }),
  };
}

function deriveIntegratedRows(
  integratedState: ImplementationIntegratedExecutionStateV1,
): readonly ImplementationExecutionBoardIntegratedRowV1[] {
  const byStep = new Map(integratedState.items.map((item) => [item.step, item]));

  return INTEGRATED_STEP_DEFS.map((def) => {
    const item = byStep.get(def.step);
    const status = mapIntegratedStatus(item?.status ?? "not_started");
    const failureReason: ImplementationFailureReason =
      status === "failed"
        ? def.step === "integrated_review"
          ? "failed_by_review"
          : def.step === "integrated_security"
            ? "failed_by_security"
            : def.step === "final_scm"
              ? "failed_by_scm"
              : "unknown"
        : "none";
    return {
      step: def.step,
      title: def.title,
      status,
      ownerRole: def.ownerRole,
      failureReason,
      reworkCount: item?.reworkCount ?? 0,
    };
  });
}

function pickCurrentTaskAndStep(
  taskRows: readonly ImplementationExecutionBoardTaskRowV1[],
  integratedRows: readonly ImplementationExecutionBoardIntegratedRowV1[],
): {
  currentTaskId?: string;
  currentStep?: ImplementationBoardRoleStep | ImplementationBoardIntegratedStep;
} {
  const activeTask = taskRows.find((row) => row.currentRole !== "completed");
  if (activeTask) {
    return {
      currentTaskId: activeTask.taskId,
      currentStep: activeTask.currentRole === "completed" ? undefined : activeTask.currentRole,
    };
  }

  const activeIntegrated = integratedRows.find(
    (row) => row.status !== "done" && row.status !== "skipped" && row.status !== "not_started",
  );
  if (activeIntegrated) {
    return { currentStep: activeIntegrated.step };
  }

  const readyIntegrated = integratedRows.find((row) => row.status === "ready");
  if (readyIntegrated) {
    return { currentStep: readyIntegrated.step };
  }

  return {};
}

export function buildImplementationExecutionBoard(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly integratedExecutionState?: ImplementationIntegratedExecutionStateV1 | null;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly nowIso?: string;
  readonly integrationPipelineUnlocked?: boolean;
}): ImplementationExecutionBoardV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const reviewerGlobal = aggregateRoleBoardStatus(input.executionState, "reviewer");
  const securityGlobal = aggregateRoleBoardStatus(input.executionState, "security");
  const scmGlobal = aggregateRoleBoardStatus(input.executionState, "scm");
  const qualityGateFailedTaskIds = collectQualityGateFailedTaskIds(input.qualityGateResults);

  const developerTasks = (input.taskList.tasks ?? [])
    .filter((task) => task.ownerRole === "developer")
    .slice()
    .sort((a, b) => compareImplementationTaskListPriority(a.priority, b.priority) || a.taskId.localeCompare(b.taskId));
  const taskRowsRaw = developerTasks.map((task) =>
    buildTaskRow({
      task,
      executionState: input.executionState,
      boardState: input.boardState,
      qualityGateResults: input.qualityGateResults,
      reviewerGlobal,
      securityGlobal,
      scmGlobal,
      qualityGateFailedTaskIds,
    }),
  );
  const taskRows = taskRowsRaw;

  const allTasksCompleted =
    taskRows.length > 0 &&
    taskRows.every((row) =>
      isPerTaskPipelineComplete({
        developerStatus: row.developerStatus,
        reviewerStatus: row.reviewerStatus,
      }),
    );

  const integrationPipelineUnlocked =
    input.integrationPipelineUnlocked === true || allTasksCompleted;

  const integratedState = deriveIntegratedExecutionStateReadiness({
    projectId: input.projectId.trim(),
    state: input.integratedExecutionState,
    integrationPipelineUnlocked,
    nowIso: now,
  });

  const integratedRows = deriveIntegratedRows(integratedState);
  const { currentTaskId, currentStep } = pickCurrentTaskAndStep(taskRows, integratedRows);

  const completedTasks = taskRows.filter((row) =>
    isPerTaskPipelineComplete({
      developerStatus: row.developerStatus,
      reviewerStatus: row.reviewerStatus,
    }),
  ).length;
  const inProgressTasks = taskRows.filter((row) => {
    const role = derivePerTaskPipelineRole({
      developerStatus: row.developerStatus,
      reviewerStatus: row.reviewerStatus,
    });
    return role !== "completed";
  }).length;
  const failedTasks = taskRows.filter((row) => row.failureReason !== "none").length;
  const reworkRequiredTasks = taskRows.filter((row) => row.developerStatus === "failed").length;
  const userConfirmationRequired = taskRows.filter(
    (row) =>
      row.userConfirmation === "required_non_blocking" || row.userConfirmation === "blocking",
  ).length;
  const blockingUserConfirmation = taskRows.filter((row) => row.userConfirmation === "blocking").length;
  const integratedCompleted = integratedRows.filter((row) => row.status === "done").length;

  return {
    version: IMPLEMENTATION_EXECUTION_BOARD_VERSION,
    projectId: input.projectId.trim(),
    createdAt: now,
    updatedAt: now,
    source: "implementation_task_list_and_execution_state",
    mode: "sequential",
    taskRows,
    integratedRows,
    ...(currentTaskId ? { currentTaskId } : {}),
    ...(currentStep ? { currentStep } : {}),
    summary: {
      totalTasks: taskRows.length,
      completedTasks,
      inProgressTasks,
      failedTasks,
      reworkRequiredTasks,
      userConfirmationRequired,
      blockingUserConfirmation,
      integratedCompleted,
    },
  };
}

export function isImplementationBoardComplete(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly previewReady: boolean;
}): boolean {
  if (!input.previewReady) return false;
  if (input.board.summary.failedTasks > 0) return false;
  if (input.board.summary.blockingUserConfirmation > 0) return false;
  if (input.board.taskRows.some((row) => row.currentRole !== "completed")) return false;
  if (!input.board.integratedRows.every((row) => row.status === "done")) return false;
  return true;
}

export function isImplementationReadyForReviewStage(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly previewReady: boolean;
}): boolean {
  return isImplementationBoardComplete(input);
}

const INTEGRATED_STEP_ACTION_LABEL: Readonly<Record<ImplementationIntegratedStep, string>> = {
  refactor_common: "리팩토링/공통화",
  integrated_review: "통합 검수",
  integrated_security: "통합 보안 점검",
  final_scm: "최종 SCM 반영",
};

const INTEGRATED_STEP_DONE_MESSAGE: Readonly<Record<ImplementationIntegratedStep, string>> = {
  refactor_common: "리팩토링/공통화 정리 단계가 완료되었습니다.",
  integrated_review: "통합 검수가 완료되었습니다.",
  integrated_security: "통합 보안 점검이 완료되었습니다.",
  final_scm: "플랫폼 SCM push/PR 반영이 완료되었습니다.",
};

const INTEGRATED_STEP_NEXT_CHIP: Readonly<
  Record<ImplementationIntegratedStep, string | null>
> = {
  refactor_common: RUN_INTEGRATED_REVIEW_CHIP,
  integrated_review: RUN_INTEGRATED_SECURITY_CHIP,
  integrated_security: RUN_FINAL_SCM_CHIP,
  final_scm: null,
};

export function deriveIntegratedStageInterviewChips(
  board: ImplementationExecutionBoardV1,
  input?: { readonly integrationPipelineUnlocked?: boolean },
): readonly string[] {
  const integrationUnlocked =
    input?.integrationPipelineUnlocked === true ||
    board.integratedRows.some((row) => row.step === "refactor_common" && row.status !== "not_started");
  if (!integrationUnlocked) return [];

  const stepStatus = (step: ImplementationIntegratedStep) =>
    board.integratedRows.find((row) => row.step === step)?.status;

  const chips: string[] = [];
  if (stepStatus("refactor_common") === "ready") chips.push(RUN_REFACTOR_COMMON_CHIP);
  if (stepStatus("refactor_common") === "done" && stepStatus("integrated_review") === "ready") {
    chips.push(RUN_INTEGRATED_REVIEW_CHIP);
  }
  if (stepStatus("integrated_review") === "done" && stepStatus("integrated_security") === "ready") {
    chips.push(RUN_INTEGRATED_SECURITY_CHIP);
  }
  if (stepStatus("integrated_security") === "done" && stepStatus("final_scm") === "ready") {
    chips.push(RUN_FINAL_SCM_CHIP);
  }
  return chips;
}

/** Primary integrated-stage chip when tasks are complete; aligns with next action primary label. */
export function deriveIntegratedStagePrimaryChip(
  board: ImplementationExecutionBoardV1,
  input?: { readonly integrationPipelineUnlocked?: boolean },
): string | null {
  const chips = deriveIntegratedStageInterviewChips(board, input);
  return chips[0] ?? null;
}

export function buildIntegratedStageStepActionNotice(input: {
  readonly step: ImplementationIntegratedStep;
  readonly integratedState: ImplementationIntegratedExecutionStateV1;
}): string {
  const label = INTEGRATED_STEP_ACTION_LABEL[input.step];
  const lines = [`${label} 실행을 시작했습니다.`, INTEGRATED_STEP_DONE_MESSAGE[input.step]];
  const nextChip = INTEGRATED_STEP_NEXT_CHIP[input.step];
  if (nextChip) {
    const nextStep = input.integratedState.items.find(
      (item) => item.status === "ready" || item.status === "queued",
    );
    if (nextStep) {
      lines.push(`다음 단계: ${nextChip}`);
    }
  }
  return lines.join("\n");
}

export function formatTaskScopedWipExecutionSuccessNotice(input: {
  readonly totalCandidateCount: number;
  readonly selectedTaskId: string;
  readonly selectedWorkItemsCount: number;
}): string {
  return `TaskList 기준 WIP 후보 ${input.totalCandidateCount}건 중 ${input.selectedTaskId} 작업 ${input.selectedWorkItemsCount}건을 Code Agent WIP 요청으로 전환했습니다.`;
}

export function formatTaskScopedWipExecutionBlockedNotice(input: {
  readonly selectedTaskId: string | null;
  readonly blockedReason: string;
}): string {
  if (input.selectedTaskId && input.blockedReason.includes("WorkItem")) {
    return `${input.selectedTaskId}에 해당하는 Cursor WorkItem이 없어 WIP 요청을 시작하지 못했습니다.`;
  }
  return input.blockedReason;
}

export function buildImplementationReviewStageReadinessNotice(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly previewReady: boolean;
}): string | null {
  if (isImplementationReadyForReviewStage(input)) {
    return "통합 정리, 통합 검수, 통합 보안, 최종 SCM까지 완료되어 검토단계로 이동할 수 있습니다.";
  }
  const allIntegratedDone = input.board.integratedRows.every((row) => row.status === "done");
  if (allIntegratedDone && !input.previewReady) {
    return [
      "통합 정리 단계는 완료되었지만, 프로토타입 Preview가 아직 준비되지 않았습니다.",
      "Preview 상태를 새로고침하거나 배포 상태를 확인해 주세요.",
    ].join("\n");
  }
  if (input.previewReady && !allIntegratedDone) {
    return "프로토타입 Preview는 준비되었지만, 구현단계 통합 정리/검수/보안/최종 SCM이 아직 완료되지 않았습니다.";
  }
  return null;
}

export function formatImplementationExecutionBoardTaskLine(
  row: ImplementationExecutionBoardTaskRowV1,
): string {
  const confirm =
    row.userConfirmation === "none"
      ? "none"
      : row.userConfirmation === "optional"
        ? "optional"
        : row.userConfirmation === "required_non_blocking"
          ? "required_non_blocking"
          : "blocking";
  return [
    row.taskId,
    row.title,
    row.developerStatus,
    row.reviewerStatus,
    row.securityStatus,
    row.scmStatus,
    confirm,
    String(row.reworkCount),
    row.statusLabel,
  ].join(" | ");
}

export function formatImplementationExecutionBoardIntegratedLine(
  row: ImplementationExecutionBoardIntegratedRowV1,
): string {
  return `${row.title} | ${row.status}`;
}

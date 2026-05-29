import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
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
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
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
  | "blocked_by_dependency"
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
  mode: "sequential_with_dependency_parallel";
  taskRows: readonly ImplementationExecutionBoardTaskRowV1[];
  integratedRows: readonly ImplementationExecutionBoardIntegratedRowV1[];
  currentTaskId?: string;
  currentStep?: ImplementationBoardRoleStep | ImplementationBoardIntegratedStep;
  summary: Readonly<{
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    failedTasks: number;
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
  if (latest.status === "passed") return "passed";
  if (latest.failedTaskIds.includes(input.taskId)) return "failed";
  return "none";
}

/** First developer task row that can run (dependencies met, not blocking confirmation). */
export function pickFirstExecutableDeveloperTaskId(
  board: ImplementationExecutionBoardV1,
): string | null {
  const completedDeveloperIds = new Set(
    board.taskRows
      .filter((row) => row.developerStatus === "done" || row.developerStatus === "skipped")
      .map((row) => row.taskId),
  );

  for (const row of board.taskRows) {
    if (row.userConfirmation === "blocking") continue;
    if (row.developerStatus === "done" || row.developerStatus === "skipped") continue;
    const dependenciesMet = row.dependencies.every((dep) => completedDeveloperIds.has(dep));
    if (!dependenciesMet) continue;
    return row.taskId;
  }
  return null;
}

export function filterCursorWorkItemsForExecutableTask(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly workItems: readonly CursorWorkItem[];
}): {
  readonly selectedTaskId: string | null;
  readonly selectedWorkItems: readonly CursorWorkItem[];
  readonly blockedReason?: string;
} {
  const selectedTaskId = pickFirstExecutableDeveloperTaskId(input.board);
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
    return [`다음 실행 대상:`, `${nextTaskId} / AI 개발자`];
  }

  if (board.currentTaskId && board.currentStep && typeof board.currentStep === "string") {
    const roleLabel = ROLE_LABEL_KO[board.currentStep] ?? board.currentStep;
    const row = board.taskRows.find((r) => r.taskId === board.currentTaskId);
    if (row) {
      return [`다음 실행 대상:`, `${board.currentTaskId} / ${roleLabel}`];
    }
  }

  return [];
}

function collectQualityGateFailedTaskIds(
  qualityGateResults: readonly ImplementationQualityGateResultV1[] | null | undefined,
): readonly string[] {
  const ids = new Set<string>();
  for (const result of qualityGateResults ?? []) {
    if (result.status === "failed") {
      for (const id of result.failedTaskIds) ids.add(id);
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
  const items = executionState?.items.filter((item) => item.ownerRole === role) ?? [];
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

function applyQualityGateToRoleStatus(
  taskId: string,
  globalStatus: ImplementationBoardStepStatus,
  gateStatus: ImplementationQualityGateRowStatus,
): ImplementationBoardStepStatus {
  if (gateStatus === "failed") return "failed";
  return globalStatus;
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
    if (input.developerStatus === "failed") return "개발 실패";
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
  const devItem = input.executionState?.items.find((item) => item.taskId === input.task.taskId);
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

  const reviewerStatus = applyQualityGateToRoleStatus(
    input.task.taskId,
    input.reviewerGlobal,
    reviewerGate,
  );
  const securityStatus = applyQualityGateToRoleStatus(
    input.task.taskId,
    input.securityGlobal,
    securityGate,
  );
  const scmStatus = input.scmGlobal;

  const confirmation = getUserConfirmationForTask(input.boardState, input.task.taskId);
  const userConfirmation: ImplementationUserConfirmationStatus = confirmation?.status ?? "none";
  const userConfirmationReason = confirmation?.reason;

  const currentRole = deriveCurrentRole({
    developerStatus,
    reviewerStatus,
    securityStatus,
    scmStatus,
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
}): ImplementationExecutionBoardV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const reviewerGlobal = aggregateRoleBoardStatus(input.executionState, "reviewer");
  const securityGlobal = aggregateRoleBoardStatus(input.executionState, "security");
  const scmGlobal = aggregateRoleBoardStatus(input.executionState, "scm");
  const qualityGateFailedTaskIds = collectQualityGateFailedTaskIds(input.qualityGateResults);

  const developerTasks = input.taskList.tasks.filter((task) => task.ownerRole === "developer");
  const taskRows = developerTasks.map((task) =>
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

  const allTasksCompleted =
    taskRows.length > 0 && taskRows.every((row) => row.currentRole === "completed");

  const integratedState = deriveIntegratedExecutionStateReadiness({
    projectId: input.projectId.trim(),
    state: input.integratedExecutionState,
    taskRowsCompleted: allTasksCompleted,
    nowIso: now,
  });

  const integratedRows = deriveIntegratedRows(integratedState);
  const { currentTaskId, currentStep } = pickCurrentTaskAndStep(taskRows, integratedRows);

  const completedTasks = taskRows.filter((row) => row.currentRole === "completed").length;
  const inProgressTasks = taskRows.filter((row) =>
    ["developer", "reviewer", "security", "scm"].includes(row.currentRole),
  ).length;
  const failedTasks = taskRows.filter((row) => row.failureReason !== "none").length;
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
    mode: "sequential_with_dependency_parallel",
    taskRows,
    integratedRows,
    ...(currentTaskId ? { currentTaskId } : {}),
    ...(currentStep ? { currentStep } : {}),
    summary: {
      totalTasks: taskRows.length,
      completedTasks,
      inProgressTasks,
      failedTasks,
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

export function buildImplementationReviewStageReadinessNotice(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly previewReady: boolean;
}): string | null {
  if (isImplementationReadyForReviewStage(input)) {
    return "통합 정리, 통합 검수, 통합 보안, 최종 SCM까지 완료되어 검토단계로 이동할 수 있습니다.";
  }
  if (input.previewReady && !input.board.integratedRows.every((row) => row.status === "done")) {
    return "프로토타입 Preview는 준비되었지만, 통합 정리 단계가 아직 완료되지 않았습니다.";
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

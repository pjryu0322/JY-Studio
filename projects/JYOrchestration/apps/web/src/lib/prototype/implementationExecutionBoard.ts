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

export type ImplementationBoardIntegratedStep =
  | "refactor_common"
  | "integrated_review"
  | "integrated_security"
  | "final_scm";

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

function mapExecutionStatus(
  status: ImplementationTaskExecutionStatus | undefined,
): ImplementationBoardStepStatus {
  if (!status) return "not_started";
  return EXECUTION_TO_BOARD_STATUS[status];
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
  readonly reviewerStatus: ImplementationBoardStepStatus;
  readonly securityStatus: ImplementationBoardStepStatus;
  readonly scmStatus: ImplementationBoardStepStatus;
}): ImplementationExecutionBoardTaskRowV1 {
  const devItem = input.executionState?.items.find((item) => item.taskId === input.task.taskId);
  const developerStatus = mapExecutionStatus(devItem?.status ?? input.task.status);
  const userConfirmation: ImplementationUserConfirmationStatus = "none";
  const currentRole = deriveCurrentRole({
    developerStatus,
    reviewerStatus: input.reviewerStatus,
    securityStatus: input.securityStatus,
    scmStatus: input.scmStatus,
  });
  const failureReason = deriveFailureReason({
    developerStatus,
    reviewerStatus: input.reviewerStatus,
    securityStatus: input.securityStatus,
    scmStatus: input.scmStatus,
    userConfirmation,
  });

  return {
    taskId: input.task.taskId,
    title: input.task.title,
    priority: input.task.priority,
    dependencies: input.task.dependencies,
    currentRole,
    developerStatus,
    reviewerStatus: input.reviewerStatus,
    securityStatus: input.securityStatus,
    scmStatus: input.scmStatus,
    userConfirmation,
    failureReason,
    reworkCount: 0,
    canContinueWithoutUserConfirmation: canContinueTaskDespiteUserConfirmation(userConfirmation),
    statusLabel: deriveStatusLabel({
      currentRole,
      developerStatus,
      reviewerStatus: input.reviewerStatus,
      securityStatus: input.securityStatus,
      scmStatus: input.scmStatus,
      userConfirmation,
    }),
  };
}

function deriveIntegratedRows(
  taskRows: readonly ImplementationExecutionBoardTaskRowV1[],
  executionState: ImplementationTaskExecutionStateV1 | null | undefined,
): readonly ImplementationExecutionBoardIntegratedRowV1[] {
  const allTasksCompleted = taskRows.length > 0 && taskRows.every((row) => row.currentRole === "completed");
  if (!allTasksCompleted) {
    return INTEGRATED_STEP_DEFS.map((def) => ({
      step: def.step,
      title: def.title,
      status: "not_started" as const,
      ownerRole: def.ownerRole,
      failureReason: "none" as const,
      reworkCount: 0,
    }));
  }

  const reviewerGlobal = aggregateRoleBoardStatus(executionState, "reviewer");
  const securityGlobal = aggregateRoleBoardStatus(executionState, "security");
  const scmGlobal = aggregateRoleBoardStatus(executionState, "scm");

  const statuses: Record<ImplementationBoardIntegratedStep, ImplementationBoardStepStatus> = {
    refactor_common: "ready",
    integrated_review: "not_started",
    integrated_security: "not_started",
    final_scm: "not_started",
  };

  if (reviewerGlobal === "failed") {
    statuses.integrated_review = "failed";
  } else if (reviewerGlobal === "done" || reviewerGlobal === "skipped") {
    statuses.refactor_common = "done";
    statuses.integrated_review = "done";
    if (securityGlobal === "failed") {
      statuses.integrated_security = "failed";
    } else if (securityGlobal === "done" || securityGlobal === "skipped") {
      statuses.integrated_security = "done";
      if (scmGlobal === "failed") {
        statuses.final_scm = "failed";
      } else if (scmGlobal === "done" || scmGlobal === "skipped") {
        statuses.final_scm = "done";
      } else if (scmGlobal === "in_progress") {
        statuses.final_scm = "in_progress";
      } else {
        statuses.final_scm = "ready";
      }
    } else if (securityGlobal === "in_progress") {
      statuses.integrated_security = "in_progress";
    } else {
      statuses.integrated_security = "ready";
    }
  } else if (reviewerGlobal === "in_progress") {
    statuses.integrated_review = "in_progress";
  }

  return INTEGRATED_STEP_DEFS.map((def) => {
    const status = statuses[def.step];
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
      reworkCount: 0,
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
  readonly nowIso?: string;
}): ImplementationExecutionBoardV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const reviewerStatus = aggregateRoleBoardStatus(input.executionState, "reviewer");
  const securityStatus = aggregateRoleBoardStatus(input.executionState, "security");
  const scmStatus = aggregateRoleBoardStatus(input.executionState, "scm");

  const developerTasks = input.taskList.tasks.filter((task) => task.ownerRole === "developer");
  const taskRows = developerTasks.map((task) =>
    buildTaskRow({
      task,
      executionState: input.executionState,
      reviewerStatus,
      securityStatus,
      scmStatus,
    }),
  );

  const integratedRows = deriveIntegratedRows(taskRows, input.executionState);
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
    row.statusLabel,
  ].join(" | ");
}

export function formatImplementationExecutionBoardIntegratedLine(
  row: ImplementationExecutionBoardIntegratedRowV1,
): string {
  return `${row.title} | ${row.status}`;
}

import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import { CODE_AGENT_WIP_WORK_REQUEST_CHIP } from "@/lib/prototype/codeAgentWipExecution";
import {
  isImplementationPrototypeComplete,
  type ImplementationPrototypeRunSyncSnapshot,
} from "@/lib/prototype/implementationPrototypeRunSync";
import { IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE } from "@/lib/prototype/implementationOrchestrationSummary";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationIntegratedExecutionStateV1 } from "@/lib/prototype/implementationIntegratedExecutionState";
import {
  buildImplementationExecutionBoardFromOrchestration,
  buildImplementationExecutionBoardFromRequirementsState,
} from "@/lib/prototype/implementationExecutionBoard";
import {
  buildImplementationExecutionBoardMessage,
  tryAppendImplementationUserConfirmationBoardMessage,
} from "@/lib/prototype/implementationExecutionBoardMessage";
import {
  formatImplementationQualityGateResultLines,
  getLatestImplementationQualityGateResultForRole,
  type ImplementationQualityGateResultV1,
} from "@/lib/prototype/implementationQualityGate";
import {
  areRoleTasksDone,
  formatImplementationTaskExecutionSummaryLines,
  type ImplementationTaskExecutionStateV1,
} from "@/lib/prototype/implementationTaskExecutionState";
import {
  deriveRoleCheckResultInterviewChips,
  deriveTaskListDetailInterviewChips,
} from "@/lib/prototype/implementationChipPolicy";
import { deriveImplementationTaskListReadiness } from "@/lib/prototype/implementationTaskListReadiness";
import {
  formatImplementationTaskListRoleSummaryLines,
  hasImplementationTaskListReady,
  isPlanningReadyForImplementationExecution,
  type ImplementationTaskListV1,
  type ImplementationTaskOwnerRole,
  type ImplementationTaskV1,
} from "@/lib/requirements/implementationTaskList";
import {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  DESIGNER_REVIEW_CHIP,
  GENERATE_IMPLEMENTATION_TASK_LIST_CHIP,
  IMPLEMENTATION_ARTIFACT_REVIEW_LABEL,
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
  IMPLEMENTATION_EXECUTION_BOARD_CHIP,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
  IMPLEMENTATION_RETURN_TO_PLANNING_CHIP,
  IMPLEMENTATION_USER_CONFIRMATION_VIEW_CHIP,
  implementationTaskListEntryChipLabels,
  implementationTaskListMissingEntryChipLabels,
  REVIEWER_CHECK_CHIP,
  REVIEWER_CHECK_RUN_CHIP,
  SCM_CRITERIA_CHIP,
  SECURITY_CHECK_CHIP,
  SECURITY_CHECK_RUN_CHIP,
  TASK_LIST_VIEW_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

export const IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE = "IMPLEMENTATION_TASK_LIST_READY_V1";

export const IMPLEMENTATION_TASK_LIST_READY_HEADLINE = "구현 작업목록이 준비되었습니다." as const;

export const IMPLEMENTATION_TASK_LIST_MISSING_HEADLINE = "구현 작업목록이 아직 없습니다." as const;

export {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  DESIGNER_REVIEW_CHIP,
  GENERATE_IMPLEMENTATION_TASK_LIST_CHIP,
  IMPLEMENTATION_RETURN_TO_PLANNING_CHIP,
  IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
  REVIEWER_CHECK_CHIP,
  REVIEWER_CHECK_RUN_CHIP,
  SCM_CRITERIA_CHIP,
  SECURITY_CHECK_CHIP,
  SECURITY_CHECK_RUN_CHIP,
  TASK_LIST_VIEW_CHIP,
} from "@/lib/requirements/implementationUxLabels";

// Legacy chip labels kept local for chip handler compatibility only.
const LEGACY_IMPLEMENTATION_BLOCKED_RETURN_TO_PLANNING_CHIP = "기획단계로 돌아가기" as const;
const LEGACY_WORK_PLAN_DRAFT_GENERATE_CHIP = "구현 작업안 초안 생성" as const;

const ROLE_LABEL_KO: Readonly<Record<ImplementationTaskOwnerRole, string>> = {
  developer: "AI 개발자",
  designer: "AI 디자이너",
  reviewer: "AI 검수자",
  security: "AI 보안관",
  scm: "SCM",
};

export { formatImplementationTaskListRoleSummaryLines } from "@/lib/requirements/implementationTaskList";

export function implementationTaskListEntryChips(input: { readonly envOk: boolean }): readonly string[] {
  return implementationTaskListEntryChipLabels(input);
}

export function implementationTaskListMissingEntryChips(input?: {
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
}): readonly string[] {
  if (input) {
    const readiness = deriveImplementationTaskListReadiness({
      implementationSeedV1: input.implementationSeedV1,
      implementationTaskListV1: input.implementationTaskListV1,
    });
    return implementationTaskListMissingEntryChipLabels({
      canGenerateFromSeed: readiness.canGenerateTaskList,
    });
  }
  return implementationTaskListMissingEntryChipLabels();
}

function formatTaskQueueLine(task: ImplementationTaskV1): string {
  const role = ROLE_LABEL_KO[task.ownerRole] ?? task.ownerRole;
  return `${task.taskId} | ${role} | ${task.title} | ${task.priority} | ${task.status}`;
}

function formatTaskQueueLineWithExecutionState(
  task: ImplementationTaskV1,
  executionState?: ImplementationTaskExecutionStateV1 | null,
): string {
  const role = ROLE_LABEL_KO[task.ownerRole] ?? task.ownerRole;
  const executionItem = executionState?.items.find((i) => i.taskId === task.taskId);
  const status = executionItem?.status ?? task.status;
  return `${task.taskId} | ${role} | ${task.title} | ${task.priority} | ${status}`;
}

export function formatImplementationTaskQueueLines(
  tasks: readonly ImplementationTaskV1[],
  limit = 12,
): readonly string[] {
  if (!tasks.length) return ["(표시할 작업이 없습니다)"];
  const lines = tasks.slice(0, limit).map(formatTaskQueueLine);
  if (tasks.length > limit) {
    lines.push(`… 외 ${tasks.length - limit}건`);
  }
  return lines;
}

export function formatImplementationTaskQueueLinesWithExecutionState(input: {
  readonly tasks: readonly ImplementationTaskV1[];
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly limit?: number;
}): readonly string[] {
  const limit = input.limit ?? 12;
  if (!input.tasks.length) return ["(표시할 작업이 없습니다)"];
  const lines = input.tasks
    .slice(0, limit)
    .map((task) => formatTaskQueueLineWithExecutionState(task, input.executionState));
  if (input.tasks.length > limit) {
    lines.push(`… 외 ${input.tasks.length - limit}건`);
  }
  return lines;
}

function formatTaskQueueLinesForDisplay(
  tasks: readonly ImplementationTaskV1[],
  executionState?: ImplementationTaskExecutionStateV1 | null,
  limit = 12,
): readonly string[] {
  if (executionState) {
    return formatImplementationTaskQueueLinesWithExecutionState({ tasks, executionState, limit });
  }
  return formatImplementationTaskQueueLines(tasks, limit);
}

function tasksForRole(
  taskList: ImplementationTaskListV1,
  role: ImplementationTaskOwnerRole,
): readonly ImplementationTaskV1[] {
  return taskList.tasks.filter((t) => t.ownerRole === role);
}

function designerFallbackLines(taskList: ImplementationTaskListV1): string[] {
  const screens = taskList.tasks.filter((t) => t.taskType === "screen" && t.ownerRole === "developer");
  if (!screens.length) {
    return [
      "디자이너 전용 작업은 없습니다. 화면·UI 정의를 기준으로 레이아웃·상태·컴포넌트 일관성을 점검해 주세요.",
    ];
  }
  return [
    "디자이너 전용 작업은 없습니다. 아래 화면 구현 작업을 UI·상태 기준으로 검토해 주세요.",
    ...formatImplementationTaskQueueLines(screens, 6),
  ];
}

export function buildImplementationTaskListEntryMessage(input: {
  readonly taskList: ImplementationTaskListV1;
  readonly envOk: boolean;
  readonly nowIso: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const summaryLines = formatImplementationTaskListRoleSummaryLines(input.taskList);
  const envNote = input.envOk
    ? ""
    : [
        "",
        "구현 작업목록은 준비되었지만, Code Agent WIP 작업을 위해 실행 환경 설정이 필요합니다.",
      ].join("\n");

  const content = [
    IMPLEMENTATION_TASK_LIST_READY_HEADLINE,
    "",
    "기획단계에서 생성된 작업목록을 기준으로 AI 개발자, 디자이너, 검수자, 보안관, SCM이 역할별 작업을 진행할 수 있습니다.",
    envNote,
    "",
    "작업 요약:",
    ...summaryLines,
    "",
    "다음 작업을 선택해 주세요.",
  ]
    .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""))
    .join("\n");

  return newRequirementsMessage({
    id: `impl-task-list-entry-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content,
    createdAt: input.nowIso,
    meta: {
      internalType: IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE,
      implementationBootstrapKind: "task_list_ready",
      implementationTaskListReady: true,
      serviceDesignStage: "implementation",
      interviewSuggestions: [...implementationTaskListEntryChips({ envOk: input.envOk })],
      interviewAllowCustomInput: true,
      prototypeOrderKey: 1000,
    },
  });
}

export function buildImplementationTaskListMissingEntryMessage(input: {
  readonly nowIso: string;
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const readiness = deriveImplementationTaskListReadiness({
    implementationSeedV1: input.implementationSeedV1,
    implementationTaskListV1: input.implementationTaskListV1,
  });
  const bodyLine =
    readiness.status === "ready_to_generate_from_seed"
      ? readiness.message
      : readiness.status === "missing_seed" || readiness.status === "seed_not_confirmed"
        ? readiness.message
        : "기획단계에서 Quick Design을 다시 확정하거나 구현 작업목록을 생성해야 합니다.";
  const content = [
    IMPLEMENTATION_TASK_LIST_MISSING_HEADLINE,
    "",
    bodyLine,
    "",
    "다음 작업을 선택해 주세요.",
  ].join("\n");

  return newRequirementsMessage({
    id: `impl-task-list-missing-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content,
    createdAt: input.nowIso,
    meta: {
      internalType: IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE,
      implementationBootstrapKind: "task_list_missing",
      serviceDesignStage: "implementation",
      interviewSuggestions: [
        ...implementationTaskListMissingEntryChips({
          implementationSeedV1: input.implementationSeedV1,
          implementationTaskListV1: input.implementationTaskListV1,
        }),
      ],
      interviewAllowCustomInput: true,
      prototypeOrderKey: 1000,
    },
  });
}

export function buildImplementationPrototypeCompleteMessage(input: {
  readonly prototypeSnapshot: ImplementationPrototypeRunSyncSnapshot;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly nowIso: string;
}): RequirementsMessage | null {
  if (
    !isImplementationPrototypeComplete({
      executionState: input.executionState,
      prototypeSnapshot: input.prototypeSnapshot,
    })
  ) {
    return null;
  }
  const def = getWorkspaceAiMember("prototype_build");
  const urlLine = input.prototypeSnapshot.previewUrl
    ? [`Preview URL: ${input.prototypeSnapshot.previewUrl}`]
    : [];
  const reviewerDone = areRoleTasksDone(input.executionState, "reviewer");
  const securityDone = areRoleTasksDone(input.executionState, "security");
  const internalChecksPassed = reviewerDone && securityDone;
  const pendingReview = input.executionState?.items.some(
    (item) =>
      (item.ownerRole === "reviewer" || item.ownerRole === "security") &&
      (item.status === "queued" || item.status === "ready" || item.status === "in_progress"),
  );
  const headline = internalChecksPassed
    ? "내부 검수와 보안 점검 기준을 통과했고, 프로토타입 생성이 완료되었습니다."
    : pendingReview
      ? "프로토타입은 생성되었지만, 일부 내부 점검이 아직 대기 중입니다."
      : "프로토타입 생성이 완료되었습니다.";
  const content = [
    headline,
    "Preview URL에서 결과를 확인할 수 있습니다.",
    ...urlLine,
    "",
    "다음 작업을 선택해 주세요.",
  ].join("\n");

  return newRequirementsMessage({
    id: `impl-prototype-complete-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content,
    createdAt: input.nowIso,
    meta: {
      internalType: IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      interviewSuggestions: [
        IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
        "변경사항 보기",
        REVIEWER_CHECK_CHIP,
        SECURITY_CHECK_CHIP,
        SCM_CRITERIA_CHIP,
      ],
      interviewAllowCustomInput: true,
      prototypeOrderKey: 1250,
    },
  });
}

export function buildImplementationTaskListViewMessage(input: {
  readonly taskList: ImplementationTaskListV1;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly integratedExecutionState?: ImplementationIntegratedExecutionStateV1 | null;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly prototypeSnapshot?: ImplementationPrototypeRunSyncSnapshot | null;
  readonly nowIso: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const board = buildImplementationExecutionBoardFromOrchestration({
    projectId: input.taskList.projectId,
    taskList: input.taskList,
    executionState: input.executionState,
    integratedExecutionState: input.integratedExecutionState,
    boardState: input.boardState,
    qualityGateResults: input.qualityGateResults,
    nowIso: input.nowIso,
  });
  const boardSummaryLines = [
    `보드 요약: ${board.summary.completedTasks}/${board.summary.totalTasks} 완료`,
    ...(board.currentTaskId && board.currentStep
      ? [`현재 실행: ${board.currentTaskId} / ${board.currentStep}`]
      : []),
  ];
  const executionLines = formatImplementationTaskExecutionSummaryLines(input.executionState);
  const queueLines = formatTaskQueueLinesForDisplay(input.taskList.tasks, input.executionState, 20);
  const prototypeComplete =
    input.prototypeSnapshot &&
    isImplementationPrototypeComplete({
      executionState: input.executionState,
      prototypeSnapshot: input.prototypeSnapshot,
    });
  const content = [
    ...(prototypeComplete
      ? ["프로토타입 생성이 완료되었습니다.", "Preview URL에서 결과를 확인할 수 있습니다.", ""]
      : []),
    ...boardSummaryLines,
    "",
    "구현 작업목록입니다. (TASK ID / 역할 / 제목 / 우선순위 / 상태)",
    "",
    ...queueLines,
    ...(executionLines.length ? ["", ...executionLines] : []),
    ...(input.prototypeSnapshot?.previewUrl
      ? ["", `Preview URL: ${input.prototypeSnapshot.previewUrl}`]
      : []),
    "",
    "다음 작업을 선택해 주세요.",
  ].join("\n");

  const suggestions = prototypeComplete
    ? [
        IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
        "변경사항 보기",
        REVIEWER_CHECK_CHIP,
        SECURITY_CHECK_CHIP,
        SCM_CRITERIA_CHIP,
      ]
    : [...deriveTaskListDetailInterviewChips({ envOk: true })];

  return newRequirementsMessage({
    id: `impl-task-list-view-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content,
    createdAt: input.nowIso,
    meta: {
      internalType: IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      interviewSuggestions: suggestions,
      interviewAllowCustomInput: true,
      prototypeOrderKey: 1200,
    },
  });
}

function buildRoleTaskQueueMessage(input: {
  readonly taskList: ImplementationTaskListV1;
  readonly role: ImplementationTaskOwnerRole;
  readonly heading: string;
  readonly emptyFallback: () => readonly string[];
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly qualityGateResult?: ImplementationQualityGateResultV1 | null;
  readonly nowIso: string;
  readonly messageIdPrefix: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const roleTasks = tasksForRole(input.taskList, input.role);
  const bodyLines =
    roleTasks.length > 0
      ? formatTaskQueueLinesForDisplay(roleTasks, input.executionState, 12)
      : [...input.emptyFallback()];
  const roleStatus = input.executionState?.items.find((i) => i.ownerRole === input.role)?.status;
  const statusLine = roleStatus ? [`현재 상태: ${roleStatus}`, ""] : [];
  const gateLines = formatImplementationQualityGateResultLines(input.qualityGateResult);

  const content = [
    input.heading,
    "",
    ...statusLine,
    ...bodyLines,
    "",
    "점검 결과:",
    ...gateLines,
    "",
    "다음 작업을 선택해 주세요.",
  ].join("\n");

  return newRequirementsMessage({
    id: `${input.messageIdPrefix}-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content,
    createdAt: input.nowIso,
    meta: {
      internalType: IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      interviewSuggestions: [...deriveRoleCheckResultInterviewChips({ envOk: true })],
      interviewAllowCustomInput: true,
      prototypeOrderKey: 1210,
    },
  });
}

export function buildDesignerReviewTaskMessage(input: {
  readonly taskList: ImplementationTaskListV1;
  readonly nowIso: string;
}): RequirementsMessage {
  return buildRoleTaskQueueMessage({
    taskList: input.taskList,
    role: "designer",
    heading: "디자이너 검토 대상 작업입니다.",
    emptyFallback: () => designerFallbackLines(input.taskList),
    nowIso: input.nowIso,
    messageIdPrefix: "impl-designer-review",
  });
}

export function buildReviewerCheckTaskMessage(input: {
  readonly taskList: ImplementationTaskListV1;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly nowIso: string;
}): RequirementsMessage {
  return buildRoleTaskQueueMessage({
    taskList: input.taskList,
    role: "reviewer",
    heading: "검수자 점검 대상 작업입니다.",
    emptyFallback: () => ["검수자 작업이 없습니다. 구현 작업목록을 다시 확인해 주세요."],
    executionState: input.executionState,
    qualityGateResult: getLatestImplementationQualityGateResultForRole(
      input.qualityGateResults,
      "reviewer",
    ),
    nowIso: input.nowIso,
    messageIdPrefix: "impl-reviewer-check",
  });
}

export function buildSecurityCheckTaskMessage(input: {
  readonly taskList: ImplementationTaskListV1;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly nowIso: string;
}): RequirementsMessage {
  return buildRoleTaskQueueMessage({
    taskList: input.taskList,
    role: "security",
    heading: "보안 점검 대상 작업입니다.",
    emptyFallback: () => ["보안 점검 작업이 없습니다. 구현 작업목록을 다시 확인해 주세요."],
    executionState: input.executionState,
    qualityGateResult: getLatestImplementationQualityGateResultForRole(
      input.qualityGateResults,
      "security",
    ),
    nowIso: input.nowIso,
    messageIdPrefix: "impl-security-check",
  });
}

export function buildScmCriteriaTaskMessage(input: {
  readonly taskList: ImplementationTaskListV1;
  readonly nowIso: string;
}): RequirementsMessage {
  return buildRoleTaskQueueMessage({
    taskList: input.taskList,
    role: "scm",
    heading: "SCM 반영 기준 작업입니다.",
    emptyFallback: () => ["SCM 작업이 없습니다. 구현 작업목록을 다시 확인해 주세요."],
    nowIso: input.nowIso,
    messageIdPrefix: "impl-scm-criteria",
  });
}

export function buildDeveloperImplementationRequestPrepMessage(input: {
  readonly taskList: ImplementationTaskListV1;
  readonly envOk: boolean;
  readonly nowIso: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const devTasks = tasksForRole(input.taskList, "developer");
  const taskLines = devTasks.length
    ? formatImplementationTaskQueueLines(devTasks, 8)
    : ["(개발자 작업이 없습니다. 작업목록을 확인해 주세요.)"];

  const envBlock = input.envOk
    ? [
        "구현 작업목록과 실행 보드 기준으로 Code Agent WIP 요청을 준비합니다.",
        "",
        "다음 단계에서 [생성요청]을 선택하면 선택된 개발자 작업을 WIP branch 기준으로 진행합니다.",
      ]
    : [
        "구현 작업목록은 준비되었지만, Code Agent WIP 작업 전에 실행 환경 설정을 완료해 주세요.",
        "",
        "환경 설정 후 [코드 에이전트 WIP 작업 요청]으로 구현을 이어갈 수 있습니다.",
      ];

  const chips = input.envOk
    ? [CODE_AGENT_WIP_WORK_REQUEST_CHIP, TASK_LIST_VIEW_CHIP, IMPLEMENTATION_ENV_SETTINGS_LABEL]
    : [IMPLEMENTATION_ENV_SETTINGS_LABEL, TASK_LIST_VIEW_CHIP];

  const content = [
    "AI 개발자 구현 요청 준비",
    "",
    "다음 개발자 작업을 우선 실행 대상으로 봅니다.",
    "",
    ...taskLines,
    "",
    ...envBlock,
    "",
    "다음 작업을 선택해 주세요.",
  ].join("\n");

  return newRequirementsMessage({
    id: `impl-dev-request-prep-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content,
    createdAt: input.nowIso,
    meta: {
      internalType: IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      interviewSuggestions: chips,
      interviewAllowCustomInput: true,
      prototypeOrderKey: 1220,
    },
  });
}

export function isTaskListExecutionReady(input: {
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
}): boolean {
  return isPlanningReadyForImplementationExecution({
    implementationSeedV1: input.implementationSeedV1,
    implementationTaskListV1: input.implementationTaskListV1,
  });
}

export function hasTaskListReadyState(
  taskList: ImplementationTaskListV1 | null | undefined,
): boolean {
  return hasImplementationTaskListReady(taskList);
}

export const IMPLEMENTATION_TASK_LIST_CHIP_LABELS = [
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  IMPLEMENTATION_EXECUTION_BOARD_CHIP,
  IMPLEMENTATION_USER_CONFIRMATION_VIEW_CHIP,
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  TASK_LIST_VIEW_CHIP,
  DESIGNER_REVIEW_CHIP,
  REVIEWER_CHECK_CHIP,
  REVIEWER_CHECK_RUN_CHIP,
  SECURITY_CHECK_CHIP,
  SECURITY_CHECK_RUN_CHIP,
  SCM_CRITERIA_CHIP,
  GENERATE_IMPLEMENTATION_TASK_LIST_CHIP,
  IMPLEMENTATION_RETURN_TO_PLANNING_CHIP,
  LEGACY_IMPLEMENTATION_BLOCKED_RETURN_TO_PLANNING_CHIP,
  LEGACY_WORK_PLAN_DRAFT_GENERATE_CHIP,
] as const;

export function tryHandleImplementationTaskListChip(input: {
  readonly label: string;
  readonly projectId?: string;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly integratedExecutionState?: ImplementationIntegratedExecutionStateV1 | null;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly prototypeSnapshot?: ImplementationPrototypeRunSyncSnapshot | null;
  readonly envOk: boolean;
  readonly nowIso?: string;
  readonly appendAiMessage: (message: RequirementsMessage) => void;
  readonly openEnvSettings: () => void;
  readonly openPrototypePreview?: () => void;
  readonly returnToPlanningStage: () => void;
  readonly generateTaskListFromSeed?: () => void;
  readonly showToast: (message: string) => void;
}): boolean {
  const t = input.label.trim();
  const now = input.nowIso ?? new Date().toISOString();
  const list = input.taskList;

  const buildBoard = () => {
    if (!list) return null;
    const projectId = input.projectId?.trim() || list.projectId;
    return buildImplementationExecutionBoardFromRequirementsState({
      projectId,
      orchestration: {
        implementationTaskListV1: list,
        implementationTaskExecutionStateV1: input.executionState,
        implementationIntegratedExecutionStateV1: input.integratedExecutionState,
        implementationExecutionBoardStateV1: input.boardState,
        implementationQualityGateResultsV1: input.qualityGateResults,
      },
      taskList: list,
      nowIso: now,
    });
  };

  const appendBoardMessage = () => {
    const board = buildBoard();
    if (!board) return;
    input.appendAiMessage(
      buildImplementationExecutionBoardMessage({
        board,
        taskList: list,
        includeTaskSummary: false,
        envOk: input.envOk,
        nowIso: now,
        previewReady: input.prototypeSnapshot?.previewReady === true,
        hasExecutionState: Boolean(input.executionState),
        boardState: input.boardState,
      }),
    );
  };

  const appendDeveloperRequestPrep = () => {
    if (!list) {
      input.showToast("구현 작업목록이 없습니다. 기획단계에서 Quick Design을 확정해 주세요.");
      return;
    }
    if (!input.envOk) {
      input.showToast("Code Agent WIP 작업 전에 환경설정을 완료해 주세요.");
      input.openEnvSettings();
      return;
    }
    input.appendAiMessage(
      buildDeveloperImplementationRequestPrepMessage({
        taskList: list,
        envOk: input.envOk,
        nowIso: now,
      }),
    );
  };

  switch (t) {
    case IMPLEMENTATION_GENERATION_REQUEST_CHIP:
      return false;
    case AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP:
      appendDeveloperRequestPrep();
      return true;
    case IMPLEMENTATION_EXECUTION_BOARD_CHIP:
      if (!list) {
        input.showToast("표시할 구현 작업목록이 없습니다.");
        return true;
      }
      appendBoardMessage();
      return true;
    case IMPLEMENTATION_USER_CONFIRMATION_VIEW_CHIP:
      if (!list) {
        input.showToast("표시할 구현 작업목록이 없습니다.");
        return true;
      }
      tryAppendImplementationUserConfirmationBoardMessage({
        board: buildBoard(),
        nowIso: now,
        appendAiMessage: input.appendAiMessage,
        showToast: input.showToast,
      });
      return true;
    case TASK_LIST_VIEW_CHIP:
      if (!list) {
        input.showToast("표시할 구현 작업목록이 없습니다.");
        return true;
      }
      input.appendAiMessage(
        buildImplementationTaskListViewMessage({
          taskList: list,
          executionState: input.executionState,
          integratedExecutionState: input.integratedExecutionState,
          boardState: input.boardState,
          qualityGateResults: input.qualityGateResults,
          prototypeSnapshot: input.prototypeSnapshot,
          nowIso: now,
        }),
      );
      return true;
    case IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP:
      if (input.openPrototypePreview) {
        input.openPrototypePreview();
        return true;
      }
      if (input.prototypeSnapshot?.previewUrl) {
        input.showToast(`Preview URL: ${input.prototypeSnapshot.previewUrl}`);
        return true;
      }
      input.showToast("Preview URL이 아직 없습니다.");
      return true;
    case DESIGNER_REVIEW_CHIP:
      if (!list) return false;
      input.appendAiMessage(buildDesignerReviewTaskMessage({ taskList: list, nowIso: now }));
      return true;
    case REVIEWER_CHECK_CHIP:
      if (!list) return false;
      input.appendAiMessage(
        buildReviewerCheckTaskMessage({
          taskList: list,
          executionState: input.executionState,
          qualityGateResults: input.qualityGateResults,
          nowIso: now,
        }),
      );
      return true;
    case SECURITY_CHECK_CHIP:
      if (!list) return false;
      input.appendAiMessage(
        buildSecurityCheckTaskMessage({
          taskList: list,
          executionState: input.executionState,
          qualityGateResults: input.qualityGateResults,
          nowIso: now,
        }),
      );
      return true;
    case SCM_CRITERIA_CHIP:
      if (!list) return false;
      input.appendAiMessage(buildScmCriteriaTaskMessage({ taskList: list, nowIso: now }));
      return true;
    case GENERATE_IMPLEMENTATION_TASK_LIST_CHIP:
      if (input.generateTaskListFromSeed) {
        input.generateTaskListFromSeed();
        return true;
      }
      input.showToast("구현 작업목록을 생성할 수 없습니다. Implementation Seed를 확인해 주세요.");
      return true;
    case IMPLEMENTATION_RETURN_TO_PLANNING_CHIP:
      input.returnToPlanningStage();
      return true;
    case IMPLEMENTATION_ENV_SETTINGS_LABEL:
    case "환경설정 보기":
      input.openEnvSettings();
      return true;
    case IMPLEMENTATION_ARTIFACT_REVIEW_LABEL:
      input.showToast(
        "구현 산출물 Hub는 제공되지 않습니다. 기획(/requirements) 화면에서 산출물을 확인해 주세요.",
      );
      return true;
    default:
      return false;
  }
}

export function hasValidImplementationTaskListBootstrap(
  messages: readonly RequirementsMessage[] | null | undefined,
): boolean {
  return (messages ?? []).some((m) => {
    if (m.speakerId !== "prototype_build") return false;
    if (
      m.meta.internalType === IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE &&
      m.meta.implementationBootstrapKind === "task_list_missing" &&
      m.content.includes(IMPLEMENTATION_TASK_LIST_MISSING_HEADLINE)
    ) {
      return true;
    }
    if (!m.content.includes(IMPLEMENTATION_TASK_LIST_READY_HEADLINE)) return false;
    if (
      m.meta.internalType === IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE &&
      m.meta.implementationBootstrapKind === "task_list_ready"
    ) {
      return true;
    }
    return m.meta.internalType === "IMPLEMENTATION_TASK_LIST_READY_V1";
  });
}

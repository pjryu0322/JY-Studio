import { evaluatePlatformScmPermissionGate } from "@/lib/prototype/platformScmRouteAuth";
import { validateFinalScmIntegratedStageReadiness, validatePlatformScmMergeStepReadiness } from "@/lib/prototype/platformScmReadiness";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import {
  buildImplementationStageActionTimelineEntry,
  type ImplementationStageActionTimelineSource,
} from "@/lib/prototype/implementationIntentTimeline";
import {
  canConfirmImplementationWorkPlanFromEffectiveState,
  type EffectiveImplementationState,
  type ImplementationStageActionGateResult,
  type ImplementationStageActionId,
} from "@/lib/prototype/effectiveImplementationState";
import {
  buildImplementationExecutionBoardFromOrchestration,
  isImplementationReadyForReviewStage,
  type ImplementationExecutionBoardV1,
} from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationReviewStageReadyV1 } from "@/lib/prototype/implementationReviewStageReady";
import { isReviewStageEntryReady } from "@/lib/prototype/reviewStageUserTest";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationIntegratedExecutionStateV1 } from "@/lib/prototype/implementationIntegratedExecutionState";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { hasImplementationWorkPlanDraftReady } from "@/lib/prototype/implementationWorkPlanDraft";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import { deriveImplementationTaskListReadiness } from "@/lib/prototype/implementationTaskListReadiness";
import { isPlanningReadyForImplementationExecution } from "@/lib/requirements/implementationTaskList";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  evaluateImplementationPlanningExecutionGate,
  IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE,
  type ImplementationWorkItemPreflightSummaryV1,
} from "@/lib/prototype/implementationPlanningReadiness";
import { evaluateActiveImplementationExecutionGate } from "@/lib/prototype/implementationStageRunningGate";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
import type { ImplementationExecutionJobV1 } from "@/lib/prototype/implementationExecutionJob";

export type { ImplementationStageActionGateResult, ImplementationStageActionId };

export type ImplementationStageBoardGateContext = Readonly<{
  readonly board: ImplementationExecutionBoardV1;
  readonly previewReady: boolean;
  readonly reviewStageEntryReady: boolean;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly taskCursorExecutionV1?: TaskCursorExecutionV1 | null;
  readonly canApplyGit?: boolean;
  readonly implementationCodeTaskPlanV1?: ImplementationCodeTaskPlanV1 | null;
  readonly cursorWorkItemsV1?: readonly CursorWorkItem[] | null;
  readonly implementationWorkItemPreflightSummaryV1?: ImplementationWorkItemPreflightSummaryV1 | null;
  readonly implementationCodeTaskQualityGateV1?: import("@/lib/prototype/implementationCodeTaskQualityGate").ImplementationCodeTaskQualityGateV1 | null;
  readonly activeTaskCursorJob?: TaskCursorJobSummary | null;
  readonly implementationExecutionJobsV1?: readonly ImplementationExecutionJobV1[] | null;
}>;

export function buildImplementationStageBoardGateContext(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1 | null | undefined;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly integratedExecutionState?: ImplementationIntegratedExecutionStateV1 | null;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly previewReady?: boolean;
  readonly implementationReviewStageReadyV1?: ImplementationReviewStageReadyV1 | null;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly taskCursorExecutionV1?: TaskCursorExecutionV1 | null;
  readonly canApplyGit?: boolean;
  readonly implementationCodeTaskPlanV1?: ImplementationCodeTaskPlanV1 | null;
  readonly cursorWorkItemsV1?: readonly CursorWorkItem[] | null;
  readonly implementationWorkItemPreflightSummaryV1?: ImplementationWorkItemPreflightSummaryV1 | null;
  readonly implementationCodeTaskQualityGateV1?: import("@/lib/prototype/implementationCodeTaskQualityGate").ImplementationCodeTaskQualityGateV1 | null;
  readonly activeTaskCursorJob?: TaskCursorJobSummary | null;
}): ImplementationStageBoardGateContext | null {
  if (!input.taskList) return null;
  const previewReady = input.previewReady === true;
  return {
    ...(input.codeAgentWipExecutionV1 !== undefined
      ? { codeAgentWipExecutionV1: input.codeAgentWipExecutionV1 }
      : {}),
    ...(input.taskCursorExecutionV1 !== undefined
      ? { taskCursorExecutionV1: input.taskCursorExecutionV1 }
      : {}),
    board: buildImplementationExecutionBoardFromOrchestration({
      projectId: input.projectId,
      taskList: input.taskList,
      executionState: input.executionState,
      integratedExecutionState: input.integratedExecutionState,
      boardState: input.boardState,
      qualityGateResults: input.qualityGateResults,
    }),
    previewReady,
    reviewStageEntryReady: isReviewStageEntryReady({
      implementationReviewStageReadyV1: input.implementationReviewStageReadyV1,
      previewReady,
    }),
    ...(input.canApplyGit !== undefined ? { canApplyGit: input.canApplyGit } : {}),
    ...(input.implementationCodeTaskPlanV1 !== undefined
      ? { implementationCodeTaskPlanV1: input.implementationCodeTaskPlanV1 }
      : {}),
    ...(input.cursorWorkItemsV1 !== undefined ? { cursorWorkItemsV1: input.cursorWorkItemsV1 } : {}),
    ...(input.implementationWorkItemPreflightSummaryV1 !== undefined
      ? { implementationWorkItemPreflightSummaryV1: input.implementationWorkItemPreflightSummaryV1 }
      : {}),
    ...(input.implementationCodeTaskQualityGateV1 !== undefined
      ? { implementationCodeTaskQualityGateV1: input.implementationCodeTaskQualityGateV1 }
      : {}),
    ...(input.activeTaskCursorJob !== undefined
      ? { activeTaskCursorJob: input.activeTaskCursorJob }
      : {}),
    ...(input.implementationExecutionJobsV1 !== undefined
      ? { implementationExecutionJobsV1: input.implementationExecutionJobsV1 }
      : {}),
  };
}

function evaluateReviewStageActionGate(
  boardContext: ImplementationStageBoardGateContext | null | undefined,
): ImplementationStageActionGateResult {
  if (!boardContext?.reviewStageEntryReady) {
    return {
      ok: false,
      message:
        "검토단계 진입 조건이 충족되지 않았습니다. 구현단계 완료 및 Preview 준비 후 검토단계로 이동해 주세요.",
    };
  }
  return { ok: true };
}

function integratedStepBoardStatus(
  board: ImplementationExecutionBoardV1,
  step: "refactor_common" | "integrated_review" | "integrated_security" | "final_scm",
): string | undefined {
  return board.integratedRows.find((row) => row.step === step)?.status;
}

function evaluateIntegratedStageActionGate(
  actionId: ImplementationStageActionId,
  boardContext: ImplementationStageBoardGateContext | null | undefined,
): ImplementationStageActionGateResult {
  if (!boardContext) {
    return { ok: false, message: "구현 작업 보드가 준비된 뒤 통합 단계를 실행할 수 있습니다." };
  }
  const { board } = boardContext;
  if (board.summary.blockingUserConfirmation > 0) {
    return { ok: false, message: "사용자 확인이 필요한 작업이 해소된 뒤 통합 단계를 실행할 수 있습니다." };
  }

  switch (actionId) {
    case "RUN_REFACTOR_COMMON": {
      if (!board.taskRows.every((row) => row.currentRole === "completed")) {
        return { ok: false, message: "모든 개발자 작업이 완료된 뒤 리팩토링/공통화를 실행할 수 있습니다." };
      }
      const status = integratedStepBoardStatus(board, "refactor_common");
      if (status !== "ready" && status !== "queued" && status !== "in_progress") {
        return { ok: false, message: "리팩토링/공통화 단계가 아직 실행 가능한 상태가 아닙니다." };
      }
      return { ok: true };
    }
    case "RUN_INTEGRATED_REVIEW": {
      if (integratedStepBoardStatus(board, "refactor_common") !== "done") {
        return { ok: false, message: "리팩토링/공통화가 완료된 뒤 통합 검수를 실행할 수 있습니다." };
      }
      const status = integratedStepBoardStatus(board, "integrated_review");
      if (status !== "ready" && status !== "queued" && status !== "in_progress") {
        return { ok: false, message: "통합 검수 단계가 아직 실행 가능한 상태가 아닙니다." };
      }
      return { ok: true };
    }
    case "RUN_INTEGRATED_SECURITY": {
      if (integratedStepBoardStatus(board, "integrated_review") !== "done") {
        return { ok: false, message: "통합 검수가 완료된 뒤 통합 보안 점검을 실행할 수 있습니다." };
      }
      const status = integratedStepBoardStatus(board, "integrated_security");
      if (status !== "ready" && status !== "queued" && status !== "in_progress") {
        return { ok: false, message: "통합 보안 점검 단계가 아직 실행 가능한 상태가 아닙니다." };
      }
      return { ok: true };
    }
    case "RUN_FINAL_SCM": {
      if (integratedStepBoardStatus(board, "integrated_security") !== "done") {
        return { ok: false, message: "통합 보안 점검이 완료된 뒤 최종 SCM 반영을 실행할 수 있습니다." };
      }
      const status = integratedStepBoardStatus(board, "final_scm");
      if (status !== "ready" && status !== "queued" && status !== "in_progress") {
        return { ok: false, message: "최종 SCM 반영 단계가 아직 실행 가능한 상태가 아닙니다." };
      }
      const wipReadiness = validateFinalScmIntegratedStageReadiness(boardContext.codeAgentWipExecutionV1);
      if (!wipReadiness.ok) {
        return { ok: false, message: wipReadiness.message };
      }
      return { ok: true };
    }
    default:
      return { ok: false, message: "지원하지 않는 통합 단계 action입니다." };
  }
}

/** Outcome of running a stage action after the stage gate passes. */
export type ImplementationStageActionRunResult =
  | Readonly<{ readonly outcome: "executed" }>
  | Readonly<{ readonly outcome: "blocked"; readonly message: string }>
  | Readonly<{ readonly outcome: "no_op"; readonly message?: string }>;

export type ImplementationStageActionRunTimelinePhase = "executed" | "blocked";

export function stageActionRunResultToTimelinePhase(
  runResult: ImplementationStageActionRunResult,
): ImplementationStageActionRunTimelinePhase {
  return runResult.outcome === "executed" ? "executed" : "blocked";
}

/**
 * Policy A — work plan draft generation requires a non-candidate seed with readiness.ready.
 * Aligns with `buildGenerateImplementationWorkPlanDraftResult()` (Quick Design confirm sets lifecycle confirmed).
 */
export function isImplementationSeedReadyForWorkPlanGeneration(
  seed: ImplementationSeedV1 | null | undefined,
): boolean {
  return (
    Boolean(seed?.readiness?.ready) && seed?.lifecycleStatus !== "candidate"
  );
}

export const IMPLEMENTATION_WORK_PLAN_SEED_GATE_BLOCKED_MESSAGE =
  "구현 준비정보가 아직 확정되지 않았습니다. [구현 준비정보 확인] 또는 Quick Design 확정 후 작업안을 생성해 주세요.";

export type ImplementationWorkPlanGenerationReadiness =
  | Readonly<{ readonly ok: true }>
  | Readonly<{
      readonly ok: false;
      readonly reason: "env_not_ready" | "seed_missing" | "seed_candidate" | "seed_not_ready";
      readonly message: string;
    }>;

export function isTaskListReadyForImplementationStageActions(
  state: Pick<
    EffectiveImplementationState,
    "implementationSeedV1" | "implementationTaskListV1" | "envOk"
  >,
): boolean {
  return (
    state.envOk === true &&
    isPlanningReadyForImplementationExecution({
      implementationSeedV1: state.implementationSeedV1,
      implementationTaskListV1: state.implementationTaskListV1,
    })
  );
}

export function evaluateImplementationWorkPlanGenerationReadiness(
  state: Pick<EffectiveImplementationState, "envOk" | "implementationSeedV1">,
): ImplementationWorkPlanGenerationReadiness {
  if (!state.envOk) {
    return {
      ok: false,
      reason: "env_not_ready",
      message: "환경 준비가 완료된 뒤 작업안을 생성할 수 있습니다.",
    };
  }

  const seed = state.implementationSeedV1;
  if (!seed) {
    return {
      ok: false,
      reason: "seed_missing",
      message:
        "구현 준비정보가 아직 없습니다. 기획 산출물을 기준으로 구현 준비정보를 먼저 생성해 주세요.",
    };
  }

  if (seed.lifecycleStatus === "candidate") {
    return {
      ok: false,
      reason: "seed_candidate",
      message: "구현 준비정보가 아직 확정되지 않았습니다. Quick Design 확정 후 작업안을 생성해 주세요.",
    };
  }

  if (!seed.readiness?.ready) {
    return {
      ok: false,
      reason: "seed_not_ready",
      message: "구현 준비정보의 필수 항목을 확정한 뒤 작업안을 생성해 주세요.",
    };
  }

  return { ok: true };
}

export type ImplementationStageActionExecutionResult =
  | Readonly<{
      readonly kind: "handled";
      readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      readonly kind: "blocked";
      readonly message: string;
      readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      readonly kind: "focus_composer";
      readonly message: string;
      readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      readonly kind: "open_env_settings";
      readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      readonly kind: "open_artifacts";
      readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      readonly kind: "show_status";
      readonly intent: "role" | "scm" | "env";
      readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
    }>;

export function buildImplementationStageActionBlockedResult(
  message: string,
  timelineEntries?: readonly RequirementsPromptTimelineEntry[],
): ImplementationStageActionExecutionResult {
  return { kind: "blocked", message, timelineEntries };
}

export function buildImplementationStageActionFocusComposerResult(
  message: string,
  timelineEntries?: readonly RequirementsPromptTimelineEntry[],
): ImplementationStageActionExecutionResult {
  return { kind: "focus_composer", message, timelineEntries };
}

export function buildImplementationStageActionOpenEnvSettingsResult(
  timelineEntries?: readonly RequirementsPromptTimelineEntry[],
): ImplementationStageActionExecutionResult {
  return { kind: "open_env_settings", timelineEntries };
}

export function buildImplementationStageActionOpenArtifactsResult(
  timelineEntries?: readonly RequirementsPromptTimelineEntry[],
): ImplementationStageActionExecutionResult {
  return { kind: "open_artifacts", timelineEntries };
}

export function buildImplementationStageActionShowStatusResult(
  intent: "role" | "scm" | "env",
  timelineEntries?: readonly RequirementsPromptTimelineEntry[],
): ImplementationStageActionExecutionResult {
  return { kind: "show_status", intent, timelineEntries };
}

export function buildImplementationStageActionExecutedTimelineEntry(
  actionId: ImplementationStageActionId,
  source: ImplementationStageActionTimelineSource = "cta",
  runId?: string,
): RequirementsPromptTimelineEntry {
  return buildImplementationStageActionTimelineEntry({
    action: "executed",
    actionId,
    source,
    runId,
  });
}

export function buildImplementationStageActionRoutedTimelineEntry(
  actionId: ImplementationStageActionId,
  source: ImplementationStageActionTimelineSource = "cta",
  runId?: string,
): RequirementsPromptTimelineEntry {
  return buildImplementationStageActionTimelineEntry({
    action: "routed",
    actionId,
    source,
    runId,
  });
}

/** Routed + executed/blocked pair for a completed stage action run (batched persist). */
export function buildStageActionRunCompletionTimelineEntries(
  actionId: ImplementationStageActionId,
  runResult: ImplementationStageActionRunResult,
  source: ImplementationStageActionTimelineSource = "cta",
  runId?: string,
): readonly RequirementsPromptTimelineEntry[] {
  const routed = buildImplementationStageActionRoutedTimelineEntry(actionId, source, runId);
  if (stageActionRunResultToTimelinePhase(runResult) === "executed") {
    return [routed, buildImplementationStageActionExecutedTimelineEntry(actionId, source, runId)];
  }
  const message =
    runResult.outcome === "blocked"
      ? runResult.message
      : runResult.outcome === "no_op"
        ? (runResult.message ?? runResult.outcome)
        : runResult.outcome;
  return [
    routed,
    buildImplementationStageActionTimelineEntry({
      action: "blocked",
      actionId,
      source,
      message,
      runId,
    }),
  ];
}

export function stageActionExecutionResultFromGate(
  gate: ImplementationStageActionGateResult,
  input?: {
    readonly actionId: ImplementationStageActionId;
    readonly source?: ImplementationStageActionTimelineSource;
  },
): ImplementationStageActionExecutionResult | null {
  if (gate.ok) return null;
  const timelineEntries =
    input?.actionId != null
      ? buildStageActionRunCompletionTimelineEntries(
          input.actionId,
          { outcome: "blocked", message: gate.message },
          input.source ?? "cta",
        )
      : undefined;
  return buildImplementationStageActionBlockedResult(gate.message, timelineEntries);
}

/** Gate failure → blocked result; gate pass → null (panel runs the action). */
export function buildImplementationStageActionExecutionDecision(
  actionId: ImplementationStageActionId,
  state: EffectiveImplementationState,
  source: ImplementationStageActionTimelineSource = "cta",
  boardContext?: ImplementationStageBoardGateContext | null,
): ImplementationStageActionExecutionResult | null {
  const gate = evaluateImplementationStageActionGate(actionId, state, boardContext);
  return stageActionExecutionResultFromGate(gate, { actionId, source });
}

export function evaluateImplementationStageActionGate(
  actionId: ImplementationStageActionId,
  state: EffectiveImplementationState,
  boardContext?: ImplementationStageBoardGateContext | null,
): ImplementationStageActionGateResult {
  if (
    actionId === "RUN_REFACTOR_COMMON" ||
    actionId === "RUN_INTEGRATED_REVIEW" ||
    actionId === "RUN_INTEGRATED_SECURITY" ||
    actionId === "RUN_FINAL_SCM"
  ) {
    if (!isTaskListReadyForImplementationStageActions(state)) {
      return { ok: false, message: "구현 작업목록이 준비된 뒤 통합 단계를 실행할 수 있습니다." };
    }
    if (actionId === "RUN_FINAL_SCM") {
      const permission = evaluatePlatformScmPermissionGate(boardContext?.canApplyGit);
      if (!permission.ok) return permission;
    }
    return evaluateIntegratedStageActionGate(actionId, boardContext);
  }

  switch (actionId) {
    case "GENERATE_IMPLEMENTATION_TASK_LIST": {
      const readiness = deriveImplementationTaskListReadiness({
        implementationSeedV1: state.implementationSeedV1,
        implementationTaskListV1: state.implementationTaskListV1,
      });
      if (readiness.status === "task_list_exists") {
        return { ok: true };
      }
      if (!readiness.canGenerateTaskList) {
        return { ok: false, message: readiness.message };
      }
      return { ok: true };
    }
    case "GENERATE_IMPLEMENTATION_WORK_PLAN": {
      const readiness = evaluateImplementationWorkPlanGenerationReadiness(state);
      if (!readiness.ok) {
        // Backward compatible copy for existing seed-gate UX, while removing designOk hard-block.
        if (readiness.reason === "seed_candidate") {
          return { ok: false, message: IMPLEMENTATION_WORK_PLAN_SEED_GATE_BLOCKED_MESSAGE };
        }
        return { ok: false, message: readiness.message };
      }
      return { ok: true };
    }
    case "CONFIRM_IMPLEMENTATION_WORK_PLAN":
      return canConfirmImplementationWorkPlanFromEffectiveState(state);
    case "REVIEW_DB_INTEGRATION":
    case "GENERATE_DATA_MODEL_DRAFT":
    case "CONFIRM_MOCK_IMPLEMENTATION": {
      if (isTaskListReadyForImplementationStageActions(state)) {
        return { ok: true };
      }
      const readiness = evaluateImplementationWorkPlanGenerationReadiness(state);
      if (!readiness.ok) {
        if (readiness.reason === "seed_candidate") {
          return { ok: false, message: IMPLEMENTATION_WORK_PLAN_SEED_GATE_BLOCKED_MESSAGE };
        }
        return { ok: false, message: readiness.message };
      }
      return { ok: true };
    }
    case "OPEN_ENV_SETTINGS":
    case "SHOW_ARTIFACTS":
    case "SHOW_ROLE_CHECK":
    case "SHOW_SCM_CHECK":
    case "SHOW_ENV_CHECK":
    case "EDIT_IMPLEMENTATION_SCOPE":
    case "RESOLVE_USER_CONFIRMATION":
    case "SHOW_USER_CONFIRMATION_ITEMS":
      return { ok: true };
    case "MOVE_TO_REVIEW_STAGE": {
      if (!boardContext) {
        return { ok: false, message: "구현 작업 보드가 준비된 뒤 검토단계로 이동할 수 있습니다." };
      }
      if (!isImplementationReadyForReviewStage(boardContext)) {
        return {
          ok: false,
          message:
            "모든 작업·통합 단계가 완료되고 Preview가 준비된 뒤 검토단계로 이동할 수 있습니다.",
        };
      }
      return { ok: true };
    }
    case "REQUEST_TASK_REWORK": {
      if (!isTaskListReadyForImplementationStageActions(state)) {
        return { ok: false, message: "구현 작업목록이 준비된 뒤 재작업 요청을 등록할 수 있습니다." };
      }
      if (!boardContext) {
        return { ok: false, message: "구현 작업 보드가 준비된 뒤 재작업 요청을 등록할 수 있습니다." };
      }
      return { ok: true };
    }
    case "REVIEW_STAGE_OPEN_PREVIEW":
    case "REVIEW_STAGE_START_USER_TEST":
    case "REVIEW_STAGE_ADD_FEEDBACK":
    case "REVIEW_STAGE_VIEW_FEEDBACK":
    case "REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION":
    case "REVIEW_STAGE_COMPLETE_TEST":
      return evaluateReviewStageActionGate(boardContext);
    case "RUN_REVIEWER_CHECK":
    case "RUN_SECURITY_CHECK": {
      if (!isTaskListReadyForImplementationStageActions(state)) {
        return { ok: false, message: "구현 작업목록이 준비된 뒤 점검을 실행할 수 있습니다." };
      }
      return { ok: true };
    }
    case "REQUEST_CODE_AGENT_WIP": {
      const activeRun = evaluateActiveImplementationExecutionGate(actionId, boardContext);
      if (activeRun) return activeRun;
      if (!state.envOk) {
        return { ok: false, message: "환경 준비가 완료된 뒤 Code Agent WIP 작업을 요청할 수 있습니다." };
      }
      if (isTaskListReadyForImplementationStageActions(state)) {
        return { ok: true };
      }
      if (state.implementationTaskPlanV1) {
        return { ok: true };
      }
      return {
        ok: false,
        message: "구현 작업목록이 아직 없습니다. 먼저 구현 작업목록을 생성해 주세요.",
      };
    }
    case "REQUEST_CURSOR_BRIDGE_EXECUTION": {
      if (!boardContext?.codeAgentWipExecutionV1) {
        return {
          ok: false,
          message: "WIP 초안이 없습니다. Task 단위 [AI 개발자 실행 요청]을 사용해 주세요.",
        };
      }
      return { ok: true };
    }
    case "REQUEST_TASK_CURSOR_EXECUTION": {
      const activeRun = evaluateActiveImplementationExecutionGate(actionId, boardContext);
      if (activeRun) return activeRun;
      if (!state.envOk) {
        return {
          ok: false,
          message: "환경설정에서 [연결 테스트]를 완료한 뒤 AI 개발자 실행을 요청할 수 있습니다.",
        };
      }
      if (!isTaskListReadyForImplementationStageActions(state)) {
        return { ok: false, message: "구현 작업목록이 준비된 뒤 AI 개발자 실행을 요청할 수 있습니다." };
      }
      const planningGate = evaluateImplementationPlanningExecutionGate({
        codeTaskPlan: boardContext?.implementationCodeTaskPlanV1,
        cursorWorkItems: boardContext?.cursorWorkItemsV1,
        preflightSummary: boardContext?.implementationWorkItemPreflightSummaryV1,
        codeTaskQualityGate: boardContext?.implementationCodeTaskQualityGateV1,
      });
      if (!planningGate.ok) {
        return { ok: false, message: planningGate.message ?? IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE };
      }
      return { ok: true };
    }
    case "START_IMPLEMENTATION_QUICK_RUN": {
      const activeRun = evaluateActiveImplementationExecutionGate(actionId, boardContext);
      if (activeRun) return activeRun;
      if (!state.envOk) {
        return {
          ok: false,
          message: "환경설정에서 [연결 테스트]를 완료한 뒤 Quick 실행을 시작할 수 있습니다.",
        };
      }
      if (!isTaskListReadyForImplementationStageActions(state)) {
        return { ok: false, message: "구현 작업목록이 준비된 뒤 Quick 실행을 시작할 수 있습니다." };
      }
      const planningGate = evaluateImplementationPlanningExecutionGate({
        codeTaskPlan: boardContext?.implementationCodeTaskPlanV1,
        cursorWorkItems: boardContext?.cursorWorkItemsV1,
        preflightSummary: boardContext?.implementationWorkItemPreflightSummaryV1,
        codeTaskQualityGate: boardContext?.implementationCodeTaskQualityGateV1,
      });
      if (!planningGate.ok) {
        return { ok: false, message: planningGate.message ?? IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE };
      }
      return { ok: true };
    }
    case "CHECK_TASK_CURSOR_STATUS":
    case "VERIFY_TASK_CURSOR_GITHUB": {
      if (!boardContext?.taskCursorExecutionV1) {
        return { ok: false, message: "Task Cursor 실행 상태가 없습니다. [AI 개발자 실행 요청]을 먼저 실행해 주세요." };
      }
      return { ok: true };
    }
    case "RUN_PLATFORM_SCM_MERGE": {
      const permission = evaluatePlatformScmPermissionGate(boardContext?.canApplyGit);
      if (!permission.ok) return permission;
      const readiness = validatePlatformScmMergeStepReadiness(boardContext?.codeAgentWipExecutionV1);
      if (!readiness.ok) {
        return { ok: false, message: readiness.message };
      }
      return { ok: true };
    }
    case "CONFIRM_QUICK_DESIGN_FOR_IMPLEMENTATION":
    case "CREATE_IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT":
    case "START_QUICK_DESIGN_FROM_IMPLEMENTATION":
    case "RETURN_TO_PLANNING_STAGE":
      return { ok: true };
    default:
      return { ok: false, message: `지원하지 않는 구현단계 action입니다: ${actionId}` };
  }
}

import {
  IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_INTERNAL_TYPE,
  IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE,
} from "@/lib/prototype/implementationOrchestrationSummary";
import { PROTOTYPE_EXECUTION_DERIVED_INTERNAL_TYPE } from "@/lib/prototype/prototypeExecutionSingleChatTypes";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type {
  RequirementsPromptTimelineEntry,
  RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import type { PrototypeExecutionSingleChatV1 } from "@/lib/prototype/prototypeExecutionSingleChatTypes";
import { isImplementationTimelineResetAction } from "@/lib/requirements/promptTimelineActionCatalog";
import {
  isExecutionLogTimelineEntry,
  isPersistentExecutionLogTimelineEntry,
} from "@/lib/prototype/promptTimelineExecutionLogTabs";

/** 기획 단계 대화 초기화 확인 메시지(구현 파생·실행 기록 동시 삭제 안내). */
export const PLANNING_RESET_CONVERSATION_CONFIRM_MESSAGE =
  "대화 내역을 모두 삭제하고 서비스 기획을 다시 시작할까요?\n\n" +
  "기획단계를 초기화하면 기존 기획 산출물을 기반으로 만들어진 구현 준비 데이터와 구현 실행 기록이 함께 초기화됩니다.\n" +
  "구현 Seed, Task/WorkItem/CodeTask, Cursor 실행 상태, GitHub 확인 기록, 실행 큐, 구현 로그가 삭제됩니다.\n" +
  "환경설정과 Git/Code Agent 연결 정보는 유지됩니다.\n\n" +
  "이 작업은 되돌릴 수 없습니다.";

/** 구현 단계 툴바 「초기화」 확인 — 기획 산출물·슬롯은 유지 */
export const IMPLEMENTATION_RESET_CONVERSATION_CONFIRM_MESSAGE =
  "구현 단계에서 생성된 데이터를 모두 초기화할까요?\n\n" +
  "구현 대화, Seed, 작업안·Task/CodeTask, Cursor 실행, GitHub 확인 기록, 실행 큐, Runtime DB job, 구현 로그가 삭제됩니다.\n" +
  "초기화 후 기획 산출물 기준으로 구현 Seed·작업목록·CodeTask 계획을 다시 생성합니다.\n" +
  "기획 산출물·Quick Design·서비스 흐름은 유지됩니다.\n" +
  "환경설정과 Git/Code Agent 연결 정보는 유지됩니다.\n\n" +
  "이 작업은 되돌릴 수 없습니다.";

export const PLANNING_RESET_CLEARED_IMPLEMENTATION_TRACE_ACTION =
  "planning_reset_cleared_implementation_derivatives" as const;

const IMPLEMENTATION_INTERNAL_TYPE_PREFIXES = [
  "IMPLEMENTATION_",
  "CODE_AGENT_WIP_",
  "SCM_OFFICIAL_COMMIT_",
] as const;

const IMPLEMENTATION_TIMELINE_ACTION_EXACT = new Set([
  "implementation_bootstrap_lead_developer_summary",
  "implementation_role_check_summary_ready",
  "implementation_entry_reference_artifacts_checked",
  "implementation_seed_evaluated",
  "planning_implementation_seed_evaluated",
  "planning_implementation_seed_candidate_generated",
  "planning_implementation_seed_confirmed",
  "implementation_seed_used_for_work_plan_draft",
  "implementation_work_plan_draft_generated",
  "implementation_work_plan_draft_confirmed",
  "implementation_slots_built",
  "implementation_artifacts_derived",
  "code_agent_wip_requested",
  "code_agent_wip_committed",
  "developer_approved",
  "scm_official_commit_pending",
  PLANNING_RESET_CLEARED_IMPLEMENTATION_TRACE_ACTION,
]);

const IMPLEMENTATION_TIMELINE_ACTION_PREFIXES = [
  "implementation_",
  "planning_implementation_seed_",
  "code_agent_wip_",
  "scm_official_commit_",
] as const;

const IMPLEMENTATION_PROJECT_ARTIFACT_TYPE_PREFIXES = ["implementation-"] as const;

/** merge 시 구현 파생 state를 명시적으로 비울 때 사용. */
export const DERIVED_IMPLEMENTATION_STATE_NULL_PATCH: Pick<
  RequirementsStateJson,
  | "prototypeExecutionSingleChatV1"
  | "prototypeWorkspaceChatV1"
  | "prototypeWorkspaceTimelineCardsV1"
  | "implementationTaskPlanV1"
  | "cursorWorkItemsV1"
  | "implementationSlotsV1"
  | "implementationDbStrategyV1"
  | "implementationSeedV1"
  | "implementationWorkPlanDraftV1"
  | "implementationCodeTaskPlanV1"
  | "implementationWorkItemPreflightSummaryV1"
  | "codeTaskPromptContextMapV1"
  | "codeAgentWipExecutionV1"
> = {
  prototypeExecutionSingleChatV1: null,
  prototypeWorkspaceChatV1: null,
  prototypeWorkspaceTimelineCardsV1: null,
  implementationTaskPlanV1: null,
  cursorWorkItemsV1: null,
  implementationSlotsV1: null,
  implementationDbStrategyV1: null,
  implementationSeedV1: null,
  implementationWorkPlanDraftV1: null,
  implementationCodeTaskPlanV1: null,
  implementationWorkItemPreflightSummaryV1: null,
  codeTaskPromptContextMapV1: null,
  codeAgentWipExecutionV1: null,
};

/** 레거시/미타입 JSON 키 — merge·DB 잔존 방지용 명시 null */
const LEGACY_DERIVED_IMPLEMENTATION_NULL_FIELDS = {
  cursorWipExecutionV1: null,
  codeAgentWorkItemsV1: null,
  implementationRoleCheckShownV1: null,
} as const;

/** 구현 단계 대화 초기화 — 실행 로그·런타임 실행 상태까지 비움(기획 초기화와 분리) */
export const IMPLEMENTATION_SESSION_RESET_NULL_PATCH = {
  ...DERIVED_IMPLEMENTATION_STATE_NULL_PATCH,
  implementationTaskListV1: null,
  implementationTaskExecutionStateV1: null,
  implementationIntegratedExecutionStateV1: null,
  implementationExecutionBoardStateV1: null,
  implementationReviewStageReadyV1: null,
  implementationUserFeedbackPatchesV1: null,
  implementationStageActionRunLogV1: null,
  implementationCodeTaskQualityGateV1: null,
  implementationCodeTaskExecutionFeedbackV1: null,
  implementationQualityGateResultsV1: null,
  taskCursorExecutionV1: null,
  taskCursorExecutionHistoryV1: null,
  implementationAutoQualityGateV1: null,
  implementationAutoQualityGateHistoryV1: null,
  implementationQuickRunV1: null,
  implementationExecutionUnitsV1: null,
  implementationIntegrationStepsV1: null,
  implementationExecutionJobsV1: null,
  codeTaskExecutionRunsV1: null,
  implementationPreviewScopeV1: null,
  implementationPreviewRuntimeV1: null,
  codeTaskIntegrationPlanV1: null,
  implementationRuntimeStateV1: null,
  implementationRuntimeUiSnapshotV1: null,
  reviewStageUserTestSessionV1: null,
  reviewStageUserFeedbackListV1: null,
} as const;

/** persisted requirementsStateJson에 구현 실행·준비 세션이 남아 있는지 */
export function hasActiveImplementationExecutionSession(
  state: Pick<
    RequirementsStateJson,
    | "implementationSeedV1"
    | "implementationTaskListV1"
    | "implementationCodeTaskPlanV1"
    | "implementationTaskPlanV1"
    | "implementationWorkPlanDraftV1"
    | "cursorWorkItemsV1"
    | "codeTaskExecutionRunsV1"
    | "taskCursorExecutionV1"
    | "implementationRuntimeUiSnapshotV1"
    | "implementationExecutionJobsV1"
    | "implementationQuickRunV1"
    | "implementationExecutionUnitsV1"
    | "implementationIntegrationStepsV1"
    | "implementationPreviewScopeV1"
    | "implementationPreviewRuntimeV1"
    | "codeTaskIntegrationPlanV1"
    | "prototypeExecutionSingleChatV1"
    | "codeAgentWipExecutionV1"
  >,
): boolean {
  if (state.implementationSeedV1) return true;
  if ((state.implementationTaskListV1?.tasks?.length ?? 0) > 0) return true;
  if ((state.implementationCodeTaskPlanV1?.tasks?.length ?? 0) > 0) return true;
  if (state.implementationTaskPlanV1) return true;
  if (state.implementationWorkPlanDraftV1) return true;
  if ((state.cursorWorkItemsV1?.length ?? 0) > 0) return true;
  if ((state.codeTaskExecutionRunsV1?.length ?? 0) > 0) return true;
  if (state.taskCursorExecutionV1) return true;
  if (state.implementationRuntimeUiSnapshotV1) return true;
  if ((state.implementationExecutionJobsV1?.length ?? 0) > 0) return true;
  if (state.implementationQuickRunV1) return true;
  if ((state.implementationExecutionUnitsV1?.units?.length ?? 0) > 0) return true;
  if ((state.implementationIntegrationStepsV1?.steps?.length ?? 0) > 0) return true;
  if (state.implementationPreviewScopeV1) return true;
  if (state.implementationPreviewRuntimeV1) return true;
  if (state.codeTaskIntegrationPlanV1) return true;
  if ((state.prototypeExecutionSingleChatV1?.messages?.length ?? 0) > 0) return true;
  if (state.codeAgentWipExecutionV1) return true;
  return false;
}

export function isImplementationSingleChatMessage(message: RequirementsMessage): boolean {
  const internalType = String(message.meta.internalType ?? "");
  if (internalType === IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_INTERNAL_TYPE) return true;
  if (message.meta.serviceDesignStage === "implementation") return true;
  if ((message.meta as { mode?: string }).mode === "implementation") return true;
  if (internalType === PROTOTYPE_EXECUTION_DERIVED_INTERNAL_TYPE) return true;
  if (internalType === IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE) return true;
  if (IMPLEMENTATION_INTERNAL_TYPE_PREFIXES.some((p) => internalType.startsWith(p))) return true;
  if (internalType.startsWith("IMPLEMENTATION_TASK_PLAN_")) return true;
  return false;
}

export function resetImplementationSingleChatMessages(
  chat: PrototypeExecutionSingleChatV1 | null | undefined,
): PrototypeExecutionSingleChatV1 | null {
  if (!chat) return null;
  const kept = (chat.messages ?? []).filter((m) => !isImplementationSingleChatMessage(m));
  if (kept.length === 0 && !(chat.slots?.length ?? 0) && !Object.keys(chat.answers ?? {}).length) {
    return null;
  }
  return {
    ...chat,
    messages: kept,
    promptTimeline: filterImplementationPromptTimeline(chat.promptTimeline ?? []),
  };
}

export function isImplementationPromptTimelineEntry(
  entry: RequirementsPromptTimelineEntry,
): boolean {
  if (entry.orchestrationTraceGroup === "implementation_orchestration") return true;
  if (entry.workspaceScreenKey === "prototype_execution") return true;
  if (entry.stage === "implementation" || entry.stageGroup === "구현") return true;
  const action = String(entry.action ?? "").trim();
  if (isImplementationTimelineResetAction(action)) return true;
  const responseText = String(entry.responseText ?? "");
  if (/\bmode=implementation\b/.test(responseText)) return true;
  if (/\btype=implementation[\w_]*\b/.test(responseText)) return true;
  if (/\btype=planning_implementation_seed[\w_]*\b/.test(responseText)) return true;
  return false;
}

export type FilterImplementationPromptTimelineOptions = Readonly<{
  /** 구현 단계 초기화 시 런타임 실행 로그(task_cursor_* 등)도 제거 */
  readonly clearExecutionLog?: boolean;
}>;

export function filterImplementationPromptTimeline(
  entries: readonly RequirementsPromptTimelineEntry[],
  options?: FilterImplementationPromptTimelineOptions,
): RequirementsPromptTimelineEntry[] {
  return (entries ?? []).filter((entry) => {
    if (options?.clearExecutionLog) {
      if (isExecutionLogTimelineEntry(entry)) return false;
      return !isImplementationPromptTimelineEntry(entry);
    }
    if (isPersistentExecutionLogTimelineEntry(entry)) return true;
    return !isImplementationPromptTimelineEntry(entry);
  });
}

export function isImplementationProjectArtifact(artifact: ProjectArtifact): boolean {
  const sourceStage = String(artifact.sourceStage ?? "").trim().toLowerCase();
  if (sourceStage === "implementation" || sourceStage.includes("prototype_execution")) return true;
  const type = String(artifact.type ?? "").trim().toLowerCase();
  if (IMPLEMENTATION_PROJECT_ARTIFACT_TYPE_PREFIXES.some((p) => type.startsWith(p))) return true;
  return false;
}

export function filterImplementationProjectArtifacts(
  artifacts: readonly ProjectArtifact[] | null | undefined,
): ProjectArtifact[] {
  return (artifacts ?? []).filter((a) => !isImplementationProjectArtifact(a));
}

export function appendPlanningResetClearedImplementationTrace(
  timeline: readonly RequirementsPromptTimelineEntry[],
  nowIso: string,
): RequirementsPromptTimelineEntry[] {
  const action = PLANNING_RESET_CLEARED_IMPLEMENTATION_TRACE_ACTION;
  if ((timeline ?? []).some((e) => e.action === action)) {
    return [...timeline];
  }
  const trace: RequirementsPromptTimelineEntry = {
    stage: "requirements",
    stageGroup: "기획",
    workspaceScreenKey: "requirements",
    action,
    source: "system",
    responseText: [
      "type=planning_reset_cleared_implementation_derivatives",
      "mode=planning",
      "cleared=[requirementsStateJson downstream keys,implementation_runtime_db_jobs_queue_runs_task_cursor_jobs,github_remote_not_deleted]",
    ].join(" "),
    createdAt: nowIso,
  };
  return [...(timeline ?? []), trace];
}

export type ClearDerivedImplementationStateOptions = Readonly<{
  readonly nowIso?: string;
  /** 기획 초기화 직후 reset trace 1건 기록 */
  readonly appendPlanningResetTrace?: boolean;
  /**
   * true면 SingleChat을 null로 비움(기본).
   * false면 implementation 메시지만 필터(부분 보존).
   */
  readonly nullSingleChat?: boolean;
  /** true면 promptTimeline의 실행 로그 항목도 제거(구현 단계 초기화) */
  readonly clearExecutionLog?: boolean;
  /** true면 구현 실행 기록·런타임 상태까지 IMPLEMENTATION_SESSION_RESET_NULL_PATCH 적용 */
  readonly clearRuntimeState?: boolean;
}>;

/**
 * requirementsStateJson에서 구현 단계 파생 데이터를 제거한다.
 * 기획 초기화·구현 초기화 공통.
 */
export function clearDerivedImplementationStateFromRequirementsJson(
  state: RequirementsStateJson,
  options: ClearDerivedImplementationStateOptions = {},
): RequirementsStateJson {
  const nullSingleChat = options.nullSingleChat !== false;
  const filteredTimeline = filterImplementationPromptTimeline(state.promptTimeline ?? [], {
    clearExecutionLog: options.clearExecutionLog,
  });
  const filteredArtifacts = filterImplementationProjectArtifacts(state.projectArtifacts);

  let promptTimeline = filteredTimeline;
  if (options.appendPlanningResetTrace && options.nowIso) {
    promptTimeline = appendPlanningResetClearedImplementationTrace(promptTimeline, options.nowIso);
  }

  const prototypeExecutionSingleChatV1 = nullSingleChat
    ? null
    : resetImplementationSingleChatMessages(state.prototypeExecutionSingleChatV1);

  const implementationPatch = options.clearRuntimeState
    ? IMPLEMENTATION_SESSION_RESET_NULL_PATCH
    : DERIVED_IMPLEMENTATION_STATE_NULL_PATCH;

  return {
    ...state,
    ...implementationPatch,
    ...LEGACY_DERIVED_IMPLEMENTATION_NULL_FIELDS,
    prototypeExecutionSingleChatV1,
    projectArtifacts: filteredArtifacts,
    promptTimeline,
  };
}

/** @alias clearDerivedImplementationStateFromRequirementsJson — 프롬프트/문서 명칭 호환 */
export const resetDerivedImplementationStateFromRequirementsJson =
  clearDerivedImplementationStateFromRequirementsJson;

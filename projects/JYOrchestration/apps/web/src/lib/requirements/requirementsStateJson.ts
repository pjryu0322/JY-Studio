import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import { parseFeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { FeatureDetailSlotsV1 } from "@/lib/requirements/featureDetailSlots";
import { parseFeatureDetailSlotsV1 } from "@/lib/requirements/featureDetailSlots";
import {
  parseRequirementsIntentOrchestrationV1,
  type RequirementsIntentOrchestrationV1,
} from "@/lib/requirements/requirementsIntentOrchestrationWire";
import { recoverRequirementsIntentOrchestration } from "@/lib/requirements/requirementsOrchestrationRecovery";
import { softMigrateLegacyRoleSlotsArtifact } from "@/lib/featurePlanning/featurePlanningLegacyRoleSlots";
import type { FeaturePlanningWorkspaceChatV1 } from "@/lib/featurePlanning/featurePlanningWorkspaceChat";
import { parseFeaturePlanningWorkspaceChatV1 } from "@/lib/featurePlanning/featurePlanningWorkspaceChat";
import type { RequirementsPromptPresenterView } from "@/lib/requirements/promptPresenter";
import type { IdeationDeliverableAsset, IdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";
import { parseDeliverableAssetsFromState } from "@/lib/requirements/ideationDeliverables";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import { parseArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import { parseProjectArtifactsFromState } from "@/lib/requirements/projectArtifactTypes";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import { parseCodeAgentWipExecutionFromState } from "@/lib/prototype/codeAgentWipExecutionStateWire";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import {
  parseTaskCursorExecutionHistoryV1,
  parseTaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import {
  parseCursorWorkItemsV1,
  parseImplementationTaskPlanV1,
} from "@/lib/prototype/implementationTaskPlanStateWire";
import type { ImplementationDbStrategyV1 } from "@/lib/prototype/implementationDbStrategy";
import { parseImplementationDbStrategyV1 } from "@/lib/prototype/implementationDbStrategy";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import { parseImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationWorkItemPreflightSummaryV1 } from "@/lib/prototype/implementationPlanningReadiness";
import { parseImplementationWorkItemPreflightSummaryV1 } from "@/lib/prototype/implementationPlanningReadiness";
import type { ImplementationCodeTaskQualityGateV1 } from "@/lib/prototype/implementationCodeTaskQualityGate";
import { parseImplementationCodeTaskQualityGateV1 } from "@/lib/prototype/implementationCodeTaskQualityGate";
import type { ImplementationCodeTaskExecutionFeedbackV1 } from "@/lib/prototype/implementationCodeTaskExecutionFeedback";
import { parseImplementationCodeTaskExecutionFeedbackV1 } from "@/lib/prototype/implementationCodeTaskExecutionFeedback";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import {
  parseImplementationAutoQualityGateHistoryV1,
  parseImplementationAutoQualityGateV1,
} from "@/lib/prototype/implementationAutoQualityGate";
import type { ImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import { parseImplementationExecutionJobsV1 } from "@/lib/prototype/implementationExecutionJob";
import type { ImplementationExecutionJobV1 } from "@/lib/prototype/implementationExecutionJob";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseCodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import type { CodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import {
  parseImplementationRuntimeStateV1,
  type ImplementationRuntimeStateV1,
} from "@/lib/prototype/implementationRuntimeState";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
import { parseImplementationQualityGateResultsV1 } from "@/lib/prototype/implementationQualityGate";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import { parseImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationIntegratedExecutionStateV1 } from "@/lib/prototype/implementationIntegratedExecutionState";
import { parseImplementationIntegratedExecutionStateV1 } from "@/lib/prototype/implementationIntegratedExecutionState";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import { parseImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationReviewStageReadyV1 } from "@/lib/prototype/implementationReviewStageReady";
import { parseImplementationReviewStageReadyV1 } from "@/lib/prototype/implementationReviewStageReady";
import type { ReviewStageUserFeedbackListV1 } from "@/lib/prototype/reviewStageUserFeedback";
import { parseReviewStageUserFeedbackListV1 } from "@/lib/prototype/reviewStageUserFeedback";
import type { ReviewStageUserTestSessionV1 } from "@/lib/prototype/reviewStageUserTest";
import { parseReviewStageUserTestSessionV1 } from "@/lib/prototype/reviewStageUserTest";
import type { ImplementationWorkPlanDraftV1 } from "@/lib/prototype/implementationWorkPlanDraft";
import { parseImplementationWorkPlanDraftV1 } from "@/lib/prototype/implementationWorkPlanDraft";
import {
  parseImplementationUserFeedbackPatchesV1,
  type ImplementationUserFeedbackPatchV1,
} from "@/lib/prototype/implementationUserFeedback";
import {
  coerceImplementationStageActionRunLogV1,
  type ImplementationStageActionRunLogV1,
} from "@/lib/prototype/implementationStageActionRun";
import type { ImplementationSlotsV1 } from "@/lib/prototype/implementationSlots";
import { parseImplementationSlotsV1 } from "@/lib/prototype/implementationSlots";
import { parsePrototypeExecutionSingleChatV1 } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { PrototypeExecutionSingleChatV1 } from "@/lib/prototype/prototypeExecutionSingleChatTypes";
import type { FastPlanAssumption, FastPlanGenerationStateV1 } from "@/lib/requirements/fastPlanGenerationTypes";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import { parseFastPlanDraftSlotCandidatePatchV1 } from "@/lib/requirements/fastPlanDraftSlotPatch";
import type { PlatformMemberDraft, PlatformMemberRun } from "@/lib/platform-orchestration/types";
import type { ProblemInterviewSlot, ProblemInterviewState } from "@/lib/requirements/problemInterview";
import {
  parseRequirementsOrganizeContextV1,
  type RequirementsOrganizeContextV1,
} from "@/lib/requirements/requirementsOrganizeContext";
import type { ActiveKnowledgePackRef } from "@/lib/overlay/activeKnowledgePackRef";
import type { PromptAssemblyMetadataContract } from "@/lib/overlay/contextAssemblyContract";
import type { OverlayRuntimePolicyHintsWire } from "@/lib/overlay/overlayPolicy";
import type { OverlayPolicyWarning } from "@/lib/overlay/overlayPolicyWarning";
import type { OverlaySelectedContextRef } from "@/lib/overlay/overlayContextSelection";
import type { OverlayContextBudgetMetadata } from "@/lib/overlay/overlayContextBudget";
import type { OverlayConflictWarning } from "@/lib/overlay/overlayConflictDetection";
import type { OverlayOrchestrationDecisionTrace } from "@/lib/overlay/overlayOrchestrationDecisionTrace";
import type { OverlayAssemblyPlanItem } from "@/lib/overlay/overlayContextAssemblyPlan";
import type { OverlayPruningCandidate } from "@/lib/overlay/overlayContextPruning";
import type {
  HarnessPromptAssemblyPreview,
  HarnessPromptPreviewDiff,
} from "@/lib/harness/promptAssembly/harnessPromptAssemblyTypes";
import type { KnowledgeActivationPlan } from "@/lib/harness/knowledgeActivation/knowledgeActivationPolicyTypes";
import type { MemoryRuntimePlan } from "@/lib/harness/memoryRuntime/memoryRuntimeTypes";
import type { ExecutionRoutingPlan } from "@/lib/harness/executionRouting/executionCapabilityTypes";
import type { ExecutionRoutingSafetyReport } from "@/lib/harness/executionRouting/executionRoutingSafetyTypes";
import type { ReviewSecurityHarnessPlan } from "@/lib/harness/reviewSecurity/reviewSecurityHarnessTypes";
import type {
  RemediationLoopPlan,
  ReviewSecurityIssuePlanningReport,
} from "@/lib/harness/reviewSecurity/reviewSecurityIssueTypes";
import { coerceRequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";
import { parseRequirementsSingleChatOrchestrationV1 } from "@/lib/requirements/singleChatOrchestrationStateWire";
import {
  parseAlternativeProposalPayloadWire,
  type AlternativeProposalPayloadWire,
} from "@/lib/requirements/serviceFlowAlternativeProposalPayload";

function unwrapDbJsonField(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const s = raw.trim();
  if (!s) return null;
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

/**
 * `Project.requirementsStateJson` — 클라이언트·서버 공통 형태(필드 추가 시 하위 호환 유지).
 * Overlay: **Project Orchestration Memory** — 슬롯·오케스트레이션 상태 등 프로젝트 단위 “기억” JSON.
 * (`docs/OVERLAY_ARCHITECTURE_CONTRACTS.md`)
 */
export type RequirementsOrganizePlannerState = {
  requestedType: IdeationDeliverableType;
  requestedLabel?: string;
  pendingQuestions: string[];
  requiredSlots?: string[] | null;
  slotStatus?: Record<string, "filled" | "missing"> | null;
  lastAnalyzerResult?: {
    ready: boolean;
    message: string;
    questions: string[];
    analyzedAt: string;
  } | null;
};

/** promptTimeline에 기록되는 참여 Agent (SingleChat·설정 UI와 동기) */
export type RequirementsPromptTimelineAgentRef = {
  readonly source?: string;
  readonly catalogKey?: string;
  readonly displayName?: string;
  readonly aiOrchestrationRole?: string | null;
  readonly orchestrationStage?: string | null;
  readonly aiProvider?: string | null;
  readonly aiAgentKey?: string | null;
  readonly aiModelOverride?: string | null;
  readonly enginePreference?: string | null;
};

export type AiPlannerPromptModeWire = "pre_project_brainstorm" | "project_single_chat";

export type RequirementsPromptTimelineContextBlocks = {
  readonly explorationTopic?: readonly string[];
  readonly userConstraints?: readonly string[];
  readonly discardedDirections?: readonly string[];
  readonly openOptions?: readonly string[];
  readonly confirmedProjectDirection?: readonly string[];
  readonly confirmedConstraints?: readonly string[];
  readonly excludedScope?: readonly string[];
  readonly openItems?: readonly string[];
  readonly nextDeliverableCandidates?: readonly string[];
};

export type RequirementsPromptTimelineEntry = {
  stage: "ideation" | "service-flow" | "feature-planning" | string;
  /** Pre-project 브레인스토밍 vs 프로젝트 SingleChat */
  aiPlannerMode?: AiPlannerPromptModeWire;
  contextBlocks?: RequirementsPromptTimelineContextBlocks;
  domainContextInjected?: readonly string[];
  domainContextReason?: string;
  roomId?: string;
  /** 사용자 표시 절차 그룹(예: 서비스 기획) */
  stageGroup?: string;
  workspaceScreenKey?: string;
  selectedAgents?: readonly RequirementsPromptTimelineAgentRef[];
  action: string;
  aiMember?: string;
  source: "llm" | "fallback" | "system" | string;
  promptText?: string;
  responseText?: string;
  error?: string;
  fallbackText?: string;
  model?: string | null;
  /** bootstrap 등: 실제 Chat Completions에 사용된 모델(환경 변수 기준일 수 있음) */
  actualModel?: string | null;
  /** 워크스페이스 AI 멤버에 설정된 모델 오버라이드(호출에 반영되지 않을 수 있음) */
  configuredModelOverride?: string | null;
  provider?: string | null;
  createdAt: string;
  /** SingleChat 내부 오케스트레이션 메타(UX 비노출) */
  routingDecision?: string;
  /** Phase 3 orchestration timeline grouping */
  orchestrationTraceGroup?: string;
  matchedSlots?: readonly string[];
  updatedSlots?: readonly string[];
  /** 명시적 fallback 플래그(source와 함께 사용) */
  fallback?: boolean;
  orchestratorAgent?: string;
  delegatedAgents?: readonly string[];
  /** 실제 LLM 호출 순서(라우트·전문가·병합 등) */
  executedAgents?: readonly string[];
  staleSlots?: readonly string[];
  confirmedSlots?: readonly string[];
  candidateSlots?: readonly string[];
  slotDependenciesChanged?: boolean;
  /** Orchestration runtime phase (1..5) */
  currentPhase?: 1 | 2 | 3 | 4 | 5;
  /** Next/actual owner agent for next question (planner/analyst/architect/designer/reviewer/security) */
  nextOwnerAgent?: string;
  /** Diagnostic: resolved conversation owner */
  conversationOwner?: string;
  /** Persistence: previous conversation owner */
  previousConversationOwner?: string;
  /** Persistence: active conversation owner (sticky) */
  activeConversationOwner?: string;
  /** Persistence: why owner was persisted / switched */
  ownerPersistenceReason?: string;
  /** Persistence: remaining sticky turns */
  stickyTurnsRemaining?: number;
  /** Diagnostic: who generated the next question */
  questionGeneratedBy?: string;
  /** Diagnostic: why ownership was chosen */
  ownershipReason?: string;
  /** Diagnostic: dominant decision axis */
  decisionAxis?: string;
  /** Persistence: previous decision axis */
  previousDecisionAxis?: string;
  /** Persistence: decision axis source */
  decisionAxisSource?: "explicitMention" | "currentMessage" | "previousContext" | "fallback" | string;
  /** UI: context hint subtitle (speaker suffix) */
  contextHint?: string;
  /** UI: context hint source */
  contextHintSource?: "owner_axis" | "owner_fallback" | "axis_only" | "unknown" | string;
  /** UI: owner/axis mismatch detected */
  ownerAxisMismatch?: boolean;
  /** UI: final resolved speaker line */
  resolvedSpeaker?: string;
  /** UI: how speaker was resolved */
  resolvedSpeakerSource?: string;
  /** Diagnostic: merge coordinator role */
  mergeCoordinator?: string;
  /** Diagnostic: specialist contributors */
  specialistContributors?: readonly string[];
  /** Replay: decision axis candidates (ranked) */
  decisionAxisCandidates?: readonly { axis: string; score: number }[];
  /** Replay: ownership score breakdown (traceable tuning) */
  ownershipScoreBreakdown?: Record<
    string,
    {
      unresolvedSlotWeight?: number;
      decisionAxisWeight?: number;
      momentumWeight?: number;
      explicitRoleMentionWeight?: number;
      orchestrationPhaseWeight?: number;
      totalScore?: number;
    }
  >;
  /** Replay: momentum contribution snapshot */
  momentumContribution?: Record<string, number>;
  /** Replay: conflict signals */
  conflictSignals?: readonly string[];
  /** Replay: slot state transitions */
  slotStateTransitions?: readonly { slotKey: string; from: string; to: string; reason?: string }[];
  /** Orchestration: wake-up reason (explicit role mention, lazy-init, etc.) */
  orchestrationWakeupReason?: string;
  /** Orchestration: whether lazy-init was used */
  orchestrationLazyInit?: boolean;
  /** SingleChat QuickAction 칩 라벨(추천안 적용 등) */
  quickActionLabel?: string;
  /** SingleChat QuickAction 분류(apply 등) */
  quickActionKind?: string;
  /** Next-question: persona validation failure reason (if retried) */
  personaValidationReason?: string;
  /** Next-question: persona validation retry count */
  personaValidationRetry?: number;
  /** Convenience: updated slot count */
  updatedSlotCount?: number;
  /** 인터뷰 질문(한 문장) — 유도형 선택지와 함께 기록 */
  interviewQuestion?: string;
  /** 인터뷰 추천 선택지(참고용, 강제 아님) */
  interviewSuggestions?: readonly string[];
  /** 인터뷰 추천 칩: LLM 생성 여부(감사·디버그) */
  interviewSuggestionsSource?: "llm" | "empty" | "none";
  /** 인터뷰 분석 요청 시 사용자 답글 대상(선택) */
  replyToMessageId?: string;
  replyToSlotKey?: string;
  replyTargetSpeakerId?: string;
  /** SingleChat 인터뷰: 다음 질문 생성 판단(감사·디버그) */
  previousQuestion?: string;
  userAnswer?: string;
  currentSlotKey?: string;
  slotAdvanceDecision?: string;
  shouldAskFollowUp?: boolean;
  followUpReason?: string;
  nextQuestionSlotKey?: string;
  /** Hybrid slot orchestration: 동적 슬롯 제안/채택/거절 기록 */
  suggestedDynamicSlots?: readonly string[];
  acceptedDynamicSlots?: readonly string[];
  rejectedDynamicSlots?: Array<{ slotKey: string; reason: string }>;
  /** bootstrap orchestration initializer 메타(LLM 산출) */
  detectedDomain?: string | null;
  missingInformation?: readonly string[];
  recommendedFocus?: string | null;
  initialOwnershipHints?: Array<{ slotKey: string; ownerAgent: string }>;
  interactionMode?: string | null;
  /** bootstrap 단계(1=초기 기획, 2=서비스 플로우, 3=기능·설계) */
  bootstrapPhase?: 1 | 2 | 3;
  /** bootstrap LLM에 compact 카탈로그만 전달했는지 */
  compactCatalogMode?: boolean;
  /** 슬롯 확장 단계(진행도 스냅샷; bootstrap 시점은 보통 1) */
  slotExpansionPhase?: 1 | 2 | 3;
  /** bootstrap 질문 품질 가드 결과 */
  questionQualityStatus?: "pass" | "retry_passed" | "retry_failed_repaired";
  questionQualityIssues?: readonly string[];
  questionQualityRetryCount?: number;
  finalQuestionSource?:
    | "llm"
    | "llm_retry"
    | "repaired_context"
    | "proposal_synthesis"
    | "llm_proposal_regeneration"
    | "proposal_fallback_synthesis";
  proposalFallbackApplied?: boolean;
  suggestionQualityIssues?: readonly string[];
  /** 멀티 에이전트 bootstrap reasoning 메타 */
  primaryDecisionAxis?: string | null;
  selectedQuestionAxis?: string | null;
  reasoningContributors?: readonly string[];
  riskSignals?: readonly string[];
  suggestedSlotReasons?: ReadonlyArray<{ slotKey: string; reason: string }>;
  /** 내부 축 id(primaryDecisionAxis와 동일 의미로 기록 가능) */
  internalAxis?: string | null;
  /** 사용자 대면 질문 스타일 태그(메타) */
  userFacingQuestionStyle?: string | null;
  /** 최종 question이 내부 오케스트레이션 어휘 없이 사용자 업무 언어로 정리되었는지 */
  userLanguageTransformApplied?: boolean;
  /** service-flow 등: 사용자 visible 메시지 저장 억제 여부 */
  visibleMessageSuppressed?: boolean;
  /** visible 억제 사유(예: duplicate_cross_stage_proposal) */
  suppressReason?: string;
  /** service-flow analyze visible mode */
  serviceFlowVisibleMode?: "visible_proposal" | "handoff_state_only" | "visible_delta" | "state_transition";
  proposalDecision?: string;
  llmCallSkipped?: boolean;
  proposalVariantMode?: string;
  proposalFingerprint?: string;
  proposalDeltaScore?: number;
  alternativeGenerationReason?: string;
  alternativeBaselineSource?: string;
  alternativeBaselineRecovered?: boolean;
  failureReason?: string;
  proposalVisualizationMode?: string;
  alternativeProposalId?: string;
  comparisonGenerated?: boolean;
  reviewMode?: string;
  /** stage transition fast-path (service-flow quick actions) */
  quickActionType?: string;
  quickActionId?: string;
  transitionSignal?: string;
  transitionResult?: string;
  transitionTriggered?: boolean;
  fromStage?: string;
  toStage?: string;
  transitionMode?: string;
  orchestrationStateUpdated?: boolean;
  projectionUpdated?: boolean;
  staleTriggered?: boolean;
  invalidations?: readonly string[];
  /** service-flow → orchestration slot sync bridge */
  slotSyncTriggered?: boolean;
  slotSyncMode?: string;
  slotSyncResult?: string;
  slotSyncCount?: number;
  progressBefore?: number;
  progressAfter?: number;
  /** bootstrap fallback 원인 분류(원인 추적용; source=fallback이면 필수 권장) */
  fallbackReason?:
    | "NO_KEY"
    | "OPENAI_API_ERROR"
    | "EMPTY_RESPONSE"
    | "JSON_PARSE_FAILED"
    | "MODEL_RETURNED_SLOT_CATALOG"
    | "MISSING_QUESTION"
    | "QUESTION_QUALITY_REJECTED"
    | "RETRY_FAILED"
    | "REPAIRED_CONTEXT_USED"
    | "ROUTE_HANDLING_ERROR"
    | "UNKNOWN_BOOTSTRAP_ERROR"
    | string;
  /** suggestions를 서버가 UX 보호용으로 보강한 경우 */
  fallbackGeneratedSuggestions?: boolean;
  /** 원문 LLM 응답(트렁케이트) — 파싱 실패 분석용 */
  rawResponseText?: string;
  /** JSON 파싱 에러 요약 */
  parseError?: string;
  /** 파싱 성공 시 미리보기(트렁케이트) */
  parsedJsonPreview?: string;
  /** 리트라이 user payload(트렁케이트) */
  retryPromptText?: string;
  /** 리트라이 raw 응답(트렁케이트) */
  retryRawResponseText?: string;
  /** fallback 직전 최종 후보 question(있으면 보존) */
  finalQuestionBeforeFallback?: string;
  /** Overlay 2단계: AI Identity 스냅샷(프롬프트 본문 비주입) */
  overlayIdentity?: Readonly<{
    roleKey: string;
    perspective: string;
    provider: string;
    capabilities: readonly string[];
  }>;
  /** Overlay 2단계: 컨텍스트 조립 추적 메타 */
  overlayContextAssembly?: PromptAssemblyMetadataContract;
  /** Overlay 2단계: 지식팩 활성화 synthetic 힌트 */
  overlayKnowledgeActivationHints?: readonly ActiveKnowledgePackRef[];
  /** Overlay 3단계: 런타임 정책 힌트(비차단; 진단·replay용) */
  overlayPolicyHints?: OverlayRuntimePolicyHintsWire;
  /**
   * Overlay 4단계: 정책 경고(비차단; enforcement 항상 not_applied).
   * 저장/로드: `parseRequirementsStateJson` → `coerceRequirementsPromptTimelineEntry`가
   * `parseOverlayPolicyWarningsFromUnknown`으로 검증·보존하며, 행당 최대 `OVERLAY_POLICY_WARNINGS_MAX_TIMELINE`개.
   */
  overlayPolicyWarnings?: readonly OverlayPolicyWarning[];
  /** Overlay 5단계 준비: 선택된 context refs(읽기 전용 metadata; prompt 본문 비반영) */
  overlaySelectedContextRefs?: readonly OverlaySelectedContextRef[];
  /** Overlay 5단계 준비: heuristic 토큰 budget metadata(라우팅·payload 비변경) */
  overlayContextBudget?: OverlayContextBudgetMetadata;
  /** Overlay 5단계 준비: 충돌 키워드 휴리스틱 warning(비차단) */
  overlayConflictWarnings?: readonly OverlayConflictWarning[];
  /** Overlay 5단계 준비: 어떤 역할이 왜 선택되었는지 decision trace */
  overlayOrchestrationDecisionTrace?: OverlayOrchestrationDecisionTrace;
  /** Overlay 6단계 준비: 무엇을 prompt assembly에 우선 사용할지 계획(읽기 전용 metadata) */
  overlayContextAssemblyPlan?: readonly OverlayAssemblyPlanItem[];
  /** Overlay 6단계 준비: overflow 시 줄일 수 있는 후보(suggestion only) */
  overlayPruningCandidates?: readonly OverlayPruningCandidate[];
  /** Overlay stabilization: budget policy 기반 prioritization 결과(sorting metadata only) */
  overlayPrioritizedContextRefs?: readonly OverlaySelectedContextRef[];
  /** Overlay stabilization: 계산된 drift warning replay (warning only, `enforcement: "not_applied"`) */
  overlayPolicyDriftWarnings?: readonly OverlayPolicyWarning[];
  /**
   * Harness Phase H1: Controlled prompt assembly **preview**.
   *
   * **dry-run / 진단용 metadata only.** 실제 prompt payload·OpenAI 호출과 무관하다.
   * mode는 항상 `"dry_run"`. 과거 timeline row와의 호환을 위해 optional.
   */
  harnessPromptAssemblyPreview?: HarnessPromptAssemblyPreview;
  /**
   * Harness Phase H1: 기존 prompt 본문과 preview의 거시적 diff(길이·누락 섹션·경고).
   * **enforcement 없음.** 진단 metadata only.
   */
  harnessPromptPreviewDiff?: HarnessPromptPreviewDiff;
  /**
   * Harness Phase H3: Role-aware Knowledge Activation planning metadata.
   *
   * **read-only / planning only.** retrieval/vector DB/prompt payload와 무관하다.
   * mode는 항상 `"dry_run"`. 과거 timeline row와의 호환을 위해 optional.
   */
  knowledgeActivationPlan?: KnowledgeActivationPlan;
  /**
   * Harness Phase H4 Preparation: Memory Runtime planning metadata.
   *
   * **read-only / planning only.** 실제 prompt payload·retrieval·vector DB와 무관하다.
   * mode는 항상 `"dry_run"`. 과거 timeline row와의 호환을 위해 optional.
   */
  memoryRuntimePlan?: MemoryRuntimePlan;
  /**
   * Harness Phase H5 Preparation: Execution Routing planning metadata.
   *
   * **read-only / planning only.** 실제 provider switching·Cursor execution·GitHub operation에
   * 영향을 주지 않는다. mode는 항상 `"dry_run"`. 과거 timeline row와의 호환을 위해 optional.
   */
  executionRoutingPlan?: ExecutionRoutingPlan;
  /**
   * Harness Phase H5.5: Execution Routing Safety Report.
   *
   * **read-only / dry-run safety diagnostic only.** mode는 항상 `"dry_run_safety"`. provider
   * switching/automatic execution/execution blocking은 타입 시스템에서 `false`로 강제된다.
   * 과거 timeline row와의 호환을 위해 optional.
   */
  executionRoutingSafetyReport?: ExecutionRoutingSafetyReport;
  /**
   * Harness Phase H6 Preparation: Review / Security Harness planning metadata.
   *
   * **read-only / planning only.** 실제 보안 스캔·코드 리뷰·이슈 등록·머지 차단·PR 게이트·
   * remediation 자동 실행과 무관. mode는 항상 `"dry_run_review_security"`.
   * 과거 timeline row와의 호환을 위해 optional.
   */
  reviewSecurityHarnessPlan?: ReviewSecurityHarnessPlan;
  /**
   * Harness Phase H6.5: Review/Security Issue Planning Report.
   *
   * **read-only / planning only.** 실제 이슈 등록·머지 차단·조치 실행과 무관.
   * mode는 항상 `"dry_run_issue_planning"`. 과거 timeline row와의 호환을 위해 optional.
   */
  reviewSecurityIssuePlanningReport?: ReviewSecurityIssuePlanningReport;
  /**
   * Harness Phase H6.5: Remediation Loop Plan.
   *
   * **read-only / planning only.** 실제 task 생성·assignment·Cursor 실행·머지 차단과 무관.
   * mode는 항상 `"dry_run_remediation_loop"`. 과거 timeline row와의 호환을 위해 optional.
   */
  remediationLoopPlan?: RemediationLoopPlan;
};

export type RequirementsStateJson = {
  lastSavedAt?: string;
  lastOrganizedAt?: string;
  selectedTargetId?: string | null;
  /** 좌측 멤버·멘션으로 지정한 질문 대상(복수) */
  selectedMembers?: Array<{ id: string; name: string }> | null;
  /** 프로젝트 생성 시 입력한 원본 설명(프로젝트 카드 표시는 이 값만 사용) */
  originalProjectDescription?: string | null;
  /** Pre-Project 대화방에서 confirm-project로 승격된 프로젝트 */
  seededFromPreProjectChat?: boolean;
  /** 아이디어 구체화: 문제정의 인터뷰(반복 질문 방지용 슬롯 상태) */
  problemInterview?: ProblemInterviewState | null;
  /**
   * 사용자가 "추가 질문 없이 진행"을 명시적으로 위임한 상태.
   * true면 인터뷰는 잔여 슬롯을 기본안으로 보완하고 종료할 수 있다.
   */
  globalDelegation?: boolean;
  /** 정리 요청 완료 시 아카이브 */
  problemInterviewHistory?: Array<{ archivedAt: string; state: ProblemInterviewState }> | null;
  /** 액터 및 서비스 흐름 정의(단계 2) — MVP v1 */
  serviceFlowV1?: RequirementsServiceFlowV1 | null;
  /** 액터 및 서비스 흐름 정의 단계를 완료한 시각 */
  serviceFlowCompletedAt?: string;
  /** 아이디어 초안 확정으로 아이디어 구체화 단계를 완료한 시각 */
  ideationStageCompletedAt?: string;
  /** 아이디어 구체화 완료의 기준이 된 산출물 id */
  ideationConfirmedAssetId?: string;
  onboardingShown?: boolean;
  openIssues?: string;
  priorityFeatures?: string;
  /** 마지막으로 빌드되어 AI에 전달된 프롬프트(화면 복원·감사용) */
  lastPromptView?: RequirementsPromptPresenterView | null;
  /** 원문 프롬프트(복사·디버그용, 보통 `lastPromptView.copyText`) */
  lastPromptText?: string;
  lastPromptGeneratedAt?: string;
  /** 요구사항(아이디어 구체화) 부트스트랩 등 프롬프트/응답 타임라인(영구 저장 JSON) */
  promptTimeline?: RequirementsPromptTimelineEntry[];
  /** 전송 전 입력창 초안(세션 간 복원) */
  lastUserDraftText?: string;
  /** AI 산출물 초안(회의 요약·문제정의서 등), 버전은 유형별로 증가 */
  deliverableAssets?: IdeationDeliverableAsset[] | null;
  /** Artifact viewer(+ 메뉴) 산출물 — orchestration stage transition과 무관 */
  projectArtifacts?: ProjectArtifact[] | null;
  /**
   * 정리 요청용 맥락(원문 대화는 `requirementsConversationJson`이 단일 소스).
   * `memoryFacts`·`rollingSummary`·`recentMessagesSnapshot`으로 AI 입력을 압축한다.
   */
  organizeContext?: RequirementsOrganizeContextV1 | null;
  /**
   * 정리요청(플래너 내부 리뷰) 상태: 부족한 슬롯이 있으면 1~2개 질문을 남기고,
   * 충분하면 산출물 생성(writer)로 이어진다.
   */
  organizePlannerState?: RequirementsOrganizePlannerState | null;
  /** 프로토타입 생성 워크스페이스 채팅(영구 저장, v1) — 레거시; 신규는 prototypeExecutionSingleChatV1 */
  prototypeWorkspaceChatV1?: {
    userLog: Array<{ id: string; text: string; at: number }>;
    aiLog: Array<{ id: string; text: string; at: number }>;
  } | null;
  /** 구현 단계 SingleChat 대화(RequirementsMessage, 영구 저장) */
  prototypeExecutionSingleChatV1?: PrototypeExecutionSingleChatV1 | null;
  /** 구현 작업안 확정 후 task plan(JSON, Prisma 변경 없음) */
  implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
  /** task plan → Cursor 실행 단위(JSON) */
  cursorWorkItemsV1?: readonly CursorWorkItem[] | null;
  /** 구현 슬롯(범위·WIP·검수·보안·SCM) — 작업안 확정 시 생성 */
  implementationSlotsV1?: ImplementationSlotsV1 | null;
  /** 구현 DB 연동 판단·Mock 전략(JSON) */
  implementationDbStrategyV1?: ImplementationDbStrategyV1 | null;
  /** 제품화 수준 구현 Seed — 기획 슬롯·산출물 정규화 */
  implementationSeedV1?: ImplementationSeedV1 | null;
  /** 구현 단계 실행 단위 작업목록(Task List) — Seed 기반으로 생성 */
  implementationTaskListV1?: ImplementationTaskListV1 | null;
  /** TaskList developer Task → 코드 변경 단위 분해(CodeTaskPlan) */
  implementationCodeTaskPlanV1?: ImplementationCodeTaskPlanV1 | null;
  /** 기획단계 1차 WorkItem preflight 요약 */
  implementationWorkItemPreflightSummaryV1?: ImplementationWorkItemPreflightSummaryV1 | null;
  /** CodeTask 실행 적합성 품질 게이트 */
  implementationCodeTaskQualityGateV1?: ImplementationCodeTaskQualityGateV1 | null;
  /** CodeTask/WorkItem 단위 실행 feedback(진단용) */
  implementationCodeTaskExecutionFeedbackV1?: ImplementationCodeTaskExecutionFeedbackV1 | null;
  /** TaskList 작업별 WIP/실행 상태(원본 taskList는 mutate하지 않음) */
  implementationTaskExecutionStateV1?: ImplementationTaskExecutionStateV1 | null;
  /** reviewer/security 품질 게이트 점검 결과(append, UI는 role별 최신 사용) */
  implementationQualityGateResultsV1?: readonly ImplementationQualityGateResultV1[] | null;
  /** 통합 리팩토링/통합 검수/통합 보안/최종 SCM 단계 실행 상태 */
  implementationIntegratedExecutionStateV1?: ImplementationIntegratedExecutionStateV1 | null;
  /** 실행 보드 사용자 확인·재작업 요청 상태 */
  implementationExecutionBoardStateV1?: ImplementationExecutionBoardStateV1 | null;
  /** 구현 보드 완료 후 검토단계 진입 readiness */
  implementationReviewStageReadyV1?: ImplementationReviewStageReadyV1 | null;
  /** 검토단계 사용자 테스트 세션 */
  reviewStageUserTestSessionV1?: ReviewStageUserTestSessionV1 | null;
  /** 검토단계 사용자 피드백 목록 */
  reviewStageUserFeedbackListV1?: ReviewStageUserFeedbackListV1 | null;
  /** 구현 작업안 초안(JSON) — 확정 전 범위·방식 */
  implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
  /** 구현단계 사용자 피드백 patch 누적 */
  implementationUserFeedbackPatchesV1?: readonly ImplementationUserFeedbackPatchV1[] | null;
  /** 구현단계 stage action 실행 run 로그(최근 N개, 영구 저장 JSON) */
  implementationStageActionRunLogV1?: ImplementationStageActionRunLogV1 | null;
  /** Code Agent WIP 검토 루프 상태(JSON) */
  codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  /** Task 단위 Cursor API 실행 상태(JSON) */
  taskCursorExecutionV1?: TaskCursorExecutionV1 | null;
  /** Task Cursor 실행 이력(JSON) */
  taskCursorExecutionHistoryV1?: readonly TaskCursorExecutionV1[] | null;
  /** Task Cursor GitHub 확인 후 자동 검수·보안 게이트 실행 상태 */
  implementationAutoQualityGateV1?: ImplementationAutoQualityGateV1 | null;
  /** 자동 품질 게이트 실행 이력 */
  implementationAutoQualityGateHistoryV1?: readonly ImplementationAutoQualityGateV1[] | null;
  /** 구현단계 Quick 자동실행(Preview 준비까지) 상위 상태 */
  implementationQuickRunV1?: ImplementationQuickRunV1 | null;
  /** 구현단계 ExecutionJob 런타임(프로세스 Task 단위 실행 상태 SoT) */
  implementationExecutionJobsV1?: readonly ImplementationExecutionJobV1[] | null;
  /** CodeTask 단위 실행 Run(구현단계 단순 실행 SoT) */
  codeTaskExecutionRunsV1?: readonly CodeTaskExecutionRunV1[] | null;
  /** 사용자 선택 CodeTask 순차 실행 큐 */
  codeTaskExecutionQueueV1?: CodeTaskExecutionQueueV1 | null;
  /** CodeTask 구현 Runtime 상태머신 SoT */
  implementationRuntimeStateV1?: ImplementationRuntimeStateV1 | null;
  /**
   * 프로토타입 타임라인에 남길 작업계획·WorkUnit 완료·배포 완료 카드(영구 저장).
   * `buildPrototypeChatMessages`의 현재 상태만으로는 사라지는 구간을 보존한다.
   */
  prototypeWorkspaceTimelineCardsV1?: readonly PrototypeWorkspaceTimelineCardV1[] | null;
  /** 기능 정리: LLM 동적 planning artifact(JSON 단일 blob, 내부 slot 모델) */
  featurePlanningSlotsV1?: FeaturePlanningSlotsArtifactV1 | null;
  /** 세부 기능 정의(FEATURE_DETAIL) structured slots — orchestration SoT */
  featureDetailSlotsV1?: FeatureDetailSlotsV1 | null;
  /** 기능 정리 워크스페이스 대화(요구사항 채팅과 분리) */
  featurePlanningWorkspaceChatV1?: FeaturePlanningWorkspaceChatV1 | null;
  /** 빠른 프로토타입 기획안 생성 메타(현재 대화·슬롯 기준) */
  fastPlanGenerationV1?: FastPlanGenerationStateV1 | null;
  /** AI팀 빠른 기획 초안(fast_plan_draft) — artifact 생성 전 단계 */
  fastPlanDraftV1?: FastPlanDraftStateV1 | null;
  /** SingleChat AI 멤버 슬롯 오케스트레이션 상태(서비스 기획 그룹) */
  singleChatOrchestrationV1?: RequirementsSingleChatOrchestrationStateV1 | null;
  /** SingleChat 절차 단계(서비스 흐름 검토 → 기능 상세 등) */
  requirementsOrchestrationStageV1?: RequirementsOrchestrationStageV1 | null;
  /** Intent router continuity — focus, clarification, last actions (phase 2) */
  requirementsIntentOrchestrationV1?: RequirementsIntentOrchestrationV1 | null;
  /** Artifact planning orchestration — 마지막 Quick Design 확정·계획 스냅샷 */
  artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
};

export type RequirementsOrchestrationStageWire =
  | "IDEATION"
  | "SERVICE_FLOW_REVIEW"
  | "FEATURE_DETAIL"
  | "DOCUMENTATION_COMPLETE";

export type RequirementsOrchestrationStageV1 = {
  currentStage: RequirementsOrchestrationStageWire;
  completedStages: string[];
  activePhase?: string | null;
  updatedAt: string;
};

export type PrototypeWorkspaceTimelineCardV1 = Readonly<{
  id: string;
  at: number;
  runId: string;
  kind: "plan_ready" | "workunit_merged";
  title: string;
  body?: string | null;
  /** plan_ready: JSON array `{ order: number; title: string }[]` */
  workUnitTitlesJson?: string | null;
  prUrl?: string | null;
  workUnitOrder?: number | null;
}>;

/** 서비스 흐름 체크리스트 8슬롯(클라이언트·저장 JSON 공통 키) */
export const REQUIREMENTS_SERVICE_FLOW_CHECKLIST_KEYS = [
  "humanActors",
  "systemActors",
  "mainFlow",
  "actorResponsibility",
  "approvalStep",
  "exceptionFlow",
  "accessControl",
  "handoffToFeatures",
] as const;

export type RequirementsServiceFlowChecklistKey = (typeof REQUIREMENTS_SERVICE_FLOW_CHECKLIST_KEYS)[number];

/** 미정의 허용(pending) / 다음 단계로 이월(deferred_next) */
export type RequirementsServiceFlowChecklistDeferralKind = "pending" | "deferred_next";

export type RequirementsServiceFlowActorKind = "human" | "system";

export type RequirementsServiceFlowActorParticipationStatus =
  | "candidate"
  | "partial"
  | "confirmed"
  | "obsolete";

export type RequirementsServiceFlowActorV1 = {
  id: string;
  name: string;
  kind: RequirementsServiceFlowActorKind;
  description?: string | null;
  /** structured 편집으로 추가된 후보 액터 */
  status?: RequirementsServiceFlowActorParticipationStatus;
};

export type RequirementsServiceFlowStructuredActorMutationMeta = Readonly<{
  readonly mutationSource: "actor_drawer";
  readonly actorId: string;
  readonly affectedStepIds: readonly string[];
  readonly projectionId?: string;
  readonly createdAt: string;
}>;

export type RequirementsServiceFlowAssignmentMutationMeta = Readonly<{
  readonly mutationSource: "assignment_drawer";
  readonly assignmentAction: string;
  readonly stepId: string;
  readonly previousActorId?: string;
  readonly nextActorId?: string;
  readonly assignmentType: string;
  readonly affectedStepIds: readonly string[];
  readonly projectionId?: string;
  readonly createdAt: string;
}>;

export type RequirementsServiceFlowStepV1 = {
  id: string;
  order: number;
  title: string;
  purpose: string;
  primaryActorId: string;
  secondaryActorIds: string[];
  approved: boolean;
  updatedAt: string;
};

export type RequirementsServiceFlowV1 = {
  createdAt: string;
  updatedAt: string;
  steps: RequirementsServiceFlowStepV1[];
  actors: RequirementsServiceFlowActorV1[];
  /**
   * 서비스 흐름(단계/액터) 구조 확정 시각. 설정되면 LLM 인터뷰 대신 단계별 담당 지정·승인 UX로 전환한다.
   */
  structureLockedAt?: string | null;
  /**
   * 체크리스트 슬롯별 사용자 결정(미정의 허용 / 다음 단계 이월).
   * 키가 없으면 해당 슬롯은 아직 사용자가 위임하지 않은 것으로 본다.
   */
  checklistDeferrals?: Partial<Record<RequirementsServiceFlowChecklistKey, RequirementsServiceFlowChecklistDeferralKind>> | null;
  /** 추천안 적용 등으로 확정된 proposal 스냅샷(표시·replay guard) */
  acceptedProposalSnapshot?: string | null;
  proposalAcceptedAt?: string | null;
  lastProposalDecision?: string | null;
  acceptedProposalFingerprint?: string | null;
  /** SingleChat service-flow UX state (proposal → review → approved → feature detail) */
  conversationState?: ServiceFlowConversationStateWire | null;
  proposalVariantMode?: ProposalVariantModeWire | null;
  reviewMode?: ServiceFlowReviewModeWire | null;
  primaryProposalFingerprint?: string | null;
  alternativeProposalFingerprint?: string | null;
  /** Alternative proposal canvas visualization payload (source of truth for overlay) */
  alternativeProposalPayload?: AlternativeProposalPayloadWire | null;
  /** 흐름 승인 orchestration 메타 */
  flowApproved?: boolean;
  flowApprovedAt?: string | null;
  flowApprovedBy?: string | null;
  activeFlowVersion?: string | null;
  /** 문서화 완료 상태 */
  documentationStatus?: "completed" | "draft" | null;
  documentationCompletedAt?: string | null;
  documentationSnapshot?: string | null;
  /** Actor Drawer structured mutation audit */
  lastStructuredActorMutation?: RequirementsServiceFlowStructuredActorMutationMeta | null;
  /** Assignment Drawer structured mutation audit */
  lastAssignmentMutation?: RequirementsServiceFlowAssignmentMutationMeta | null;
};

export type ProposalVariantModeWire = "PRIMARY" | "ALTERNATIVE";

export type ServiceFlowReviewModeWire = "PRIMARY_REVIEW" | "ALTERNATIVE_REVIEW";

export type ServiceFlowConversationStateWire =
  | "PROPOSAL"
  | "REVIEW"
  | "APPROVED"
  | "FEATURE_DETAIL";

export function isRequirementsPromptPresenterView(v: unknown): v is RequirementsPromptPresenterView {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    typeof o.copyText === "string" &&
    typeof o.roleText === "string" &&
    typeof o.projectName === "string" &&
    typeof o.projectDescription === "string" &&
    typeof o.stageText === "string" &&
    Array.isArray(o.recentSummaryBullets) &&
    typeof o.latestUserQuestion === "string" &&
    typeof o.targetName === "string"
  );
}

function isIdeationDeliverableType(v: unknown): v is IdeationDeliverableType {
  // keep permissive for forward-compat (server/client may add new types)
  return typeof v === "string" && v.trim().length > 0;
}

function parseOrganizePlannerState(raw: unknown): RequirementsOrganizePlannerState | undefined {
  if (raw === null) return undefined;
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const requestedType = isIdeationDeliverableType(o.requestedType) ? o.requestedType : "";
  const requestedLabel = typeof o.requestedLabel === "string" ? o.requestedLabel.trim() : "";
  const pendingQuestions = Array.isArray(o.pendingQuestions)
    ? o.pendingQuestions.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 4)
    : [];
  const requiredSlots =
    Array.isArray(o.requiredSlots)
      ? o.requiredSlots.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 24)
      : o.requiredSlots === null
        ? null
        : undefined;
  if (!requestedType || pendingQuestions.length === 0) {
    // allow stored state with empty questions only if explicitly null (treated as no state)
    if (!requestedType) return undefined;
  }

  const slotStatusRaw = o.slotStatus;
  const slotStatus: Record<string, "filled" | "missing"> | null | undefined =
    slotStatusRaw && typeof slotStatusRaw === "object"
      ? (Object.fromEntries(
          Object.entries(slotStatusRaw as Record<string, unknown>).map(([k, v]) => {
            const key = String(k);
            const val: "filled" | "missing" = v === "filled" ? "filled" : "missing";
            return [key, val] as const;
          })
        ) as Record<string, "filled" | "missing">)
      : slotStatusRaw === null
        ? null
        : undefined;

  const lastRaw = o.lastAnalyzerResult;
  let lastAnalyzerResult: RequirementsOrganizePlannerState["lastAnalyzerResult"];
  if (lastRaw === null) lastAnalyzerResult = null;
  else if (lastRaw && typeof lastRaw === "object") {
    const r = lastRaw as Record<string, unknown>;
    const analyzedAt = typeof r.analyzedAt === "string" ? r.analyzedAt.trim() : "";
    const message = typeof r.message === "string" ? r.message.trim() : "";
    const ready = r.ready === true;
    const questions = Array.isArray(r.questions) ? r.questions.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 4) : [];
    if (analyzedAt && message) {
      lastAnalyzerResult = { ready, message, questions, analyzedAt };
    }
  }

  return {
    requestedType,
    ...(requestedLabel ? { requestedLabel } : {}),
    pendingQuestions,
    ...(requiredSlots !== undefined ? { requiredSlots } : {}),
    ...(slotStatus !== undefined ? { slotStatus } : {}),
    ...(lastAnalyzerResult !== undefined ? { lastAnalyzerResult } : {}),
  };
}

export function parseRequirementsStateJson(raw: unknown): RequirementsStateJson {
  const root = unwrapDbJsonField(raw);
  if (!root || typeof root !== "object") return {};
  const o = root as Record<string, unknown>;
  const promptTimelineRaw = Array.isArray(o.promptTimeline) ? (o.promptTimeline as unknown[]) : null;
  const promptTimeline: RequirementsPromptTimelineEntry[] | undefined = promptTimelineRaw
    ? promptTimelineRaw
        .map((row) => coerceRequirementsPromptTimelineEntry(row))
        .filter((x): x is RequirementsPromptTimelineEntry => Boolean(x))
        .slice(-120)
    : undefined;
  const implementationStageActionRunLogV1 = coerceImplementationStageActionRunLogV1(
    o.implementationStageActionRunLogV1,
  );
  const lastPromptViewRaw = o.lastPromptView;
  const lastPromptView =
    lastPromptViewRaw === null
      ? null
      : isRequirementsPromptPresenterView(lastPromptViewRaw)
        ? lastPromptViewRaw
        : undefined;

  const serviceFlowRaw = "serviceFlowV1" in o ? (o.serviceFlowV1 as unknown) : undefined;
  const serviceFlowV1 =
    serviceFlowRaw === undefined
      ? undefined
      : serviceFlowRaw === null
        ? null
        : parseRequirementsServiceFlowV1(serviceFlowRaw) ?? null;

  const originalProjectDescriptionRaw = "originalProjectDescription" in o ? (o.originalProjectDescription as unknown) : undefined;
  const originalProjectDescription =
    originalProjectDescriptionRaw === undefined
      ? undefined
      : originalProjectDescriptionRaw === null
        ? null
        : typeof originalProjectDescriptionRaw === "string"
          ? originalProjectDescriptionRaw
          : String(originalProjectDescriptionRaw ?? "");

  const problemInterviewRaw = "problemInterview" in o ? (o.problemInterview as unknown) : undefined;
  const problemInterview =
    problemInterviewRaw === undefined
      ? undefined
      : problemInterviewRaw === null
        ? null
        : parseProblemInterview(problemInterviewRaw);

  const globalDelegationRaw = "globalDelegation" in o ? (o.globalDelegation as unknown) : undefined;
  const globalDelegation =
    globalDelegationRaw === undefined ? undefined : globalDelegationRaw === null ? null : globalDelegationRaw === true;

  const problemInterviewHistoryRaw = "problemInterviewHistory" in o ? (o.problemInterviewHistory as unknown) : undefined;
  const problemInterviewHistory =
    problemInterviewHistoryRaw === undefined
      ? undefined
      : problemInterviewHistoryRaw === null
        ? null
        : Array.isArray(problemInterviewHistoryRaw)
          ? (problemInterviewHistoryRaw as unknown[])
              .map((row) => {
                if (!row || typeof row !== "object") return null;
                const r = row as Record<string, unknown>;
                const archivedAt = typeof r.archivedAt === "string" ? r.archivedAt : "";
                const state = parseProblemInterview(r.state);
                if (!archivedAt || !state) return null;
                return { archivedAt, state };
              })
              .filter((x): x is { archivedAt: string; state: ProblemInterviewState } => Boolean(x))
              .slice(-24)
          : undefined;

  const parseProtoChat = (rawChat: unknown): RequirementsStateJson["prototypeWorkspaceChatV1"] | undefined => {
    if (rawChat === undefined) return undefined;
    if (rawChat === null) return null;
    if (!rawChat || typeof rawChat !== "object") return undefined;
    const c = rawChat as Record<string, unknown>;
    const normalize = (v: unknown): Array<{ id: string; text: string; at: number }> => {
      if (!Array.isArray(v)) return [];
      const out: Array<{ id: string; text: string; at: number }> = [];
      for (const it of v) {
        if (!it || typeof it !== "object") continue;
        const r = it as Record<string, unknown>;
        const id = typeof r.id === "string" ? r.id.trim() : "";
        const text = typeof r.text === "string" ? r.text.trim() : "";
        const at = typeof r.at === "number" && Number.isFinite(r.at) ? r.at : 0;
        if (!id || !text || !at) continue;
        out.push({ id, text: text.slice(0, 8000), at });
      }
      out.sort((a, b) => a.at - b.at);
      return out.slice(-400);
    };
    return {
      userLog: normalize(c.userLog),
      aiLog: normalize(c.aiLog),
    };
  };

  const protoChatRaw = "prototypeWorkspaceChatV1" in o ? (o.prototypeWorkspaceChatV1 as unknown) : undefined;
  const prototypeWorkspaceChatV1 = parseProtoChat(protoChatRaw);

  const parseProtoTimelineCards = (rawCards: unknown): readonly PrototypeWorkspaceTimelineCardV1[] | undefined => {
    if (rawCards === undefined) return undefined;
    if (rawCards === null) return [];
    if (!Array.isArray(rawCards)) return undefined;
    const out: PrototypeWorkspaceTimelineCardV1[] = [];
    for (const it of rawCards) {
      if (!it || typeof it !== "object") continue;
      const r = it as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const runId = typeof r.runId === "string" ? r.runId.trim() : "";
      const kind = r.kind === "plan_ready" || r.kind === "workunit_merged" ? r.kind : "";
      const title = typeof r.title === "string" ? r.title.trim() : "";
      const at = typeof r.at === "number" && Number.isFinite(r.at) ? r.at : 0;
      if (!id || !runId || !kind || !title || !at) continue;
      const body = r.body === null || r.body === undefined ? null : typeof r.body === "string" ? r.body.trim() : String(r.body);
      const workUnitTitlesJson =
        r.workUnitTitlesJson === null || r.workUnitTitlesJson === undefined
          ? null
          : typeof r.workUnitTitlesJson === "string"
            ? r.workUnitTitlesJson.slice(0, 32000)
            : null;
      const prUrl =
        r.prUrl === null || r.prUrl === undefined ? null : typeof r.prUrl === "string" ? r.prUrl.trim().slice(0, 2000) : null;
      const workUnitOrder =
        typeof r.workUnitOrder === "number" && Number.isFinite(r.workUnitOrder) ? Math.floor(r.workUnitOrder) : null;
      out.push({
        id: id.slice(0, 256),
        at,
        runId: runId.slice(0, 128),
        kind,
        title: title.slice(0, 2000),
        ...(body ? { body } : {}),
        ...(workUnitTitlesJson ? { workUnitTitlesJson } : {}),
        ...(prUrl ? { prUrl } : {}),
        ...(workUnitOrder !== null ? { workUnitOrder } : {}),
      });
    }
    out.sort((a, b) => a.at - b.at);
    return out.slice(-300);
  };

  const protoTimelineRaw =
    "prototypeWorkspaceTimelineCardsV1" in o ? (o.prototypeWorkspaceTimelineCardsV1 as unknown) : undefined;
  const prototypeWorkspaceTimelineCardsV1 = parseProtoTimelineCards(protoTimelineRaw);

  const protoExecChatRaw =
    "prototypeExecutionSingleChatV1" in o ? (o.prototypeExecutionSingleChatV1 as unknown) : undefined;
  const prototypeExecutionSingleChatV1 = parsePrototypeExecutionSingleChatV1(protoExecChatRaw);

  const implementationTaskPlanV1 = parseImplementationTaskPlanV1(
    "implementationTaskPlanV1" in o ? o.implementationTaskPlanV1 : undefined,
  );
  const cursorWorkItemsV1 = parseCursorWorkItemsV1("cursorWorkItemsV1" in o ? o.cursorWorkItemsV1 : undefined);
  const implementationSlotsV1 = parseImplementationSlotsV1(
    "implementationSlotsV1" in o ? o.implementationSlotsV1 : undefined,
  );
  const implementationDbStrategyV1 = parseImplementationDbStrategyV1(
    "implementationDbStrategyV1" in o ? o.implementationDbStrategyV1 : undefined,
  );
  const implementationSeedV1 = parseImplementationSeedV1(
    "implementationSeedV1" in o ? o.implementationSeedV1 : undefined,
  );
  const implementationTaskListV1 = parseImplementationTaskListV1(
    "implementationTaskListV1" in o ? o.implementationTaskListV1 : undefined,
  );
  const implementationCodeTaskPlanV1 = parseImplementationCodeTaskPlanV1(
    "implementationCodeTaskPlanV1" in o ? o.implementationCodeTaskPlanV1 : undefined,
  );
  const implementationWorkItemPreflightSummaryV1 = parseImplementationWorkItemPreflightSummaryV1(
    "implementationWorkItemPreflightSummaryV1" in o ? o.implementationWorkItemPreflightSummaryV1 : undefined,
  );
  const implementationCodeTaskQualityGateV1 = parseImplementationCodeTaskQualityGateV1(
    "implementationCodeTaskQualityGateV1" in o ? o.implementationCodeTaskQualityGateV1 : undefined,
  );
  const implementationCodeTaskExecutionFeedbackV1 = parseImplementationCodeTaskExecutionFeedbackV1(
    "implementationCodeTaskExecutionFeedbackV1" in o
      ? o.implementationCodeTaskExecutionFeedbackV1
      : undefined,
  );
  const implementationTaskExecutionStateV1 = parseImplementationTaskExecutionStateV1(
    "implementationTaskExecutionStateV1" in o ? o.implementationTaskExecutionStateV1 : undefined,
  );
  const implementationQualityGateResultsV1 = parseImplementationQualityGateResultsV1(
    "implementationQualityGateResultsV1" in o ? o.implementationQualityGateResultsV1 : undefined,
  );
  const implementationIntegratedExecutionStateV1 = parseImplementationIntegratedExecutionStateV1(
    "implementationIntegratedExecutionStateV1" in o
      ? o.implementationIntegratedExecutionStateV1
      : undefined,
  );
  const implementationExecutionBoardStateV1 = parseImplementationExecutionBoardStateV1(
    "implementationExecutionBoardStateV1" in o ? o.implementationExecutionBoardStateV1 : undefined,
  );
  const implementationReviewStageReadyV1 = parseImplementationReviewStageReadyV1(
    "implementationReviewStageReadyV1" in o ? o.implementationReviewStageReadyV1 : undefined,
  );
  const reviewStageUserTestSessionV1 = parseReviewStageUserTestSessionV1(
    "reviewStageUserTestSessionV1" in o ? o.reviewStageUserTestSessionV1 : undefined,
  );
  const reviewStageUserFeedbackListV1 = parseReviewStageUserFeedbackListV1(
    "reviewStageUserFeedbackListV1" in o ? o.reviewStageUserFeedbackListV1 : undefined,
  );
  const implementationWorkPlanDraftV1 = parseImplementationWorkPlanDraftV1(
    "implementationWorkPlanDraftV1" in o ? o.implementationWorkPlanDraftV1 : undefined,
  );
  const implementationUserFeedbackPatchesV1 = parseImplementationUserFeedbackPatchesV1(
    "implementationUserFeedbackPatchesV1" in o ? o.implementationUserFeedbackPatchesV1 : undefined,
  );
  const codeAgentWipExecutionV1 = parseCodeAgentWipExecutionFromState(
    "codeAgentWipExecutionV1" in o ? o.codeAgentWipExecutionV1 : undefined,
    "cursorWipExecutionV1" in o ? o.cursorWipExecutionV1 : undefined,
  );
  const taskCursorExecutionV1 = parseTaskCursorExecutionV1(
    "taskCursorExecutionV1" in o ? o.taskCursorExecutionV1 : undefined,
  );
  const taskCursorExecutionHistoryV1 = parseTaskCursorExecutionHistoryV1(
    "taskCursorExecutionHistoryV1" in o ? o.taskCursorExecutionHistoryV1 : undefined,
  );
  const implementationAutoQualityGateV1 = parseImplementationAutoQualityGateV1(
    "implementationAutoQualityGateV1" in o ? o.implementationAutoQualityGateV1 : undefined,
  );
  const implementationAutoQualityGateHistoryV1 = parseImplementationAutoQualityGateHistoryV1(
    "implementationAutoQualityGateHistoryV1" in o ? o.implementationAutoQualityGateHistoryV1 : undefined,
  );
  const implementationQuickRunV1 = parseImplementationQuickRunV1(
    "implementationQuickRunV1" in o ? o.implementationQuickRunV1 : undefined,
  );
  const implementationExecutionJobsV1 = parseImplementationExecutionJobsV1(
    "implementationExecutionJobsV1" in o ? o.implementationExecutionJobsV1 : undefined,
  );
  const codeTaskExecutionRunsV1 = parseCodeTaskExecutionRunsV1(
    "codeTaskExecutionRunsV1" in o ? o.codeTaskExecutionRunsV1 : undefined,
  );
  const codeTaskExecutionQueueV1 = parseCodeTaskExecutionQueueV1(
    "codeTaskExecutionQueueV1" in o ? o.codeTaskExecutionQueueV1 : undefined,
  );
  const implementationRuntimeStateV1 = parseImplementationRuntimeStateV1(
    "implementationRuntimeStateV1" in o ? o.implementationRuntimeStateV1 : undefined,
  );

  const featurePlanningRaw = "featurePlanningSlotsV1" in o ? (o.featurePlanningSlotsV1 as unknown) : undefined;
  let featurePlanningSlotsV1: FeaturePlanningSlotsArtifactV1 | null | undefined;
  if (featurePlanningRaw === undefined) featurePlanningSlotsV1 = undefined;
  else if (featurePlanningRaw === null) featurePlanningSlotsV1 = null;
  else {
    const parsed = parseFeaturePlanningSlotsArtifactV1(featurePlanningRaw);
    featurePlanningSlotsV1 = parsed ? softMigrateLegacyRoleSlotsArtifact(parsed) : null;
  }

  const featureDetailRaw = "featureDetailSlotsV1" in o ? (o.featureDetailSlotsV1 as unknown) : undefined;
  let featureDetailSlotsV1: FeatureDetailSlotsV1 | null | undefined;
  if (featureDetailRaw === undefined) featureDetailSlotsV1 = undefined;
  else if (featureDetailRaw === null) featureDetailSlotsV1 = null;
  else {
    featureDetailSlotsV1 = parseFeatureDetailSlotsV1(featureDetailRaw) ?? null;
  }

  const fpChatRaw = "featurePlanningWorkspaceChatV1" in o ? (o.featurePlanningWorkspaceChatV1 as unknown) : undefined;
  let featurePlanningWorkspaceChatV1: FeaturePlanningWorkspaceChatV1 | null | undefined;
  if (fpChatRaw === undefined) featurePlanningWorkspaceChatV1 = undefined;
  else if (fpChatRaw === null) featurePlanningWorkspaceChatV1 = null;
  else {
    const parsed = parseFeaturePlanningWorkspaceChatV1(fpChatRaw);
    featurePlanningWorkspaceChatV1 = parsed ?? { messages: [] };
  }

  const orchRaw = "singleChatOrchestrationV1" in o ? (o.singleChatOrchestrationV1 as unknown) : undefined;
  let singleChatOrchestrationV1: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  if (orchRaw === undefined) singleChatOrchestrationV1 = undefined;
  else if (orchRaw === null) singleChatOrchestrationV1 = null;
  else {
    singleChatOrchestrationV1 = parseRequirementsSingleChatOrchestrationV1(orchRaw) ?? null;
  }

  const orchStageRaw =
    "requirementsOrchestrationStageV1" in o ? (o.requirementsOrchestrationStageV1 as unknown) : undefined;
  const requirementsOrchestrationStageV1 = parseRequirementsOrchestrationStageV1(orchStageRaw);

  const intentOrchRaw =
    "requirementsIntentOrchestrationV1" in o ? (o.requirementsIntentOrchestrationV1 as unknown) : undefined;
  let requirementsIntentOrchestrationV1: RequirementsIntentOrchestrationV1 | null | undefined;
  if (intentOrchRaw === undefined) requirementsIntentOrchestrationV1 = undefined;
  else if (intentOrchRaw === null) requirementsIntentOrchestrationV1 = null;
  else {
    const parsed = parseRequirementsIntentOrchestrationV1(intentOrchRaw) ?? null;
    requirementsIntentOrchestrationV1 = parsed ? recoverRequirementsIntentOrchestration(parsed) : null;
  }

  const fastPlanRaw = "fastPlanGenerationV1" in o ? (o.fastPlanGenerationV1 as unknown) : undefined;
  let fastPlanGenerationV1: FastPlanGenerationStateV1 | null | undefined;
  if (fastPlanRaw === undefined) fastPlanGenerationV1 = undefined;
  else if (fastPlanRaw === null) fastPlanGenerationV1 = null;
  else {
    fastPlanGenerationV1 = parseFastPlanGenerationV1(fastPlanRaw);
  }

  const artifactOrchRaw = "artifactOrchestrationV1" in o ? (o.artifactOrchestrationV1 as unknown) : undefined;
  const artifactOrchestrationV1 =
    artifactOrchRaw === undefined
      ? undefined
      : artifactOrchRaw === null
        ? null
        : parseArtifactOrchestrationStateV1(artifactOrchRaw);

  const fastPlanDraftRaw = "fastPlanDraftV1" in o ? (o.fastPlanDraftV1 as unknown) : undefined;
  let fastPlanDraftV1: FastPlanDraftStateV1 | null | undefined;
  if (fastPlanDraftRaw === undefined) fastPlanDraftV1 = undefined;
  else if (fastPlanDraftRaw === null) fastPlanDraftV1 = null;
  else {
    fastPlanDraftV1 = parseFastPlanDraftV1(fastPlanDraftRaw);
  }

  return {
    lastSavedAt: typeof o.lastSavedAt === "string" ? o.lastSavedAt : undefined,
    lastOrganizedAt: typeof o.lastOrganizedAt === "string" ? o.lastOrganizedAt : undefined,
    selectedTargetId:
      typeof o.selectedTargetId === "string" ? o.selectedTargetId : o.selectedTargetId === null ? null : undefined,
    selectedMembers: Array.isArray(o.selectedMembers)
      ? (o.selectedMembers as unknown[])
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const r = row as Record<string, unknown>;
            const id = typeof r.id === "string" ? r.id.trim() : "";
            const name = typeof r.name === "string" ? r.name.trim() : "";
            if (!id) return null;
            return { id, name: name || id };
          })
          .filter((x): x is { id: string; name: string } => Boolean(x))
      : o.selectedMembers === null
        ? null
        : undefined,
    onboardingShown: typeof o.onboardingShown === "boolean" ? o.onboardingShown : undefined,
    seededFromPreProjectChat:
      typeof o.seededFromPreProjectChat === "boolean" ? o.seededFromPreProjectChat : undefined,
    ideationStageCompletedAt:
      typeof o.ideationStageCompletedAt === "string" ? o.ideationStageCompletedAt : undefined,
    ideationConfirmedAssetId:
      typeof o.ideationConfirmedAssetId === "string" ? o.ideationConfirmedAssetId : undefined,
    openIssues: typeof o.openIssues === "string" ? o.openIssues : undefined,
    priorityFeatures: typeof o.priorityFeatures === "string" ? o.priorityFeatures : undefined,
    ...(originalProjectDescription !== undefined ? { originalProjectDescription } : {}),
    ...(problemInterview !== undefined ? { problemInterview } : {}),
    ...(globalDelegation !== undefined ? { globalDelegation: globalDelegation === null ? undefined : globalDelegation } : {}),
    ...(problemInterviewHistory !== undefined ? { problemInterviewHistory } : {}),
    ...(serviceFlowV1 !== undefined ? { serviceFlowV1 } : {}),
    serviceFlowCompletedAt:
      typeof o.serviceFlowCompletedAt === "string" ? o.serviceFlowCompletedAt : undefined,
    ...(lastPromptView !== undefined ? { lastPromptView } : {}),
    lastPromptText: typeof o.lastPromptText === "string" ? o.lastPromptText : undefined,
    lastPromptGeneratedAt: typeof o.lastPromptGeneratedAt === "string" ? o.lastPromptGeneratedAt : undefined,
    ...(promptTimeline && promptTimeline.length ? { promptTimeline } : {}),
    ...(implementationStageActionRunLogV1 ? { implementationStageActionRunLogV1 } : {}),
    lastUserDraftText: typeof o.lastUserDraftText === "string" ? o.lastUserDraftText : undefined,
    deliverableAssets: o.deliverableAssets === null ? null : parseDeliverableAssetsFromState(o.deliverableAssets),
    projectArtifacts: !("projectArtifacts" in o)
      ? undefined
      : o.projectArtifacts === null
        ? null
        : parseProjectArtifactsFromState(o.projectArtifacts) ?? null,
    organizeContext: !("organizeContext" in o)
      ? undefined
      : o.organizeContext === null
        ? null
        : parseRequirementsOrganizeContextV1(o.organizeContext) ?? null,
    organizePlannerState: !("organizePlannerState" in o)
      ? undefined
      : o.organizePlannerState === null
        ? null
        : parseOrganizePlannerState(o.organizePlannerState) ?? null,
    ...(prototypeWorkspaceChatV1 !== undefined ? { prototypeWorkspaceChatV1 } : {}),
    ...(prototypeExecutionSingleChatV1 !== undefined ? { prototypeExecutionSingleChatV1 } : {}),
    ...(implementationTaskPlanV1 !== undefined ? { implementationTaskPlanV1 } : {}),
    ...(cursorWorkItemsV1 !== undefined ? { cursorWorkItemsV1 } : {}),
    ...(implementationSlotsV1 !== undefined ? { implementationSlotsV1 } : {}),
    ...(implementationDbStrategyV1 !== undefined ? { implementationDbStrategyV1 } : {}),
    ...(implementationSeedV1 !== undefined ? { implementationSeedV1 } : {}),
    ...(implementationTaskListV1 !== undefined ? { implementationTaskListV1 } : {}),
    ...(implementationCodeTaskPlanV1 !== undefined ? { implementationCodeTaskPlanV1 } : {}),
    ...(implementationWorkItemPreflightSummaryV1 !== undefined
      ? { implementationWorkItemPreflightSummaryV1 }
      : {}),
    ...(implementationCodeTaskQualityGateV1 !== undefined
      ? { implementationCodeTaskQualityGateV1 }
      : {}),
    ...(implementationCodeTaskExecutionFeedbackV1 !== undefined
      ? { implementationCodeTaskExecutionFeedbackV1 }
      : {}),
    ...(implementationTaskExecutionStateV1 !== undefined
      ? { implementationTaskExecutionStateV1 }
      : {}),
    ...(implementationQualityGateResultsV1 !== undefined
      ? { implementationQualityGateResultsV1 }
      : {}),
    ...(implementationIntegratedExecutionStateV1 !== undefined
      ? { implementationIntegratedExecutionStateV1 }
      : {}),
    ...(implementationExecutionBoardStateV1 !== undefined
      ? { implementationExecutionBoardStateV1 }
      : {}),
    ...(implementationReviewStageReadyV1 !== undefined
      ? { implementationReviewStageReadyV1 }
      : {}),
    ...(reviewStageUserTestSessionV1 !== undefined ? { reviewStageUserTestSessionV1 } : {}),
    ...(reviewStageUserFeedbackListV1 !== undefined ? { reviewStageUserFeedbackListV1 } : {}),
    ...(implementationWorkPlanDraftV1 !== undefined ? { implementationWorkPlanDraftV1 } : {}),
    ...(implementationUserFeedbackPatchesV1 !== undefined
      ? { implementationUserFeedbackPatchesV1 }
      : {}),
    ...(codeAgentWipExecutionV1 !== undefined ? { codeAgentWipExecutionV1 } : {}),
    ...(taskCursorExecutionV1 !== undefined ? { taskCursorExecutionV1 } : {}),
    ...(taskCursorExecutionHistoryV1 !== undefined ? { taskCursorExecutionHistoryV1 } : {}),
    ...(implementationAutoQualityGateV1 !== undefined ? { implementationAutoQualityGateV1 } : {}),
    ...(implementationQuickRunV1 !== undefined ? { implementationQuickRunV1 } : {}),
    ...(implementationExecutionJobsV1 !== undefined ? { implementationExecutionJobsV1 } : {}),
    ...(codeTaskExecutionRunsV1 !== undefined ? { codeTaskExecutionRunsV1 } : {}),
    ...(codeTaskExecutionQueueV1 !== undefined ? { codeTaskExecutionQueueV1 } : {}),
    ...(implementationRuntimeStateV1 !== undefined ? { implementationRuntimeStateV1 } : {}),
    ...(implementationAutoQualityGateHistoryV1 !== undefined
      ? { implementationAutoQualityGateHistoryV1 }
      : {}),
    ...(prototypeWorkspaceTimelineCardsV1 !== undefined ? { prototypeWorkspaceTimelineCardsV1 } : {}),
    ...(featurePlanningSlotsV1 !== undefined ? { featurePlanningSlotsV1 } : {}),
    ...(featureDetailSlotsV1 !== undefined ? { featureDetailSlotsV1 } : {}),
    ...(featurePlanningWorkspaceChatV1 !== undefined ? { featurePlanningWorkspaceChatV1 } : {}),
    ...(fastPlanGenerationV1 !== undefined ? { fastPlanGenerationV1 } : {}),
    ...(fastPlanDraftV1 !== undefined ? { fastPlanDraftV1 } : {}),
    ...(singleChatOrchestrationV1 !== undefined ? { singleChatOrchestrationV1 } : {}),
    ...(requirementsOrchestrationStageV1 !== undefined
      ? { requirementsOrchestrationStageV1 }
      : {}),
    ...(requirementsIntentOrchestrationV1 !== undefined
      ? { requirementsIntentOrchestrationV1 }
      : {}),
    ...(artifactOrchestrationV1 !== undefined ? { artifactOrchestrationV1 } : {}),
  };
}

export function mergeRequirementsStateJson(base: RequirementsStateJson, patch: Partial<RequirementsStateJson>): RequirementsStateJson {
  return { ...base, ...patch };
}

function parsePlatformMemberRunRow(raw: unknown): PlatformMemberRun | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const runId = String(o.runId ?? "").trim();
  const flowId = String(o.flowId ?? "").trim();
  const agentId = String(o.agentId ?? "").trim();
  const role = String(o.role ?? "").trim();
  const status = String(o.status ?? "").trim();
  if (!runId || !flowId || !agentId || !role || !status) return null;
  return {
    runId,
    flowId: flowId as PlatformMemberRun["flowId"],
    agentId,
    role: role as PlatformMemberRun["role"],
    status: status as PlatformMemberRun["status"],
    targetSlotKeys: Array.isArray(o.targetSlotKeys) ? o.targetSlotKeys.map((x) => String(x)) : undefined,
    inputSummary: typeof o.inputSummary === "string" ? o.inputSummary : undefined,
    outputSummary: typeof o.outputSummary === "string" ? o.outputSummary : undefined,
    traceId: typeof o.traceId === "string" ? o.traceId : null,
    startedAt: typeof o.startedAt === "string" ? o.startedAt : null,
    completedAt: typeof o.completedAt === "string" ? o.completedAt : null,
  };
}

function parsePlatformMemberDraftRow(raw: unknown): PlatformMemberDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const draftId = String(o.draftId ?? "").trim();
  const runId = String(o.runId ?? "").trim();
  const agentId = String(o.agentId ?? "").trim();
  const role = String(o.role ?? "").trim();
  const content = String(o.content ?? "").trim();
  const confidence = String(o.confidence ?? "").trim();
  if (!draftId || !runId || !agentId || !role || !content) return null;
  const conf =
    confidence === "confirmed" ||
    confidence === "partial" ||
    confidence === "candidate" ||
    confidence === "assumed_for_prototype" ?
      confidence
    : "candidate";
  return {
    draftId,
    runId,
    agentId,
    role: role as PlatformMemberDraft["role"],
    targetSlotKeys: Array.isArray(o.targetSlotKeys) ? o.targetSlotKeys.map((x) => String(x)) : undefined,
    content,
    confidence: conf,
    assumptions: Array.isArray(o.assumptions) ? o.assumptions.map((x) => String(x)) : undefined,
  };
}

function parseFastPlanDraftV1(raw: unknown): FastPlanDraftStateV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.flowId ?? "").trim() !== "fast_plan_draft") return null;
  const generatedAt = String(o.generatedAt ?? "").trim();
  if (!generatedAt) return null;
  const memberRuns: PlatformMemberRun[] = [];
  if (Array.isArray(o.memberRuns)) {
    for (const row of o.memberRuns) {
      const parsed = parsePlatformMemberRunRow(row);
      if (parsed) memberRuns.push(parsed);
    }
  }
  const memberDrafts: PlatformMemberDraft[] = [];
  if (Array.isArray(o.memberDrafts)) {
    for (const row of o.memberDrafts) {
      const parsed = parsePlatformMemberDraftRow(row);
      if (parsed) memberDrafts.push(parsed);
    }
  }
  const assumptions: FastPlanAssumption[] = [];
  if (Array.isArray(o.assumptions)) {
    for (const row of o.assumptions) {
      if (!row || typeof row !== "object") continue;
      const a = row as Record<string, unknown>;
      const label = String(a.label ?? "").trim();
      const value = String(a.value ?? "").trim();
      if (!label || !value) continue;
      const confidence = String(a.confidence ?? "").trim();
      const conf =
        confidence === "confirmed" ||
        confidence === "partial" ||
        confidence === "candidate" ||
        confidence === "assumed_for_prototype" ?
          confidence
        : "assumed_for_prototype";
      assumptions.push({
        slotKey: String(a.slotKey ?? label),
        label,
        value,
        confidence: conf,
        reason: String(a.reason ?? "").trim() || "fast plan draft",
      });
    }
  }
  const statusRaw = String(o.status ?? "").trim();
  const status = statusRaw === "confirmed" ? "confirmed" : "proposed";
  const slotCandidatePatch = parseFastPlanDraftSlotCandidatePatchV1(o.slotCandidatePatch);
  return {
    status,
    generatedAt,
    flowId: "fast_plan_draft",
    memberRuns,
    memberDrafts,
    assumptions,
    ...(slotCandidatePatch ? { slotCandidatePatch } : {}),
    source: "current_conversation_and_slots",
  };
}

function parseFastPlanGenerationV1(raw: unknown): FastPlanGenerationStateV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const mode = String(o.mode ?? "").trim();
  if (mode !== "fast_plan_from_current_context") return null;
  const artifactId = String(o.artifactId ?? "").trim();
  const generatedAt = String(o.generatedAt ?? "").trim();
  if (!artifactId || !generatedAt) return null;
  const assumptions: FastPlanAssumption[] = [];
  if (Array.isArray(o.assumptions)) {
    for (const row of o.assumptions) {
      if (!row || typeof row !== "object") continue;
      const a = row as Record<string, unknown>;
      const label = String(a.label ?? "").trim();
      const value = String(a.value ?? "").trim();
      const slotKey = String(a.slotKey ?? "").trim();
      const confidence = String(a.confidence ?? "").trim();
      const reason = String(a.reason ?? "").trim();
      if (!label || !value) continue;
      const conf =
        confidence === "confirmed" ||
        confidence === "partial" ||
        confidence === "candidate" ||
        confidence === "assumed_for_prototype" ?
          confidence
        : "assumed_for_prototype";
      assumptions.push({ slotKey: slotKey || label, label, value, confidence: conf, reason: reason || "fast plan" });
    }
  }
  const missingAtGeneration = Array.isArray(o.missingAtGeneration)
    ? o.missingAtGeneration.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  return {
    mode: "fast_plan_from_current_context",
    generatedAt,
    source: "current_conversation_and_slots",
    assumptions,
    missingAtGeneration,
    artifactId,
  };
}

function parseProblemInterview(raw: unknown): ProblemInterviewState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  // new slots (v3 - ideation high-level)
  const serviceIdea = typeof o.serviceIdea === "boolean" ? o.serviceIdea : false;
  const targetUser = typeof o.targetUser === "boolean" ? o.targetUser : false;
  const coreProblem = typeof o.coreProblem === "boolean" ? o.coreProblem : false;
  const expectedOutcome = typeof o.expectedOutcome === "boolean" ? o.expectedOutcome : false;
  const roughActors = typeof o.roughActors === "boolean" ? o.roughActors : false;
  const roughFlow = typeof o.roughFlow === "boolean" ? o.roughFlow : false;
  const mustHaveFeatures = typeof o.mustHaveFeatures === "boolean" ? o.mustHaveFeatures : false;
  const constraints = typeof o.constraints === "boolean" ? o.constraints : false;
  const notesRaw = o.notes && typeof o.notes === "object" ? (o.notes as Record<string, unknown>) : null;
  const notes: Record<string, string> = {};
  if (notesRaw) {
    for (const [k, v] of Object.entries(notesRaw)) {
      const key = String(k ?? "").trim();
      const val = typeof v === "string" ? v : String(v ?? "");
      if (key && val.trim()) notes[key] = val.trim().slice(0, 8000);
    }
  }
  const partialRaw = o.partial && typeof o.partial === "object" ? (o.partial as Record<string, unknown>) : null;
  const partial: Record<string, boolean> = {};
  if (partialRaw) {
    for (const [k, v] of Object.entries(partialRaw)) {
      const key = String(k ?? "").trim();
      if (!key) continue;
      partial[key] = v === true;
    }
    // migrate legacy slot ids (best-effort)
    if (partial.coreUser) {
      partial.targetUser = true;
      delete partial.coreUser;
    }
    if (partial.productGoal) {
      partial.serviceIdea = true;
      delete partial.productGoal;
    }
    if (partial.painPoint) {
      partial.coreProblem = true;
      delete partial.painPoint;
    }
    if (partial.needForImprovement) {
      partial.expectedOutcome = true;
      delete partial.needForImprovement;
    }
    if (partial.currentMethod) {
      partial.serviceIdea = true;
      delete partial.currentMethod;
    }
    if (partial.coreFeatures || partial.featurePriority || partial.mvpPriority || partial.mvpScope) {
      partial.mustHaveFeatures = true;
      delete partial.coreFeatures;
      delete partial.featurePriority;
      delete partial.mvpPriority;
      delete partial.mvpScope;
    }
    if (partial.operations || partial.platformType) {
      partial.roughActors = true;
      delete partial.operations;
      delete partial.platformType;
    }
    if (partial.kpiSuccess) {
      partial.expectedOutcome = true;
      delete partial.kpiSuccess;
    }
    // constraints stays constraints
  }
  const askedSlotsRaw = Array.isArray(o.askedSlots) ? (o.askedSlots as unknown[]) : null;
  const askedSlots = askedSlotsRaw
    ? askedSlotsRaw
        .map((x) => {
          const s = String(x ?? "").trim();
          if (!s) return "";
          // legacy -> new id mapping (best-effort)
          if (s === "coreUser") return "targetUser";
          if (s === "productGoal") return "serviceIdea";
          if (s === "painPoint") return "coreProblem";
          if (s === "needForImprovement") return "expectedOutcome";
          if (s === "currentMethod") return "serviceIdea";
          if (s === "coreFeatures" || s === "featurePriority" || s === "mvpPriority" || s === "mvpScope") return "mustHaveFeatures";
          if (s === "kpiSuccess") return "expectedOutcome";
          if (s === "operations" || s === "platformType") return "roughActors";
          return s;
        })
        .filter(Boolean)
        .slice(0, 32)
    : undefined;
  const active = typeof o.active === "boolean" ? o.active : undefined;
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : undefined;
  return {
    serviceIdea,
    targetUser,
    coreProblem,
    expectedOutcome,
    roughActors,
    roughFlow,
    mustHaveFeatures,
    constraints,
    notes,
    ...(Object.keys(partial).length ? { partial } : {}),
    ...(askedSlots ? { askedSlots: askedSlots as ProblemInterviewSlot[] } : {}),
    ...(active !== undefined ? { active } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function parseRequirementsServiceFlowV1(raw: unknown): RequirementsServiceFlowV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : "";
  const stepsRaw = Array.isArray(o.steps) ? (o.steps as unknown[]) : [];
  const actorsRaw = Array.isArray(o.actors) ? (o.actors as unknown[]) : [];
  const steps: RequirementsServiceFlowStepV1[] = stepsRaw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const order = typeof r.order === "number" && Number.isFinite(r.order) ? r.order : NaN;
      const title = typeof r.title === "string" ? r.title.trim() : "";
      const purpose = typeof r.purpose === "string" ? r.purpose.trim() : "";
      const primaryActorId = typeof r.primaryActorId === "string" ? r.primaryActorId.trim() : "";
      const secondaryActorIds = Array.isArray(r.secondaryActorIds)
        ? (r.secondaryActorIds as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean)
        : [];
      const approved = typeof r.approved === "boolean" ? r.approved : false;
      const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : "";
      if (!id || !Number.isFinite(order) || !title || !purpose || !primaryActorId || !updatedAt) return null;
      return { id, order, title, purpose, primaryActorId, secondaryActorIds, approved, updatedAt };
    })
    .filter((x): x is RequirementsServiceFlowStepV1 => Boolean(x));

  const actors: RequirementsServiceFlowActorV1[] = actorsRaw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const kind = r.kind === "human" || r.kind === "system" ? (r.kind as RequirementsServiceFlowActorKind) : null;
      const description =
        r.description === null ? null : typeof r.description === "string" ? r.description.trim() : undefined;
      const statusRaw = typeof r.status === "string" ? r.status.trim() : "";
      const status =
        statusRaw === "candidate" ||
        statusRaw === "partial" ||
        statusRaw === "confirmed" ||
        statusRaw === "obsolete"
          ? (statusRaw as RequirementsServiceFlowActorParticipationStatus)
          : undefined;
      if (!id || !name || !kind) return null;
      return {
        id,
        name,
        kind,
        ...(description !== undefined ? { description } : {}),
        ...(status ? { status } : {}),
      };
    })
    .filter((x): x is RequirementsServiceFlowActorV1 => Boolean(x));

  if (!createdAt || !updatedAt) return null;
  let structureLockedAt: string | null | undefined;
  if ("structureLockedAt" in o) {
    if (o.structureLockedAt === null) structureLockedAt = null;
    else if (typeof o.structureLockedAt === "string" && o.structureLockedAt.trim()) structureLockedAt = o.structureLockedAt.trim();
    else structureLockedAt = undefined;
  }

  const keySet = new Set<string>(REQUIREMENTS_SERVICE_FLOW_CHECKLIST_KEYS);
  let checklistDeferrals: Partial<Record<RequirementsServiceFlowChecklistKey, RequirementsServiceFlowChecklistDeferralKind>> | null | undefined;
  if ("checklistDeferrals" in o) {
    if (o.checklistDeferrals === null) checklistDeferrals = null;
    else if (o.checklistDeferrals && typeof o.checklistDeferrals === "object") {
      const d = o.checklistDeferrals as Record<string, unknown>;
      const partial: Partial<Record<RequirementsServiceFlowChecklistKey, RequirementsServiceFlowChecklistDeferralKind>> = {};
      for (const [k, v] of Object.entries(d)) {
        if (!keySet.has(k)) continue;
        if (v === "pending" || v === "deferred_next") {
          partial[k as RequirementsServiceFlowChecklistKey] = v;
        }
      }
      checklistDeferrals = Object.keys(partial).length ? partial : undefined;
    } else checklistDeferrals = undefined;
  }

  const acceptedProposalSnapshot =
    "acceptedProposalSnapshot" in o
      ? o.acceptedProposalSnapshot === null
        ? null
        : typeof o.acceptedProposalSnapshot === "string"
          ? o.acceptedProposalSnapshot.slice(0, 8000)
          : undefined
      : undefined;
  const proposalAcceptedAt =
    typeof o.proposalAcceptedAt === "string" && o.proposalAcceptedAt.trim()
      ? o.proposalAcceptedAt.trim()
      : undefined;
  const lastProposalDecision =
    typeof o.lastProposalDecision === "string" && o.lastProposalDecision.trim()
      ? o.lastProposalDecision.trim().slice(0, 40)
      : undefined;
  const acceptedProposalFingerprint =
    typeof o.acceptedProposalFingerprint === "string" && o.acceptedProposalFingerprint.trim()
      ? o.acceptedProposalFingerprint.trim().slice(0, 80)
      : undefined;

  const conversationStateRaw = "conversationState" in o ? o.conversationState : undefined;
  const conversationStateValid = new Set<ServiceFlowConversationStateWire>([
    "PROPOSAL",
    "REVIEW",
    "APPROVED",
    "FEATURE_DETAIL",
  ]);
  let conversationState: ServiceFlowConversationStateWire | null | undefined;
  if (conversationStateRaw === null) conversationState = null;
  else if (typeof conversationStateRaw === "string" && conversationStateValid.has(conversationStateRaw as ServiceFlowConversationStateWire)) {
    conversationState = conversationStateRaw as ServiceFlowConversationStateWire;
  }

  return {
    createdAt,
    updatedAt,
    steps,
    actors,
    ...(structureLockedAt !== undefined ? { structureLockedAt } : {}),
    ...(checklistDeferrals !== undefined ? { checklistDeferrals } : {}),
    ...(acceptedProposalSnapshot !== undefined ? { acceptedProposalSnapshot } : {}),
    ...(proposalAcceptedAt ? { proposalAcceptedAt } : {}),
    ...(lastProposalDecision ? { lastProposalDecision } : {}),
    ...(acceptedProposalFingerprint ? { acceptedProposalFingerprint } : {}),
    ...(conversationState !== undefined ? { conversationState } : {}),
    ...(typeof o.proposalVariantMode === "string" &&
    (o.proposalVariantMode === "PRIMARY" || o.proposalVariantMode === "ALTERNATIVE")
      ? { proposalVariantMode: o.proposalVariantMode }
      : {}),
    ...(typeof o.reviewMode === "string" &&
    (o.reviewMode === "PRIMARY_REVIEW" || o.reviewMode === "ALTERNATIVE_REVIEW")
      ? { reviewMode: o.reviewMode }
      : {}),
    ...(typeof o.primaryProposalFingerprint === "string" && o.primaryProposalFingerprint.trim()
      ? { primaryProposalFingerprint: o.primaryProposalFingerprint.trim().slice(0, 80) }
      : {}),
    ...(typeof o.alternativeProposalFingerprint === "string" && o.alternativeProposalFingerprint.trim()
      ? { alternativeProposalFingerprint: o.alternativeProposalFingerprint.trim().slice(0, 80) }
      : {}),
    ...(o.alternativeProposalPayload === null ? { alternativeProposalPayload: null } : {}),
    ...(o.alternativeProposalPayload && typeof o.alternativeProposalPayload === "object"
      ? (() => {
          const parsed = parseAlternativeProposalPayloadWire(o.alternativeProposalPayload);
          return parsed ? { alternativeProposalPayload: parsed } : {};
        })()
      : {}),
    ...(typeof o.flowApproved === "boolean" ? { flowApproved: o.flowApproved } : {}),
    ...(o.flowApprovedAt === null ? { flowApprovedAt: null } : {}),
    ...(typeof o.flowApprovedAt === "string" && o.flowApprovedAt.trim()
      ? { flowApprovedAt: o.flowApprovedAt.trim() }
      : {}),
    ...(typeof o.flowApprovedBy === "string" && o.flowApprovedBy.trim()
      ? { flowApprovedBy: o.flowApprovedBy.trim().slice(0, 120) }
      : {}),
    ...(typeof o.activeFlowVersion === "string" && o.activeFlowVersion.trim()
      ? { activeFlowVersion: o.activeFlowVersion.trim().slice(0, 80) }
      : {}),
    ...(o.documentationStatus === "completed" || o.documentationStatus === "draft"
      ? { documentationStatus: o.documentationStatus }
      : {}),
    ...(o.documentationCompletedAt === null ? { documentationCompletedAt: null } : {}),
    ...(typeof o.documentationCompletedAt === "string" && o.documentationCompletedAt.trim()
      ? { documentationCompletedAt: o.documentationCompletedAt.trim() }
      : {}),
    ...(o.documentationSnapshot === null ? { documentationSnapshot: null } : {}),
    ...(typeof o.documentationSnapshot === "string"
      ? { documentationSnapshot: o.documentationSnapshot.slice(0, 8000) }
      : {}),
    ...(() => {
      const m = o.lastStructuredActorMutation;
      if (!m || typeof m !== "object") return {};
      const r = m as Record<string, unknown>;
      const actorId = typeof r.actorId === "string" ? r.actorId.trim() : "";
      const createdAt = typeof r.createdAt === "string" ? r.createdAt.trim() : "";
      const mutationSource = r.mutationSource === "actor_drawer" ? ("actor_drawer" as const) : null;
      const affectedStepIds = Array.isArray(r.affectedStepIds)
        ? (r.affectedStepIds as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean)
        : [];
      const projectionId =
        typeof r.projectionId === "string" && r.projectionId.trim() ? r.projectionId.trim().slice(0, 80) : undefined;
      if (!mutationSource || !actorId || !createdAt) return {};
      return {
        lastStructuredActorMutation: {
          mutationSource,
          actorId,
          affectedStepIds,
          createdAt,
          ...(projectionId ? { projectionId } : {}),
        },
      };
    })(),
    ...(() => {
      const m = o.lastAssignmentMutation;
      if (!m || typeof m !== "object") return {};
      const r = m as Record<string, unknown>;
      const stepId = typeof r.stepId === "string" ? r.stepId.trim() : "";
      const createdAt = typeof r.createdAt === "string" ? r.createdAt.trim() : "";
      const mutationSource = r.mutationSource === "assignment_drawer" ? ("assignment_drawer" as const) : null;
      const assignmentAction = typeof r.assignmentAction === "string" ? r.assignmentAction.trim().slice(0, 40) : "";
      const assignmentType = typeof r.assignmentType === "string" ? r.assignmentType.trim().slice(0, 24) : "";
      const affectedStepIds = Array.isArray(r.affectedStepIds)
        ? (r.affectedStepIds as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean)
        : [];
      const previousActorId =
        typeof r.previousActorId === "string" && r.previousActorId.trim()
          ? r.previousActorId.trim().slice(0, 90)
          : undefined;
      const nextActorId =
        typeof r.nextActorId === "string" && r.nextActorId.trim()
          ? r.nextActorId.trim().slice(0, 90)
          : undefined;
      const projectionId =
        typeof r.projectionId === "string" && r.projectionId.trim() ? r.projectionId.trim().slice(0, 80) : undefined;
      if (!mutationSource || !stepId || !createdAt || !assignmentAction || !assignmentType) return {};
      return {
        lastAssignmentMutation: {
          mutationSource,
          assignmentAction,
          stepId,
          assignmentType,
          affectedStepIds,
          createdAt,
          ...(previousActorId ? { previousActorId } : {}),
          ...(nextActorId ? { nextActorId } : {}),
          ...(projectionId ? { projectionId } : {}),
        },
      };
    })(),
  };
}

const ORCHESTRATION_STAGE_WIRE = new Set<RequirementsOrchestrationStageWire>([
  "IDEATION",
  "SERVICE_FLOW_REVIEW",
  "FEATURE_DETAIL",
  "DOCUMENTATION_COMPLETE",
]);

export function parseRequirementsOrchestrationStageV1(
  raw: unknown,
): RequirementsOrchestrationStageV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const currentStage = typeof o.currentStage === "string" ? o.currentStage.trim() : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt.trim() : "";
  if (!ORCHESTRATION_STAGE_WIRE.has(currentStage as RequirementsOrchestrationStageWire) || !updatedAt) {
    return null;
  }
  const completedStages = Array.isArray(o.completedStages)
    ? o.completedStages.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 24)
    : [];
  const activePhase =
    o.activePhase === null
      ? null
      : typeof o.activePhase === "string" && o.activePhase.trim()
        ? o.activePhase.trim().slice(0, 80)
        : undefined;
  return {
    currentStage: currentStage as RequirementsOrchestrationStageWire,
    completedStages,
    updatedAt,
    ...(activePhase !== undefined ? { activePhase } : {}),
  };
}

import type { SingleChatProposalLifecycleV1 } from "@/lib/requirements/singleChatProposalLifecycle";

/** SingleChat 내부 슬롯 lifecycle — UI 비노출 */
export type SingleChatOrchestrationSlotStatus =
  | "empty"
  | "partial"
  /** 분석가/설계자 후보 — planner 미확정 */
  | "candidate"
  /** planner 기준 안정화 */
  | "confirmed"
  /** 상위 슬롯 변경 등으로 재검토 필요 */
  | "stale"
  /** 외부 의존/정책 확정 전 잠금(진행 차단) */
  | "blocked"
  /** specialist 간 상충/트레이드오프 존재(조정 필요) */
  | "conflicted"
  /** 하위 호환: 저장된 completed → 파싱 시 confirmed 로 정규화 */
  | "completed";

export type SingleChatOrchestrationSlotV1 = Readonly<{
  slotKey: string;
  ownerAgent: string;
  stageGroup: string;
  label: string;
  status: SingleChatOrchestrationSlotStatus;
  value?: string | null;
  confidence?: number | null;
  updatedAt: string;
  /** 이 슬롯이 의존하는 상위 slotKey(직접) */
  dependsOn?: readonly string[];
  /** 파생 출처(예: specialist:service-designer) */
  derivedFrom?: string | null;
  staleReason?: string | null;
  revision?: number;
}>;

export type SingleChatDynamicSlotPriority = "high" | "medium" | "low";

/**
 * 검증 전 LLM/planner-route 제안 스냅샷.
 * `ownerAgent`는 프롬프트 전용 외부 네임스페이스(planner|analyst|architect|designer|reviewer|security).
 */
export type SingleChatDynamicSlotProposalWireV1 = Readonly<{
  slotKey: string;
  title: string;
  description: string;
  ownerAgent: string;
  reason?: string | null;
  priority?: SingleChatDynamicSlotPriority | null;
  proposalConfidence?: number | null;
}>;

/**
 * 검증 통과 후 저장되는 동적 슬롯 정의.
 * `ownerAgent`는 런타임 오케스트레이션 내부 역할(planner|service-designer|…).
 */
export type SingleChatDynamicSlotDefinitionV1 = Readonly<{
  /** 반드시 `dyn_` prefix를 포함한 안전 키 */
  slotKey: string;
  title: string;
  description: string;
  ownerAgent: string;
  /** 제안 시 LLM 외부 역할(감사·UI용, 선택) */
  externalProposedOwner?: string | null;
  reason?: string | null;
  priority?: SingleChatDynamicSlotPriority | null;
  proposalConfidence?: number | null;
  proposedAt?: string | null;
}>;

export type SingleChatDynamicSlotValidationRejectionV1 = Readonly<{
  slotKey: string;
  reason: string;
  rejectedAt: string;
}>;

export type SingleChatDynamicSlotProposalHistoryV1 = Readonly<{
  proposedAt: string;
  /** 검증에 사용한 제안 스냅샷(외부 owner 네임스페이스) */
  suggestedSlots: readonly SingleChatDynamicSlotProposalWireV1[];
  acceptedSlotKeys: readonly string[];
  rejected: readonly SingleChatDynamicSlotValidationRejectionV1[];
}>;

/** 프로젝트 `requirementsStateJson.singleChatOrchestrationV1` — 스키마 2 */
export type RequirementsSingleChatOrchestrationStateV1 = Readonly<{
  version: 1 | 2;
  stageGroup: string;
  slotDefinitionsHash: string;
  slots: Record<string, SingleChatOrchestrationSlotV1>;
  /** bootstrap initializer 메타(LLM 산출). DB 마이그레이션 없이 optional로 저장 */
  bootstrapMeta?: {
    detectedDomain?: string | null;
    missingInformation?: readonly string[];
    recommendedFocus?: string | null;
    initialOwnershipHints?: readonly { slotKey: string; ownerAgent: string }[];
  } | null;
  /** 진행률(분모)용 — base 슬롯 키 목록(동적 슬롯 제외) */
  baseSlotKeys?: readonly string[];
  /** 검증 통과해 채택된 동적 슬롯 정의 */
  dynamicSlots?: Record<string, SingleChatDynamicSlotDefinitionV1>;
  rejectedDynamicSlots?: readonly SingleChatDynamicSlotValidationRejectionV1[];
  slotProposalHistory?: readonly SingleChatDynamicSlotProposalHistoryV1[];
  lastOrchestratorAgent?: string | null;
  /** 이전 턴 conversationOwner (UX/진단; optional) */
  lastConversationOwner?: string | null;
  /** explicit mention 등으로 고정된 active owner (persistence; optional) */
  activeConversationOwner?: string | null;
  /** active owner 고정 남은 턴 수 (persistence; optional) */
  stickyTurnsRemaining?: number | null;
  /** owner momentum (stabilization; optional for backward compatibility) */
  ownerMomentum?: Record<string, number> | null;
  /** 직전 턴 decisionAxis (persistence; optional) */
  lastDecisionAxis?: string | null;
  /** 직전 턴 decisionAxisCandidates (persistence; optional) */
  lastDecisionAxisCandidates?: readonly { axis: string; score: number }[] | null;
  /** 최근 assistant 질문(반복 질문 방지용) */
  recentAssistantQuestions?: readonly string[] | null;
  /** proposal 승인·다음 단계 전환 상태 */
  proposalLifecycleV1?: SingleChatProposalLifecycleV1 | null;
  /** 마지막 턴에서 실제 LLM이 실행된 specialist 역할(플래너 제외) */
  lastDelegatedAgents?: readonly string[];
  lastRoutingDecision?: string | null;
  updatedAt: string;
}>;

export type SingleChatOrchestrationSlotDefinition = Readonly<{
  slotKey: string;
  label: string;
  ownerAgent: string;
  stageGroup: string;
  hints?: string;
  dependsOn?: readonly string[];
}>;

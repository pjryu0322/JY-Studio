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

/** LLM이 제안한 동적 슬롯 정의(저장·검증 대상) */
export type SingleChatDynamicSlotDefinitionV1 = Readonly<{
  /** 반드시 `dyn_` prefix를 포함한 안전 키 */
  slotKey: string;
  title: string;
  description: string;
  /** 제안 owner(허용: planner|analyst|architect|designer|reviewer|security) */
  ownerAgent: string;
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
  /** 원문 제안(검증 전) */
  suggestedSlots: readonly Omit<SingleChatDynamicSlotDefinitionV1, "proposedAt">[];
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

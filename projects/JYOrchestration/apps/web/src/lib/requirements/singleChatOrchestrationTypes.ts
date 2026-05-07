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

/** 프로젝트 `requirementsStateJson.singleChatOrchestrationV1` — 스키마 2 */
export type RequirementsSingleChatOrchestrationStateV1 = Readonly<{
  version: 1 | 2;
  stageGroup: string;
  slotDefinitionsHash: string;
  slots: Record<string, SingleChatOrchestrationSlotV1>;
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

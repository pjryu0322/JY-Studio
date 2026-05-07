/** SingleChat 내부 슬롯 상태 — UI 노출 없이 저장·복원 */
export type SingleChatOrchestrationSlotStatus = "empty" | "partial" | "completed";

export type SingleChatOrchestrationSlotV1 = Readonly<{
  slotKey: string;
  ownerAgent: string;
  stageGroup: string;
  label: string;
  status: SingleChatOrchestrationSlotStatus;
  value?: string | null;
  confidence?: number | null;
  updatedAt: string;
}>;

/** 프로젝트 `requirementsStateJson.singleChatOrchestrationV1` */
export type RequirementsSingleChatOrchestrationStateV1 = Readonly<{
  version: 1;
  stageGroup: string;
  slotDefinitionsHash: string;
  slots: Record<string, SingleChatOrchestrationSlotV1>;
  lastOrchestratorAgent?: string | null;
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
}>;

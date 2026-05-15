/**
 * H9 — Resource Orchestration **Planning** metadata (read-only).
 *
 * 실제 provider 할당·토큰 강제·프루닝·라우팅 변경 없음.
 */

import type { OverlayContextBudgetPolicy } from "@/lib/overlay/overlayContextBudget";

/** 계획 관점의 자원·검색 사용 태도(실행 정책 아님). */
export type ResourceOrchestrationStance = "minimal" | "balanced" | "expanded";

export type RoleResourcePlan = Readonly<{
  /** 원본 overlay identity roleKey(정규화 전 문자열 그대로). */
  rawRoleKey: string | null;
  /** 레지스트리에 매칭된 계약 roleKey(없으면 null). */
  resolvedContractRoleKey: string | null;
  providerPlanLabel: string;
  retrievalStance: ResourceOrchestrationStance;
  memoryStance: ResourceOrchestrationStance;
  knowledgeStance: ResourceOrchestrationStance;
  orchestrationConcurrencyHint: string;
  planningDisclaimer: string;
}>;

export type ResourcePressureLevel = "low" | "medium" | "high";

export type ResourcePressureSummary = Readonly<{
  level: ResourcePressureLevel;
  score: number;
  factors: readonly string[];
}>;

export type ContextBudgetRecommendation = Readonly<{
  currentPolicy: OverlayContextBudgetPolicy | null;
  recommendedPolicy: OverlayContextBudgetPolicy;
  aligned: boolean;
  rationale: string;
}>;

export type ResourceOrchestrationPlanningCore = Readonly<{
  roleKey: string | null;
  plan: RoleResourcePlan;
  pressure: ResourcePressureSummary;
  recommendation: ContextBudgetRecommendation;
}>;

/**
 * H10 — Controlled Runtime Trial **준비** 메타데이터(read-only).
 *
 * 실제 런타임 오케스트레이션·라우팅·강제 없음.
 */

import type { HarnessMaturityLayer } from "@/lib/harness/maturity/harnessMaturityTypes";

/** 통제 시험 문서화 전 단계의 준비도(실행 허가 아님). */
export type RuntimeTrialReadinessLevel =
  | "not_prepared"
  | "preparation_partial"
  | "ready_for_documented_trial";

export type RuntimeTrialReadinessReport = Readonly<{
  mode: "controlled_runtime_trial_preparation";
  readinessLevel: RuntimeTrialReadinessLevel;
  actualRuntimeOrchestrationEnabled: false;
  actualProviderRoutingEnabled: false;
  actualExecutionRoutingEnabled: false;
  actualTokenEnforcementEnabled: false;
  actualContextPruningEnabled: false;
  actualRetrievalOrchestrationEnabled: false;
  /** maturity baseline에서 missing/partial인 계층 id. */
  unstableHarnessLayers: readonly HarnessMaturityLayer[];
  /** 운영자 표시용 한글 라벨(동일 순서). */
  unstableLayerLabelsKo: readonly string[];
  preparationNotes: readonly string[];
}>;

export type RuntimeRiskSummaryWire = Readonly<{
  overallRiskLabelKo: string;
  riskFactors: readonly string[];
  resourcePressureSeverity: string;
  releaseGateReadinessLevel: string;
}>;

export type RuntimeSimulationActionRow = Readonly<{
  labelKo: string;
  wouldOccur: false;
}>;

export type RuntimeSimulationSummary = Readonly<{
  mode: "dry_run_simulation_metadata_only";
  disclaimerKo: string;
  simulatedActions: readonly RuntimeSimulationActionRow[];
}>;

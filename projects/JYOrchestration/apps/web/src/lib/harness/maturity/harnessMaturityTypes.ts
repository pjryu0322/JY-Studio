/**
 * Harness Phase H8 — **Runtime Maturity Baseline** 타입.
 *
 * read-only 진단·기준화 전용. 실제 실행·라우팅·차단·payload 변경 없음.
 */

export type HarnessMaturityLayer =
  | "prompt_assembly_preview"
  | "apply_readiness"
  | "knowledge_activation"
  | "memory_runtime"
  | "memory_stabilization"
  | "execution_routing"
  | "execution_safety"
  | "review_security"
  | "issue_planning"
  | "message_explainability";

export type HarnessMaturityStatus =
  | "missing"
  | "partial"
  | "ready_read_only"
  | "ready_for_controlled_trial";

export type HarnessExposureLevel = "internal_only" | "operator_visible" | "user_visible_summary";

export type HarnessMaturityLayerStatus = Readonly<{
  layer: HarnessMaturityLayer;
  status: HarnessMaturityStatus;
  exposureLevel: HarnessExposureLevel;
  evidenceCount: number;
  missingSignals: readonly string[];
  warnings: readonly string[];
}>;

export type HarnessMaturityFinding = Readonly<{
  code: string;
  severity: "info" | "warning";
  message: string;
}>;

export type HarnessMaturityBaselineReport = Readonly<{
  mode: "read_only_maturity_baseline";
  overallStatus: HarnessMaturityStatus;
  layers: readonly HarnessMaturityLayerStatus[];
  readyReadOnlyCount: number;
  partialCount: number;
  missingCount: number;
  userVisibleSummaryReady: boolean;
  controlledTrialReady: boolean;
  findings: readonly HarnessMaturityFinding[];
}>;

export type HarnessReleaseGateReadinessReport = Readonly<{
  mode: "read_only_release_gate_readiness";
  actualPromptAssemblyAllowed: false;
  actualRetrievalOrchestrationAllowed: false;
  actualProviderRoutingAllowed: false;
  actualBlockingAllowed: false;
  readinessLevel: "not_ready" | "observe_more" | "candidate_for_manual_review";
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

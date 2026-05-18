/**
 * H14.5 — Runtime planning **consolidation & normalization** metadata(read-only).
 */

import type { RuntimeCoherencePlanningReports } from "@/lib/harness/runtimeCoherence/buildRuntimeCoherencePlanningReports";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { RuntimeEnforcementPlanningContext } from "@/lib/harness/runtimeEnforcement/buildRuntimeEnforcementPlanningContext";
import type { RuntimeLifecyclePlanningReports } from "@/lib/harness/runtimeLifecycle/buildRuntimeLifecyclePlanningReports";
import type { RuntimePriorityPlanningReports } from "@/lib/harness/runtimePriority/buildRuntimePriorityPlanningReports";
import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";

export type NormalizedRuntimePlanningContext = Readonly<{
  governanceCtx: RuntimeGovernancePlanningContext;
  enforcementPlanning: RuntimeEnforcementPlanningContext;
  stabilityReports: RuntimeStabilityPlanningReports;
  priorityReports: RuntimePriorityPlanningReports;
  lifecycleReports: RuntimeLifecyclePlanningReports;
  coherenceReports: RuntimeCoherencePlanningReports;
}>;

export type UnifiedRuntimePlanningLayerSnapshot = Readonly<{
  headline: string;
  detail?: string;
}>;

export type UnifiedRuntimePlanningSummary = Readonly<{
  mode: "unified_runtime_planning_summary";
  actualRuntimeOrchestrationEnabled: false;
  stability: UnifiedRuntimePlanningLayerSnapshot;
  priority: UnifiedRuntimePlanningLayerSnapshot;
  lifecycle: UnifiedRuntimePlanningLayerSnapshot;
  coherence: UnifiedRuntimePlanningLayerSnapshot;
  criticalIssues: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePlanningRedundancySummary = Readonly<{
  mode: "runtime_planning_redundancy_summary";
  actualRuntimeOrchestrationEnabled: false;
  duplicateSummaryGenerationRisk: "low" | "medium" | "high";
  duplicateSerializationRisk: "low" | "medium" | "high";
  duplicateOverlayMappingRisk: "low" | "medium" | "high";
  duplicateWarningGroupingRisk: "low" | "medium" | "high";
  consolidationApplied: true;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

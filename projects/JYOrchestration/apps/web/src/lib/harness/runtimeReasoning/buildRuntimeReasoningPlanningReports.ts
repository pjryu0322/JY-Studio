/**
 * H16.5 — unified reasoning·redundancy·normalized trace **planning 보고서** 일괄 산출.
 */

import type { RuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import type { RuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import type { RuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";
import { buildUnifiedRuntimeReasoningChain } from "./buildUnifiedRuntimeReasoningChain";
import { normalizeRuntimeReasoningTrace } from "./normalizeRuntimeReasoningTrace";
import { evaluateRuntimeReasoningRedundancy } from "./evaluateRuntimeReasoningRedundancy";
import type {
  NormalizedRuntimeReasoningTrace,
  RuntimeReasoningRedundancySummary,
  UnifiedRuntimeReasoningChain,
} from "./runtimeReasoningTypes";

export type RuntimeReasoningPlanningReports = Readonly<{
  unifiedReasoningChain: UnifiedRuntimeReasoningChain;
  reasoningRedundancySummary: RuntimeReasoningRedundancySummary;
  normalizedReasoningTrace: NormalizedRuntimeReasoningTrace;
}>;

export function buildRuntimeReasoningPlanningReports(
  dependencyReports: RuntimeDependencyPlanningReports,
  criticalityReports: RuntimeCriticalityPlanningReports,
  traceabilityReports: RuntimeTraceabilityPlanningReports
): RuntimeReasoningPlanningReports {
  const unifiedReasoningChain = buildUnifiedRuntimeReasoningChain(traceabilityReports);
  const reasoningRedundancySummary = evaluateRuntimeReasoningRedundancy(
    dependencyReports,
    criticalityReports,
    traceabilityReports
  );
  const normalizedReasoningTrace = normalizeRuntimeReasoningTrace(
    traceabilityReports,
    unifiedReasoningChain
  );

  return { unifiedReasoningChain, reasoningRedundancySummary, normalizedReasoningTrace };
}

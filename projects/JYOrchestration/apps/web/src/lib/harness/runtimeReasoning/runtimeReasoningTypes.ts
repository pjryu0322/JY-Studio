/**
 * H16.5 — Runtime **reasoning consolidation** metadata(read-only).
 */

export type RuntimeReasoningRedundancyRisk = "low" | "medium" | "high";

export type UnifiedRuntimeReasoningChain = Readonly<{
  mode: "unified_runtime_reasoning_chain";
  actualRuntimeOrchestrationEnabled: false;
  reasoningNodes: readonly string[];
  reasoningEdges: readonly string[];
  criticalTransitions: readonly string[];
  stableOrdering: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeReasoningRedundancySummary = Readonly<{
  mode: "runtime_reasoning_redundancy_summary";
  actualRuntimeOrchestrationEnabled: false;
  duplicateReasoningGenerationRisk: RuntimeReasoningRedundancyRisk;
  duplicatePropagationTraceRisk: RuntimeReasoningRedundancyRisk;
  duplicateOverlayMappingRisk: RuntimeReasoningRedundancyRisk;
  duplicateLifecycleReasoningRisk: RuntimeReasoningRedundancyRisk;
  consolidationApplied: boolean;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type NormalizedRuntimeReasoningTrace = Readonly<{
  mode: "normalized_runtime_reasoning_trace";
  actualRuntimeOrchestrationEnabled: false;
  stableOrderedSteps: readonly string[];
  normalizedDependencyTraces: readonly string[];
  normalizedPriorityTraces: readonly string[];
  removedDuplicates: readonly string[];
  recommendations: readonly string[];
}>;

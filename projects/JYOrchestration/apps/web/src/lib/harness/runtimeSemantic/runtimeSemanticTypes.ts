/**
 * H17 — Runtime **semantic compression** metadata(read-only).
 */

export type RuntimeSemanticRedundancyRisk = "low" | "medium" | "high";

export type RuntimeSemanticGroupKind =
  | "governance"
  | "lifecycle"
  | "dependency"
  | "propagation"
  | "criticality"
  | "coherence"
  | "other";

export type RuntimeSemanticGroup = Readonly<{
  kind: RuntimeSemanticGroupKind;
  labelKo: string;
  compressedItems: readonly string[];
}>;

export type RuntimeSemanticGroupsSummary = Readonly<{
  mode: "runtime_semantic_groups_summary";
  actualRuntimeOrchestrationEnabled: false;
  groups: readonly RuntimeSemanticGroup[];
  totalItemCount: number;
  compressionRatioLabel: string;
  recommendations: readonly string[];
}>;

export type CompressedRuntimeReasoningTrace = Readonly<{
  mode: "compressed_runtime_reasoning_trace";
  actualRuntimeOrchestrationEnabled: false;
  compressedLines: readonly string[];
  originalItemCount: number;
  compressedItemCount: number;
  compressionRatioLabel: string;
  recommendations: readonly string[];
}>;

export type RuntimeSemanticRedundancySummary = Readonly<{
  mode: "runtime_semantic_redundancy_summary";
  actualRuntimeOrchestrationEnabled: false;
  duplicateSemanticGroupingRisk: RuntimeSemanticRedundancyRisk;
  duplicatePropagationCompressionRisk: RuntimeSemanticRedundancyRisk;
  duplicateOverlaySemanticMappingRisk: RuntimeSemanticRedundancyRisk;
  reasoningExplosionRisk: RuntimeSemanticRedundancyRisk;
  compressionApplied: boolean;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type StabilizedRuntimeSemanticOrdering = Readonly<{
  mode: "stabilized_runtime_semantic_ordering";
  actualRuntimeOrchestrationEnabled: false;
  orderedGroupLabels: readonly string[];
  orderedCompressedLines: readonly string[];
  recommendations: readonly string[];
}>;

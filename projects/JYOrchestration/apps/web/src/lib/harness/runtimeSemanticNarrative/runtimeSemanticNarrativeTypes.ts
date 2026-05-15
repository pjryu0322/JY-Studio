/**
 * H18.5 — Runtime **semantic narrative** & root-cause metadata(read-only).
 */

export type RuntimeSemanticNarrativeSeverity = "info" | "watch" | "critical_candidate";

export type RuntimeSemanticRootCauseKind =
  | "dependency_conflict"
  | "propagation_escalation"
  | "governance_conflict"
  | "hidden_trace"
  | "compression_quality"
  | "group_imbalance"
  | "reasoning_explosion"
  | "stable_planning";

export type RuntimeSemanticNarrative = Readonly<{
  id: string;
  severity: RuntimeSemanticNarrativeSeverity;
  narrativeKo: string;
  rootCauseKind: RuntimeSemanticRootCauseKind;
  relatedPath: string;
}>;

export type RuntimeSemanticRootCauseGroup = Readonly<{
  kind: RuntimeSemanticRootCauseKind;
  labelKo: string;
  warningCodes: readonly string[];
  collapsedWarningCount: number;
  primaryChain: readonly string[];
}>;

export type RuntimeSemanticNarrativeSummary = Readonly<{
  mode: "runtime_semantic_narrative_summary";
  actualRuntimeOrchestrationEnabled: false;
  narratives: readonly RuntimeSemanticNarrative[];
  topNarrativeKo: string;
  collapsedDuplicateWarnings: number;
  recommendations: readonly string[];
}>;

export type RuntimeSemanticGraphRelevanceRankedPath = Readonly<{
  path: string;
  relevanceScore: number;
  severity: RuntimeSemanticNarrativeSeverity;
}>;

export type RuntimeSemanticGraphRelevanceSummary = Readonly<{
  mode: "runtime_semantic_graph_relevance_summary";
  actualRuntimeOrchestrationEnabled: false;
  rankedPaths: readonly RuntimeSemanticGraphRelevanceRankedPath[];
  criticalPath: string;
  warningCollapseSummaryKo: string;
  recommendations: readonly string[];
}>;

export type RuntimeSemanticNarrativePlanningReports = Readonly<{
  semanticNarrativeSummary: RuntimeSemanticNarrativeSummary;
  semanticRootCauseGroups: readonly RuntimeSemanticRootCauseGroup[];
  semanticGraphRelevanceSummary: RuntimeSemanticGraphRelevanceSummary;
}>;

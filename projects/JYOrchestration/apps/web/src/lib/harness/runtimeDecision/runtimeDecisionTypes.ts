/**
 * H19.5 — Runtime **decision intelligence** & orchestration lineage metadata(read-only).
 */

export type RuntimeDecisionSeverity = "info" | "watch" | "critical_candidate";

export type RuntimeDecisionNodeType =
  | "warning"
  | "semantic"
  | "governance"
  | "routing"
  | "lifecycle"
  | "recommendation";

export type RuntimeDecisionNode = Readonly<{
  id: string;
  type: RuntimeDecisionNodeType;
  labelKo: string;
}>;

export type RuntimeDecisionEdgeRelation =
  | "causes"
  | "implies"
  | "recommends"
  | "propagates";

export type RuntimeDecisionEdge = Readonly<{
  from: string;
  to: string;
  relation: RuntimeDecisionEdgeRelation;
  labelKo: string;
}>;

export type RuntimeDecisionReason = Readonly<{
  code: string;
  severity: RuntimeDecisionSeverity;
  messageKo: string;
}>;

export type RuntimeDecisionLineage = Readonly<{
  mode: "runtime_decision_lineage";
  actualRuntimeOrchestrationEnabled: false;
  nodes: readonly RuntimeDecisionNode[];
  edges: readonly RuntimeDecisionEdge[];
  lineagePaths: readonly string[];
  primaryReason: RuntimeDecisionReason | null;
  recommendations: readonly string[];
}>;

export type RuntimeDecisionSnapshot = Readonly<{
  mode: "runtime_decision_snapshot";
  actualRuntimeOrchestrationEnabled: false;
  snapshotId: string;
  capturedAtLabel: string;
  topPriorityLabel: string;
  criticalPathLabel: string;
  coherenceLevel: "aligned" | "partial" | "divergent";
  summaryKo: string;
}>;

export type RuntimeRecommendationKind =
  | "stabilize_memory_scope"
  | "reduce_semantic_explosion"
  | "governance_review"
  | "routing_ambiguity"
  | "maintain_stable_planning";

export type RuntimeRecommendationEntry = Readonly<{
  kind: RuntimeRecommendationKind;
  labelKo: string;
  priority: number;
  severity: RuntimeDecisionSeverity;
}>;

export type RuntimeRecommendationSummary = Readonly<{
  mode: "runtime_recommendation_summary";
  actualRuntimeOrchestrationEnabled: false;
  recommendations: readonly RuntimeRecommendationEntry[];
  primaryRecommendationKo: string;
  routingImplicationKo: string;
}>;

export type RuntimeDecisionCoherenceDimension =
  | "governance"
  | "semantic"
  | "reasoning"
  | "routing"
  | "lifecycle"
  | "explainability";

export type RuntimeDecisionCoherence = Readonly<{
  mode: "runtime_decision_coherence";
  actualRuntimeOrchestrationEnabled: false;
  overallLevel: "aligned" | "partial" | "divergent";
  dimensions: readonly Readonly<{
    dimension: RuntimeDecisionCoherenceDimension;
    level: "aligned" | "partial" | "divergent";
    noteKo: string;
  }>[];
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeDecisionPlanningReports = Readonly<{
  runtimeDecisionLineage: RuntimeDecisionLineage;
  runtimeDecisionSnapshot: RuntimeDecisionSnapshot;
  runtimeRecommendationSummary: RuntimeRecommendationSummary;
  runtimeDecisionCoherence: RuntimeDecisionCoherence;
}>;

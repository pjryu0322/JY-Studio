/**
 * H18 — Runtime **semantic explainability graph** metadata(read-only).
 */

export type RuntimeSemanticGraphNodeType =
  | "reasoning"
  | "traceability"
  | "dependency"
  | "propagation"
  | "criticality"
  | "semantic_group"
  | "warning"
  | "quality";

export type RuntimeSemanticGraphEdgeType =
  | "causes"
  | "compresses"
  | "propagates"
  | "hides"
  | "explains"
  | "warns";

export type RuntimeSemanticGraphNode = Readonly<{
  id: string;
  type: RuntimeSemanticGraphNodeType;
  labelKo: string;
}>;

export type RuntimeSemanticGraphEdge = Readonly<{
  from: string;
  to: string;
  relation: RuntimeSemanticGraphEdgeType;
  labelKo: string;
}>;

export type RuntimeSemanticExplainabilityGraph = Readonly<{
  mode: "runtime_semantic_explainability_graph";
  actualRuntimeOrchestrationEnabled: false;
  nodes: readonly RuntimeSemanticGraphNode[];
  edges: readonly RuntimeSemanticGraphEdge[];
  causalPaths: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeSemanticWarningOrigin = Readonly<{
  warningCode: string;
  originChain: readonly string[];
  severity: "info" | "warning";
}>;

export type RuntimeSemanticWarningOriginSummary = Readonly<{
  mode: "runtime_semantic_warning_origin_summary";
  actualRuntimeOrchestrationEnabled: false;
  origins: readonly RuntimeSemanticWarningOrigin[];
  primaryOriginChain: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeSemanticExplosionRisk = "low" | "medium" | "high";

export type RuntimeSemanticExplosionRiskSummary = Readonly<{
  mode: "runtime_semantic_explosion_risk_summary";
  actualRuntimeOrchestrationEnabled: false;
  explosionRisk: RuntimeSemanticExplosionRisk;
  semanticGroupCount: number;
  compressedLineCount: number;
  warningCascadeCount: number;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

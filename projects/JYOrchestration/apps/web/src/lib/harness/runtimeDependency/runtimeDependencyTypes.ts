/**
 * H15 — Runtime planning **dependency graph** metadata(read-only).
 */

export type RuntimePlanningGraphNodeKind =
  | "governance"
  | "stability"
  | "priority"
  | "escalation"
  | "lifecycle"
  | "coherence"
  | "resource"
  | "explainability"
  | "review_security";

export type RuntimePlanningGraphNodeStatus = "healthy" | "watch" | "degraded" | "isolated";

export type RuntimePlanningGraphNode = Readonly<{
  id: string;
  kind: RuntimePlanningGraphNodeKind;
  labelKo: string;
  status: RuntimePlanningGraphNodeStatus;
}>;

export type RuntimePlanningGraphEdge = Readonly<{
  from: string;
  to: string;
  relationKo: string;
}>;

export type RuntimePlanningDependencyGraph = Readonly<{
  mode: "runtime_planning_dependency_graph";
  actualRuntimeOrchestrationEnabled: false;
  nodes: readonly RuntimePlanningGraphNode[];
  edges: readonly RuntimePlanningGraphEdge[];
  criticalDependencies: readonly string[];
  isolatedNodes: readonly string[];
  dependencyChains: readonly string[];
}>;

export type RuntimePlanningImpactPropagationSummary = Readonly<{
  mode: "runtime_planning_impact_propagation_summary";
  actualRuntimeOrchestrationEnabled: false;
  driftPropagationPaths: readonly string[];
  stalePropagationPaths: readonly string[];
  lifecyclePropagationNotes: readonly string[];
  governanceImpactNotes: readonly string[];
  resourceImpactNotes: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePlanningDependencyConflictSeverity = "low" | "medium" | "high";

export type RuntimePlanningDependencyConflictSummary = Readonly<{
  mode: "runtime_planning_dependency_conflict_summary";
  actualRuntimeOrchestrationEnabled: false;
  severity: RuntimePlanningDependencyConflictSeverity;
  circularDependencies: readonly string[];
  conflictingLifecycleSignals: readonly string[];
  duplicatedDependencies: readonly string[];
  staleDependencyChains: readonly string[];
  escalationConflicts: readonly string[];
  recommendations: readonly string[];
}>;

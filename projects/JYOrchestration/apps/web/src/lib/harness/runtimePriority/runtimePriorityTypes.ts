/**
 * H12.5 — Runtime planning **priority & escalation** metadata(read-only).
 */

export type RuntimePlanningPriority = "critical" | "high" | "medium" | "low";

export type RuntimeEscalationLevel = "none" | "watch" | "escalated" | "critical";

export type PlanningDependencyKind =
  | "governance"
  | "explainability"
  | "rollback"
  | "resource"
  | "review_security";

export type PlanningDependencyStatus = "ordered" | "blocked" | "critical";

export type PlanningDependencyRow = Readonly<{
  kind: PlanningDependencyKind;
  labelKo: string;
  priority: RuntimePlanningPriority;
  status: PlanningDependencyStatus;
  noteKo: string;
}>;

export type RuntimePlanningDependencyReport = Readonly<{
  mode: "runtime_planning_dependency_report";
  actualRuntimeOrchestrationEnabled: false;
  orderedDependencies: readonly PlanningDependencyRow[];
  blockedDependencies: readonly string[];
  criticalDependencies: readonly string[];
  dependencyCycles: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeEscalationSummary = Readonly<{
  mode: "runtime_escalation_summary";
  actualRuntimeOrchestrationEnabled: false;
  escalationLevel: RuntimeEscalationLevel;
  escalationReasons: readonly string[];
  criticalAreas: readonly string[];
  operatorAttentionRequired: boolean;
}>;

export type RuntimePlanningBottleneckKind =
  | "governance"
  | "review_security"
  | "explainability"
  | "overlay"
  | "resource";

export type RuntimePlanningBottleneckRow = Readonly<{
  kind: RuntimePlanningBottleneckKind;
  labelKo: string;
  priority: RuntimePlanningPriority;
  noteKo: string;
}>;

export type RuntimePlanningBottleneckSummary = Readonly<{
  mode: "runtime_planning_bottleneck_summary";
  actualRuntimeOrchestrationEnabled: false;
  overallPlanningPriority: RuntimePlanningPriority;
  bottlenecks: readonly RuntimePlanningBottleneckRow[];
  recommendations: readonly string[];
}>;

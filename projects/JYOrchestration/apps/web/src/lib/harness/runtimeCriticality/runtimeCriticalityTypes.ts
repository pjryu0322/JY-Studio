/**
 * H15.5 — Runtime planning **criticality & priority propagation** metadata(read-only).
 */

export type RuntimePlanningCriticalitySummary = Readonly<{
  mode: "runtime_planning_criticality_summary";
  actualRuntimeOrchestrationEnabled: false;
  criticalNodes: readonly string[];
  highPriorityNodes: readonly string[];
  lowPriorityNodes: readonly string[];
  criticalityScore: number;
  recommendations: readonly string[];
}>;

export type RuntimePriorityPropagationSummary = Readonly<{
  mode: "runtime_priority_propagation_summary";
  actualRuntimeOrchestrationEnabled: false;
  dependencyPriorityPaths: readonly string[];
  lifecyclePriorityPaths: readonly string[];
  escalationPriorityPaths: readonly string[];
  governancePriorityImpacts: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeEscalationPriorityFlowSummary = Readonly<{
  mode: "runtime_escalation_priority_flow_summary";
  actualRuntimeOrchestrationEnabled: false;
  staleEscalationPriorities: readonly string[];
  governanceEscalationPriorities: readonly string[];
  lifecycleEscalationChains: readonly string[];
  criticalDependencyEscalations: readonly string[];
  recommendations: readonly string[];
}>;

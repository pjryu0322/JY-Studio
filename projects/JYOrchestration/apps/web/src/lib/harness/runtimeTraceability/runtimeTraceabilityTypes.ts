/**
 * H16 — Runtime planning **traceability & reasoning chain** metadata(read-only).
 */

export type RuntimePlanningReasoningStep = Readonly<{
  id: string;
  kind: "governance" | "lifecycle" | "dependency" | "escalation" | "criticality" | "coherence";
  labelKo: string;
  explanationKo: string;
}>;

export type RuntimePlanningReasoningChain = Readonly<{
  mode: "runtime_planning_reasoning_chain";
  actualRuntimeOrchestrationEnabled: false;
  nodes: readonly string[];
  reasoningSteps: readonly RuntimePlanningReasoningStep[];
  dependencies: readonly string[];
  criticalTransitions: readonly string[];
  explanations: readonly string[];
}>;

export type RuntimeDependencyReasoningTraceSummary = Readonly<{
  mode: "runtime_dependency_reasoning_trace_summary";
  actualRuntimeOrchestrationEnabled: false;
  staleDependencyReasoning: readonly string[];
  propagationReasoning: readonly string[];
  lifecycleDependencyReasoning: readonly string[];
  governanceDependencyReasoning: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePriorityReasoningTraceSummary = Readonly<{
  mode: "runtime_priority_reasoning_trace_summary";
  actualRuntimeOrchestrationEnabled: false;
  escalationPriorityReasoning: readonly string[];
  criticalNodeReasoning: readonly string[];
  propagationReasoning: readonly string[];
  impactReasoning: readonly string[];
  recommendations: readonly string[];
}>;

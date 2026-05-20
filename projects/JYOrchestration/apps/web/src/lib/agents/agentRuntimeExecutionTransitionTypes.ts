/**
 * Read-only Agent Runtime execution transition design report (no execution wire).
 */

export type AgentRuntimeExecutionTransitionDecision = "ready_for_design" | "defer" | "blocked";

export type AgentRuntimeExecutionTransitionTarget =
  | "harness_execution"
  | "agent_execution_record"
  | "connector_execution_bridge"
  | "governance_enforcement"
  | "timeline_replay_persist"
  | "unknown";

export interface AgentRuntimeExecutionTransitionFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface AgentRuntimeExecutionTransitionReport {
  readonly mode: "read_only_execution_transition_decision";
  readonly decision: AgentRuntimeExecutionTransitionDecision;
  readonly target: AgentRuntimeExecutionTransitionTarget;
  readonly requiresOperatorApproval: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly requiresRegressionTest: boolean;
  readonly findings: readonly AgentRuntimeExecutionTransitionFinding[];
}

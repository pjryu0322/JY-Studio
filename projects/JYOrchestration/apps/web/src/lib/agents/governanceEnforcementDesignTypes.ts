/**
 * Read-only Governance enforcement apply design report (no runtime blocking).
 */

export type GovernanceEnforcementDesignDecision = "ready_for_policy_design" | "defer" | "blocked";

export type GovernanceEnforcementMode = "observe_only" | "warn_only" | "block_candidate";

export interface GovernanceEnforcementDesignFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface GovernanceEnforcementPolicyDecision {
  readonly policyId: string;
  readonly check: string;
  readonly enforcementMode: GovernanceEnforcementMode;
  readonly reason: string;
}

export interface GovernanceEnforcementDesignReport {
  readonly mode: "read_only_governance_enforcement_design";
  readonly decision: GovernanceEnforcementDesignDecision;
  readonly enforcementMode: GovernanceEnforcementMode;
  readonly requiresPolicyApproval: boolean;
  readonly requiresOperatorOverride: boolean;
  readonly requiresAuditLog: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly policyDecisions: readonly GovernanceEnforcementPolicyDecision[];
  readonly findings: readonly GovernanceEnforcementDesignFinding[];
}

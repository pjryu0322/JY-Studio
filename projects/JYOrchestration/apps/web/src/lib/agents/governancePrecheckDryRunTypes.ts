/**
 * Governance Pre-check Dry-run — policy candidate evaluation (no runtime blocking).
 */

export type GovernancePrecheckSeverity = "info" | "warning" | "blocking_candidate";

export type GovernancePrecheckStatus =
  | "not_evaluated"
  | "pass_candidate"
  | "warning_candidate"
  | "blocking_candidate";

export interface GovernancePolicyDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly severity: GovernancePrecheckSeverity;
  readonly appliesToChecks: readonly string[];
  readonly enabled: boolean;
}

export interface GovernancePrecheckFinding {
  readonly policyId: string;
  readonly check: string;
  readonly severity: GovernancePrecheckSeverity;
  readonly message: string;
}

export interface GovernancePrecheckDryRunResult {
  readonly mode: "dry_run";
  readonly status: GovernancePrecheckStatus;
  readonly requiredChecks: readonly string[];
  readonly evaluatedPolicyIds: readonly string[];
  readonly findings: readonly GovernancePrecheckFinding[];
  readonly warnings: readonly string[];
  readonly blockingCandidates: readonly string[];
}

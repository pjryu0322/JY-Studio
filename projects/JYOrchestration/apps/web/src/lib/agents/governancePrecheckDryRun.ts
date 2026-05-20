/**
 * Governance Pre-check Dry-run evaluator (no runtime blocking or persistence).
 */

import { getGovernancePoliciesForCheck } from "@/lib/agents/governancePolicyRegistry";
import type {
  GovernancePrecheckDryRunResult,
  GovernancePrecheckFinding,
  GovernancePrecheckStatus,
} from "@/lib/agents/governancePrecheckDryRunTypes";

const EMPTY_RESULT: GovernancePrecheckDryRunResult = {
  mode: "dry_run",
  status: "not_evaluated",
  requiredChecks: [],
  evaluatedPolicyIds: [],
  findings: [],
  warnings: [],
  blockingCandidates: [],
};

function deriveStatus(input: {
  readonly findings: readonly GovernancePrecheckFinding[];
  readonly blockingCandidates: readonly string[];
  readonly warnings: readonly string[];
  readonly hasChecks: boolean;
}): GovernancePrecheckStatus {
  if (!input.hasChecks) return "not_evaluated";
  if (input.blockingCandidates.length) return "blocking_candidate";
  if (
    input.warnings.length ||
    input.findings.some((f) => f.severity === "warning" || f.message.startsWith("unknown_governance_check:"))
  ) {
    return "warning_candidate";
  }
  if (input.findings.some((f) => f.severity === "info")) return "pass_candidate";
  return "pass_candidate";
}

/** Safe wrapper — never throws; does not perform actual governance blocking. */
export function evaluateGovernancePrecheckDryRun(input: {
  readonly requiredChecks: readonly string[];
  readonly agentId?: string;
  readonly capabilityId?: string;
}): GovernancePrecheckDryRunResult {
  try {
    // agentId/capabilityId reserved for Stage 2-5+ context-aware policy rules.
    void input.agentId;
    void input.capabilityId;

    const requiredChecks = [...new Set(input.requiredChecks.map((c) => String(c).trim()).filter(Boolean))];
    if (!requiredChecks.length) return { ...EMPTY_RESULT };

    const findings: GovernancePrecheckFinding[] = [];
    const warnings: string[] = [];
    const blockingCandidates: string[] = [];
    const evaluatedPolicyIds: string[] = [];

    for (const check of requiredChecks) {
      const policies = getGovernancePoliciesForCheck(check).filter((p) => p.enabled);
      if (!policies.length) {
        findings.push({
          policyId: "unknown",
          check,
          severity: "warning",
          message: `unknown_governance_check:${check}`,
        });
        warnings.push(`unknown_governance_check:${check}`);
        continue;
      }

      for (const policy of policies) {
        evaluatedPolicyIds.push(policy.id);
        findings.push({
          policyId: policy.id,
          check,
          severity: policy.severity,
          message: `policy_matched:${policy.id}`,
        });
        if (policy.severity === "blocking_candidate") {
          blockingCandidates.push(policy.id);
        }
      }
    }

    const status = deriveStatus({
      findings,
      blockingCandidates,
      warnings,
      hasChecks: true,
    });

    return {
      mode: "dry_run",
      status,
      requiredChecks,
      evaluatedPolicyIds: [...new Set(evaluatedPolicyIds)],
      findings,
      warnings,
      blockingCandidates,
    };
  } catch {
    return {
      ...EMPTY_RESULT,
      status: "warning_candidate",
      warnings: ["governance_precheck_eval_failed"],
    };
  }
}

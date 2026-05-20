/**
 * Evaluate Governance enforcement apply design from dry-run result (read-only).
 */

import type {
  GovernancePrecheckDryRunResult,
  GovernancePrecheckFinding,
} from "@/lib/agents/governancePrecheckDryRunTypes";
import type {
  GovernanceEnforcementDesignDecision,
  GovernanceEnforcementDesignFinding,
  GovernanceEnforcementDesignReport,
  GovernanceEnforcementMode,
  GovernanceEnforcementPolicyDecision,
} from "@/lib/agents/governanceEnforcementDesignTypes";

function finding(
  severity: GovernanceEnforcementDesignFinding["severity"],
  code: string,
  message: string,
): GovernanceEnforcementDesignFinding {
  return { severity, code, message };
}

function mapFindingToPolicyDecision(
  finding: GovernancePrecheckFinding,
): GovernanceEnforcementPolicyDecision {
  const policyId = String(finding.policyId ?? "unknown_policy").trim() || "unknown_policy";
  const check = String(finding.check ?? "").trim() || "unknown_check";

  if (finding.severity === "info") {
    return {
      policyId,
      check,
      enforcementMode: "observe_only",
      reason: finding.message,
    };
  }

  if (finding.severity === "warning") {
    return {
      policyId,
      check,
      enforcementMode: "warn_only",
      reason: finding.message,
    };
  }

  return {
    policyId,
    check,
    enforcementMode: "block_candidate",
    reason: finding.message,
  };
}

const STATUS_PLAN: Record<
  GovernancePrecheckDryRunResult["status"],
  {
    readonly decision: GovernanceEnforcementDesignDecision;
    readonly enforcementMode: GovernanceEnforcementMode;
  }
> = {
  not_evaluated: { decision: "defer", enforcementMode: "observe_only" },
  pass_candidate: { decision: "ready_for_policy_design", enforcementMode: "observe_only" },
  warning_candidate: { decision: "ready_for_policy_design", enforcementMode: "warn_only" },
  blocking_candidate: { decision: "defer", enforcementMode: "block_candidate" },
};

function resolveStatusPlan(status: GovernancePrecheckDryRunResult["status"]) {
  return STATUS_PLAN[status] ?? STATUS_PLAN.not_evaluated;
}

/** Read-only enforcement design — does not block dispatch, runtime, or policy storage. */
export function evaluateGovernanceEnforcementDesign(input: {
  readonly governanceDryRun: GovernancePrecheckDryRunResult;
}): GovernanceEnforcementDesignReport {
  const findings: GovernanceEnforcementDesignFinding[] = [];
  const gov = input.governanceDryRun;
  const status = gov.status;

  if (gov.warnings.length) {
    for (const w of gov.warnings) {
      findings.push(finding("warning", "governance_dry_run_warning", w));
    }
  }

  if (status === "blocking_candidate") {
    findings.push(
      finding(
        "info",
        "defer_blocking_enforcement",
        "blocking_candidate requires policy approval and rollback before enforcement wire",
      ),
    );
  }

  const policyDecisions = gov.findings.map(mapFindingToPolicyDecision);
  const { decision, enforcementMode } = resolveStatusPlan(status);
  const isBlockingCandidate = status === "blocking_candidate";

  return {
    mode: "read_only_governance_enforcement_design",
    decision,
    enforcementMode,
    requiresPolicyApproval: isBlockingCandidate,
    requiresOperatorOverride: isBlockingCandidate,
    requiresAuditLog: isBlockingCandidate,
    requiresRollbackPlan: isBlockingCandidate,
    policyDecisions,
    findings,
  };
}

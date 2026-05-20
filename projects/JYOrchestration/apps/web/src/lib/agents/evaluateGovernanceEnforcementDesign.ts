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

  if (finding.severity === "blocking_candidate") {
    return {
      policyId,
      check,
      enforcementMode: "block_candidate",
      reason: finding.message,
    };
  }

  return {
    policyId,
    check,
    enforcementMode: "observe_only",
    reason: finding.message,
  };
}

function appendBlockingCandidateDecisions(
  decisions: GovernanceEnforcementPolicyDecision[],
  blockingCandidates: readonly string[],
): GovernanceEnforcementPolicyDecision[] {
  const seen = new Set(decisions.map((d) => `${d.policyId}:${d.check}`));
  for (const candidate of blockingCandidates) {
    const check = String(candidate ?? "").trim() || "unknown_check";
    const key = `blocking_candidate:${check}`;
    if (seen.has(key)) continue;
    seen.add(key);
    decisions.push({
      policyId: "blocking_candidate",
      check,
      enforcementMode: "block_candidate",
      reason: `blocking candidate: ${check}`,
    });
  }
  return decisions;
}

function hasBlockCandidateDecision(
  decisions: readonly GovernanceEnforcementPolicyDecision[],
): boolean {
  return decisions.some((d) => d.enforcementMode === "block_candidate");
}

function appendStatusMismatchWarnings(input: {
  readonly status: GovernancePrecheckDryRunResult["status"];
  readonly findings: GovernanceEnforcementDesignFinding[];
  readonly policyDecisions: readonly GovernanceEnforcementPolicyDecision[];
  readonly govFindingsCount: number;
}): void {
  const { status, findings, policyDecisions, govFindingsCount } = input;

  if (status === "not_evaluated" && govFindingsCount > 0) {
    findings.push(
      finding(
        "warning",
        "not_evaluated_with_findings",
        "status is not_evaluated but governance findings are present",
      ),
    );
  }

  if (status === "warning_candidate" && policyDecisions.length === 0) {
    findings.push(
      finding(
        "warning",
        "status_findings_mismatch",
        "status is warning_candidate but no policy decisions were produced",
      ),
    );
  }

  if (status === "blocking_candidate" && !hasBlockCandidateDecision(policyDecisions)) {
    findings.push(
      finding(
        "warning",
        "blocking_candidate_without_policy_decision",
        "status is blocking_candidate but no block_candidate policy decision exists",
      ),
    );
  }
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

const REQUIRES_BY_MODE: Record<
  GovernanceEnforcementMode,
  {
    readonly requiresPolicyApproval: boolean;
    readonly requiresOperatorOverride: boolean;
    readonly requiresAuditLog: boolean;
    readonly requiresRollbackPlan: boolean;
  }
> = {
  observe_only: {
    requiresPolicyApproval: false,
    requiresOperatorOverride: false,
    requiresAuditLog: false,
    requiresRollbackPlan: false,
  },
  warn_only: {
    requiresPolicyApproval: false,
    requiresOperatorOverride: false,
    requiresAuditLog: true,
    requiresRollbackPlan: false,
  },
  block_candidate: {
    requiresPolicyApproval: true,
    requiresOperatorOverride: true,
    requiresAuditLog: true,
    requiresRollbackPlan: true,
  },
};

function resolveRequiresFlags(enforcementMode: GovernanceEnforcementMode) {
  return REQUIRES_BY_MODE[enforcementMode] ?? REQUIRES_BY_MODE.observe_only;
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

  const mappedDecisions = gov.findings.map(mapFindingToPolicyDecision);
  const policyDecisions = appendBlockingCandidateDecisions(
    [...mappedDecisions],
    gov.blockingCandidates,
  );

  appendStatusMismatchWarnings({
    status,
    findings,
    policyDecisions,
    govFindingsCount: gov.findings.length,
  });

  const { decision, enforcementMode } = resolveStatusPlan(status);
  const requires = resolveRequiresFlags(enforcementMode);

  return {
    mode: "read_only_governance_enforcement_design",
    decision,
    enforcementMode,
    ...requires,
    policyDecisions,
    findings,
  };
}

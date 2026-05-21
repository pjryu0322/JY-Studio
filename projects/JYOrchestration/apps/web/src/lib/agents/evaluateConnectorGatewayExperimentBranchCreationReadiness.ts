/**
 * Evaluate Connector Gateway experiment branch creation readiness (read-only; no git/flag/routing execution).
 */

import { evaluateConnectorGatewayExperimentBranchApproval } from "@/lib/agents/evaluateConnectorGatewayExperimentBranchApproval";
import type { ConnectorGatewayExperimentBranchApprovalReport } from "@/lib/agents/connectorGatewayExperimentBranchApprovalTypes";
import type { ConnectorGatewayExperimentBranchApprovalDecision } from "@/lib/agents/connectorGatewayExperimentBranchApprovalTypes";
import type {
  ConnectorGatewayExperimentBranchCreationChecklistItem,
  ConnectorGatewayExperimentBranchCreationCommandCandidate,
  ConnectorGatewayExperimentBranchCreationReadinessDecision,
  ConnectorGatewayExperimentBranchCreationReadinessFinding,
  ConnectorGatewayExperimentBranchCreationReadinessReport,
} from "@/lib/agents/connectorGatewayExperimentBranchCreationReadinessTypes";

const COMMAND_CAUTION =
  "read-only candidate; do not execute without explicit user approval";

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function finding(
  severity: ConnectorGatewayExperimentBranchCreationReadinessFinding["severity"],
  code: string,
  message: string,
): ConnectorGatewayExperimentBranchCreationReadinessFinding {
  return { severity, code, message };
}

export function isSafeBranchName(branchName: string): boolean {
  return (
    /^[a-zA-Z0-9._/-]+$/.test(branchName) &&
    !branchName.includes("..") &&
    !branchName.startsWith("/") &&
    !branchName.endsWith("/") &&
    !branchName.includes("//")
  );
}

export function isSafeFeatureFlagName(flagName: string): boolean {
  return /^[A-Z0-9_]+$/.test(flagName);
}

function mapApprovalToReadinessDecision(
  approvalDecision: ConnectorGatewayExperimentBranchApprovalDecision,
): ConnectorGatewayExperimentBranchCreationReadinessDecision {
  switch (approvalDecision) {
    case "ready_for_operator_approval":
      return "ready_for_explicit_user_approval";
    case "defer":
      return "defer";
    case "blocked":
      return "blocked";
    default:
      return "blocked";
  }
}

function resolveReadinessDecision(input: {
  readonly approval: ConnectorGatewayExperimentBranchApprovalReport;
}): ConnectorGatewayExperimentBranchCreationReadinessDecision {
  let decision = mapApprovalToReadinessDecision(input.approval.decision);

  if (decision === "ready_for_explicit_user_approval") {
    if (!isSafeBranchName(input.approval.recommendedBranchName)) {
      decision = "blocked";
    } else if (!isSafeFeatureFlagName(input.approval.featureFlagName)) {
      decision = "blocked";
    }
  }

  return decision;
}

function buildCommandCandidates(input: {
  readonly decision: ConnectorGatewayExperimentBranchCreationReadinessDecision;
  readonly recommendedBranchName: string;
}): ConnectorGatewayExperimentBranchCreationCommandCandidate[] {
  if (input.decision !== "ready_for_explicit_user_approval" || !input.recommendedBranchName) {
    return [];
  }

  const branch = input.recommendedBranchName;
  const caution = COMMAND_CAUTION;

  return [
    {
      command: "git fetch origin",
      purpose: "sync remote refs before creating experiment branch",
      allowedAfterExplicitApproval: true,
      caution,
    },
    {
      command: "git checkout main",
      purpose: "base experiment branch on main",
      allowedAfterExplicitApproval: true,
      caution,
    },
    {
      command: "git pull --ff-only origin main",
      purpose: "fast-forward main before branch creation",
      allowedAfterExplicitApproval: true,
      caution,
    },
    {
      command: `git checkout -b ${branch}`,
      purpose: "create connector gateway experiment branch after explicit user approval",
      allowedAfterExplicitApproval: true,
      caution,
    },
  ];
}

function buildApprovalChecklist(input: {
  readonly decision: ConnectorGatewayExperimentBranchCreationReadinessDecision;
  readonly approvalDecision: ConnectorGatewayExperimentBranchApprovalDecision;
  readonly recommendedBranchName: string;
  readonly featureFlagDefault: "off";
  readonly requiresDirectCallFallback: boolean;
  readonly requiredRegressionSuites: readonly string[];
  readonly validationSuites: readonly string[];
  readonly rollbackCriteria: readonly string[];
}): ConnectorGatewayExperimentBranchCreationChecklistItem[] {
  const isReady = input.decision === "ready_for_explicit_user_approval";
  const regressionDefined =
    input.requiredRegressionSuites.length > 0 || input.validationSuites.length > 0;

  return [
    {
      item: "source approval ready",
      satisfied: input.approvalDecision === "ready_for_operator_approval",
      reason:
        input.approvalDecision === "ready_for_operator_approval"
          ? "branch approval is ready for operator review"
          : "branch approval is not ready",
    },
    {
      item: "explicit user approval required",
      satisfied: true,
      reason: "explicit user approval is required before branch creation",
    },
    {
      item: "branch name selected",
      satisfied: isReady && input.recommendedBranchName.length > 0,
      reason:
        input.recommendedBranchName.length > 0
          ? "experiment branch name is defined"
          : "experiment branch name missing",
    },
    {
      item: "feature flag default off",
      satisfied: input.featureFlagDefault === "off",
      reason: "feature flag must default to off",
    },
    {
      item: "direct call fallback preserved",
      satisfied: isReady ? input.requiresDirectCallFallback : false,
      reason: "direct call fallback is required during experiment",
    },
    {
      item: "regression checklist defined",
      satisfied: isReady ? regressionDefined : false,
      reason: regressionDefined
        ? "regression checklist is defined"
        : "regression checklist missing",
    },
    {
      item: "rollback criteria defined",
      satisfied: input.rollbackCriteria.length > 0,
      reason:
        input.rollbackCriteria.length > 0
          ? "rollback criteria are defined"
          : "rollback criteria missing",
    },
    {
      item: "no branch creation in this step",
      satisfied: true,
      reason: "this evaluator does not create git branches",
    },
    {
      item: "no feature flag wire in this step",
      satisfied: true,
      reason: "this evaluator does not wire feature flags",
    },
    {
      item: "no routing change in this step",
      satisfied: true,
      reason: "this evaluator does not change connector routing",
    },
  ];
}

function appendReadinessFindings(input: {
  readonly findings: ConnectorGatewayExperimentBranchCreationReadinessFinding[];
  readonly decision: ConnectorGatewayExperimentBranchCreationReadinessDecision;
  readonly approvalDecision: ConnectorGatewayExperimentBranchApprovalDecision;
  readonly approval: ConnectorGatewayExperimentBranchApprovalReport;
  readonly regressionChecklist: readonly string[];
  readonly rollbackCriteria: readonly string[];
  readonly unsafeBranch: boolean;
  readonly unsafeFlag: boolean;
}): void {
  const { findings, decision, approvalDecision, approval } = input;

  findings.push(
    finding(
      "info",
      "branch_creation_readiness_read_only",
      "branch creation readiness is read-only; no git execution",
    ),
  );
  findings.push(
    finding("info", "explicit_user_approval_required", "explicit user approval is required before branch creation"),
  );
  findings.push(finding("info", "no_git_branch_creation", "does not create git branches"));
  findings.push(finding("info", "no_feature_flag_wire", "does not wire feature flags"));
  findings.push(finding("info", "no_routing_change", "does not change connector routing paths"));

  if (input.unsafeBranch) {
    findings.push(finding("blocking", "unsafe_branch_name", "branch name failed safety validation"));
  }
  if (input.unsafeFlag) {
    findings.push(finding("blocking", "unsafe_feature_flag_name", "feature flag name failed safety validation"));
  }

  if (decision === "blocked") {
    findings.push(finding("blocking", "branch_creation_blocked", "branch creation is blocked"));
    if (approvalDecision === "blocked") {
      findings.push(finding("blocking", "source_approval_blocked", "source branch approval is blocked"));
    }
    return;
  }

  if (decision === "defer") {
    findings.push(finding("warning", "branch_creation_deferred", "branch creation defers until approval is ready"));
    findings.push(finding("warning", "source_approval_deferred", "source branch approval is deferred"));
    return;
  }

  findings.push(
    finding(
      "info",
      "branch_creation_ready_for_explicit_user_approval",
      "branch creation is ready for explicit user approval",
    ),
  );
  findings.push(
    finding("info", "command_candidates_are_not_executed", "command candidates are not executed by this evaluator"),
  );

  if (!approval.recommendedBranchName) {
    findings.push(finding("blocking", "missing_branch_name", "branch name is required for branch creation"));
  }
  if (!approval.featureFlagName) {
    findings.push(finding("blocking", "missing_feature_flag_name", "feature flag name is required for branch creation"));
  }
  if (input.regressionChecklist.length === 0) {
    findings.push(finding("blocking", "missing_regression_checklist", "regression checklist is required"));
  }
  if (input.rollbackCriteria.length === 0) {
    findings.push(finding("blocking", "missing_rollback_criteria", "rollback criteria are required"));
  }
}

/** Read-only branch creation readiness — does not execute git commands or wire flags/routing. */
export function evaluateConnectorGatewayExperimentBranchCreationReadiness(input: {
  readonly boundaryIds: readonly string[];
}): ConnectorGatewayExperimentBranchCreationReadinessReport {
  const approval = evaluateConnectorGatewayExperimentBranchApproval({
    boundaryIds: input.boundaryIds,
  });

  const unsafeBranch =
    approval.decision === "ready_for_operator_approval" &&
    approval.recommendedBranchName.length > 0 &&
    !isSafeBranchName(approval.recommendedBranchName);
  const unsafeFlag =
    approval.decision === "ready_for_operator_approval" &&
    approval.featureFlagName.length > 0 &&
    !isSafeFeatureFlagName(approval.featureFlagName);

  const decision = resolveReadinessDecision({ approval });
  const isBlocked = decision === "blocked";

  const recommendedBranchName = isBlocked ? "" : approval.recommendedBranchName;
  const featureFlagName = isBlocked ? "" : approval.featureFlagName;
  const featureFlagDefault = "off" as const;

  const regressionChecklist = isBlocked
    ? []
    : uniqueStrings([...approval.requiredRegressionSuites, ...approval.validationSuites]);

  const rollbackCriteria = isBlocked ? [] : uniqueStrings(approval.rollbackCriteria);

  const commandCandidates = buildCommandCandidates({ decision, recommendedBranchName });

  const approvalChecklist = buildApprovalChecklist({
    decision,
    approvalDecision: approval.decision,
    recommendedBranchName,
    featureFlagDefault,
    requiresDirectCallFallback: approval.requiresDirectCallFallback,
    requiredRegressionSuites: approval.requiredRegressionSuites,
    validationSuites: approval.validationSuites,
    rollbackCriteria,
  });

  const findings: ConnectorGatewayExperimentBranchCreationReadinessFinding[] = [];
  appendReadinessFindings({
    findings,
    decision,
    approvalDecision: approval.decision,
    approval,
    regressionChecklist,
    rollbackCriteria,
    unsafeBranch,
    unsafeFlag,
  });

  return {
    mode: "read_only_connector_gateway_branch_creation_readiness",
    decision,
    sourceApprovalDecision: approval.decision,
    sourceScope: approval.scope,
    sourceCandidateBoundaries: [...approval.candidateBoundaries],
    sourceCandidateConnectorIds: [...approval.candidateConnectorIds],
    sourceCandidateBoundaryKinds: [...approval.candidateBoundaryKinds],
    sourceBranchPlanDecision: approval.sourceBranchPlanDecision,
    sourceRoutingDecision: approval.sourceRoutingDecision,
    sourceRoutingScope: approval.sourceRoutingScope,
    recommendedBranchName,
    featureFlagName,
    featureFlagDefault,
    commandCandidates,
    approvalChecklist,
    regressionChecklist,
    rollbackCriteria,
    requiresExplicitUserApproval: decision !== "blocked",
    createsBranchInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    changesRoutingInThisStep: false,
    findings,
  };
}

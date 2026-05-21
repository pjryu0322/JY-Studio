/**
 * Evaluate Connector Gateway experiment branch execution package (read-only; no git/flag/routing execution).
 */

import { evaluateConnectorGatewayExperimentBranchCreationReadiness } from "@/lib/agents/evaluateConnectorGatewayExperimentBranchCreationReadiness";
import type {
  ConnectorGatewayExperimentBranchExecutionCommand,
  ConnectorGatewayExperimentBranchExecutionPackageDecision,
  ConnectorGatewayExperimentBranchExecutionPackageFinding,
  ConnectorGatewayExperimentBranchExecutionPackageReport,
} from "@/lib/agents/connectorGatewayExperimentBranchExecutionPackageTypes";

const PREFLIGHT_CHECKLIST = [
  "working tree clean",
  "origin/main up to date",
  "Stage1/ENV_TEST baseline preserved",
  "Cursor direct-call fallback preserved",
  "feature flag remains off",
  "no routing change before branch creation",
  "rollback criteria reviewed",
  "operator/user explicit approval recorded outside this evaluator",
] as const;

function finding(
  severity: ConnectorGatewayExperimentBranchExecutionPackageFinding["severity"],
  code: string,
  message: string,
): ConnectorGatewayExperimentBranchExecutionPackageFinding {
  return { severity, code, message };
}

function resolvePackageDecision(input: {
  readonly readinessDecision: string;
  readonly explicitUserApproval: boolean;
}): ConnectorGatewayExperimentBranchExecutionPackageDecision {
  switch (input.readinessDecision) {
    case "ready_for_explicit_user_approval":
      return input.explicitUserApproval
        ? "ready_for_manual_execution_after_approval"
        : "defer";
    case "defer":
      return "defer";
    case "blocked":
    default:
      return "blocked";
  }
}

function buildManualCommands(input: {
  readonly decision: ConnectorGatewayExperimentBranchExecutionPackageDecision;
  readonly readiness: ReturnType<typeof evaluateConnectorGatewayExperimentBranchCreationReadiness>;
}): ConnectorGatewayExperimentBranchExecutionCommand[] {
  if (input.decision !== "ready_for_manual_execution_after_approval") {
    return [];
  }

  return input.readiness.commandCandidates.map((candidate, index) => ({
    command: candidate.command,
    purpose: candidate.purpose,
    sequence: index + 1,
    mustRunManually: true as const,
    requiresExplicitUserApproval: true as const,
    caution: candidate.caution,
  }));
}

function appendPackageFindings(input: {
  readonly findings: ConnectorGatewayExperimentBranchExecutionPackageFinding[];
  readonly decision: ConnectorGatewayExperimentBranchExecutionPackageDecision;
  readonly readinessDecision: string;
  readonly explicitUserApproval: boolean;
}): void {
  const { findings, decision, readinessDecision, explicitUserApproval } = input;

  findings.push(
    finding("info", "execution_package_read_only", "execution package is read-only; no git execution"),
  );
  findings.push(finding("info", "manual_execution_required", "commands must be run manually by a human"));
  findings.push(finding("info", "commands_not_executed", "commands are not executed by this evaluator"));
  findings.push(finding("info", "feature_flag_default_off", "feature flag must remain default off"));
  findings.push(finding("info", "no_feature_flag_wire", "does not wire feature flags"));
  findings.push(finding("info", "no_routing_change", "does not change connector routing paths"));

  if (decision === "blocked") {
    findings.push(finding("blocking", "execution_package_blocked", "execution package is blocked"));
    if (readinessDecision === "blocked") {
      findings.push(finding("blocking", "source_readiness_blocked", "source branch creation readiness is blocked"));
    }
    return;
  }

  if (decision === "defer") {
    if (
      readinessDecision === "ready_for_explicit_user_approval" &&
      !explicitUserApproval
    ) {
      findings.push(
        finding("warning", "explicit_user_approval_missing", "explicit user approval is required before manual execution"),
      );
    }
    findings.push(finding("warning", "execution_package_deferred", "execution package defers until approval is confirmed"));
    return;
  }

  findings.push(
    finding("info", "explicit_user_approval_confirmed", "explicit user approval flag is set; commands remain manual only"),
  );
}

/** Read-only branch execution package — does not execute git commands or wire flags/routing. */
export function evaluateConnectorGatewayExperimentBranchExecutionPackage(input: {
  readonly boundaryIds: readonly string[];
  readonly explicitUserApproval?: boolean;
}): ConnectorGatewayExperimentBranchExecutionPackageReport {
  const readiness = evaluateConnectorGatewayExperimentBranchCreationReadiness({
    boundaryIds: input.boundaryIds,
  });
  const explicitUserApproval = input.explicitUserApproval === true;
  const decision = resolvePackageDecision({
    readinessDecision: readiness.decision,
    explicitUserApproval,
  });

  const isReady = decision === "ready_for_manual_execution_after_approval";
  const isBlocked = decision === "blocked";

  const recommendedBranchName = isBlocked ? "" : readiness.recommendedBranchName;
  const featureFlagName = isBlocked ? "" : readiness.featureFlagName;
  const featureFlagDefault = "off" as const;

  const manualCommands = buildManualCommands({ decision, readiness });
  const regressionChecklist = isBlocked ? [] : [...readiness.regressionChecklist];
  const rollbackCriteria = isBlocked ? [] : [...readiness.rollbackCriteria];

  const findings: ConnectorGatewayExperimentBranchExecutionPackageFinding[] = [];
  appendPackageFindings({
    findings,
    decision,
    readinessDecision: readiness.decision,
    explicitUserApproval,
  });

  return {
    mode: "read_only_connector_gateway_branch_execution_package",
    decision,
    sourceReadinessDecision: readiness.decision,
    recommendedBranchName,
    featureFlagName,
    featureFlagDefault,
    manualCommands,
    preflightChecklist: [...PREFLIGHT_CHECKLIST],
    regressionChecklist,
    rollbackCriteria,
    executesCommandsInThisStep: false,
    createsBranchInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    changesRoutingInThisStep: false,
    findings,
  };
}

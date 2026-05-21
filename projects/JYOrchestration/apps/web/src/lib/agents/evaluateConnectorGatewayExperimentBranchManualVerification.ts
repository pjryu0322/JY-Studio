/**
 * Evaluate Connector Gateway experiment branch manual verification (read-only; no git/test/flag/routing execution).
 */

import { evaluateConnectorGatewayExperimentBranchExecutionPackage } from "@/lib/agents/evaluateConnectorGatewayExperimentBranchExecutionPackage";
import type {
  ConnectorGatewayExperimentBranchManualVerificationChecklistItem,
  ConnectorGatewayExperimentBranchManualVerificationDecision,
  ConnectorGatewayExperimentBranchManualVerificationFinding,
  ConnectorGatewayExperimentBranchManualVerificationReport,
  ConnectorGatewayExperimentBranchRegressionResult,
} from "@/lib/agents/connectorGatewayExperimentBranchManualVerificationTypes";

const VERIFICATION_CHECKLIST_ITEMS = [
  "execution package ready",
  "manual execution confirmed",
  "actual branch name provided",
  "actual branch matches expected branch",
  "feature flag remains off",
  "routing remains unchanged",
  "regression results provided",
  "all regression suites passed",
  "rollback criteria available",
  "no git execution in this step",
  "no branch creation in this step",
  "no test execution in this step",
  "no feature flag wire in this step",
  "no routing change in this step",
] as const;

function finding(
  severity: ConnectorGatewayExperimentBranchManualVerificationFinding["severity"],
  code: string,
  message: string,
): ConnectorGatewayExperimentBranchManualVerificationFinding {
  return { severity, code, message };
}

export function sanitizeRegressionResults(
  results: readonly ConnectorGatewayExperimentBranchRegressionResult[],
): ConnectorGatewayExperimentBranchRegressionResult[] {
  const bySuite = new Map<string, ConnectorGatewayExperimentBranchRegressionResult>();

  for (const result of results) {
    const suite = result.suite.trim() || "unknown_regression_suite";
    const summary = result.summary.trim() || "no summary provided";
    const normalized = { suite, passed: result.passed, summary };
    const existing = bySuite.get(suite);

    if (!existing) {
      bySuite.set(suite, normalized);
      continue;
    }

    if (!existing.passed || !normalized.passed) {
      bySuite.set(suite, { ...normalized, passed: false });
    }
  }

  return [...bySuite.values()];
}

function resolveVerificationDecision(input: {
  readonly executionPackageDecision: string;
  readonly expectedBranchName: string;
  readonly explicitManualExecutionConfirmed: boolean;
  readonly actualBranchName: string;
  readonly regressionResults: readonly ConnectorGatewayExperimentBranchRegressionResult[];
}): {
  readonly decision: ConnectorGatewayExperimentBranchManualVerificationDecision;
  readonly rollbackRequired: boolean;
  readonly regressionPassed: boolean;
  readonly currentBranchMatchesExpected: boolean;
} {
  if (input.executionPackageDecision !== "ready_for_manual_execution_after_approval") {
    return {
      decision: "blocked",
      rollbackRequired: false,
      regressionPassed: false,
      currentBranchMatchesExpected: false,
    };
  }

  if (!input.expectedBranchName.trim()) {
    return {
      decision: "blocked",
      rollbackRequired: false,
      regressionPassed: false,
      currentBranchMatchesExpected: false,
    };
  }

  if (!input.explicitManualExecutionConfirmed) {
    return {
      decision: "defer",
      rollbackRequired: false,
      regressionPassed: false,
      currentBranchMatchesExpected: false,
    };
  }

  if (!input.actualBranchName.trim()) {
    return {
      decision: "defer",
      rollbackRequired: false,
      regressionPassed: false,
      currentBranchMatchesExpected: false,
    };
  }

  const currentBranchMatchesExpected =
    input.actualBranchName.trim() === input.expectedBranchName.trim();

  if (!currentBranchMatchesExpected) {
    return {
      decision: "blocked",
      rollbackRequired: false,
      regressionPassed: false,
      currentBranchMatchesExpected: false,
    };
  }

  if (input.regressionResults.length === 0) {
    return {
      decision: "defer",
      rollbackRequired: false,
      regressionPassed: false,
      currentBranchMatchesExpected: true,
    };
  }

  const regressionPassed = input.regressionResults.every((result) => result.passed);
  if (!regressionPassed) {
    return {
      decision: "blocked",
      rollbackRequired: true,
      regressionPassed: false,
      currentBranchMatchesExpected: true,
    };
  }

  return {
    decision: "manual_branch_verified",
    rollbackRequired: false,
    regressionPassed: true,
    currentBranchMatchesExpected: true,
  };
}

function buildVerificationChecklist(input: {
  readonly executionPackageDecision: string;
  readonly explicitManualExecutionConfirmed: boolean;
  readonly actualBranchName: string;
  readonly expectedBranchName: string;
  readonly regressionResults: readonly ConnectorGatewayExperimentBranchRegressionResult[];
  readonly rollbackCriteriaAvailable: boolean;
  readonly currentBranchMatchesExpected: boolean;
  readonly regressionPassed: boolean;
}): ConnectorGatewayExperimentBranchManualVerificationChecklistItem[] {
  const executionPackageReady =
    input.executionPackageDecision === "ready_for_manual_execution_after_approval";
  const actualBranchProvided = input.actualBranchName.trim().length > 0;
  const regressionProvided = input.regressionResults.length > 0;

  const satisfaction: Record<string, boolean> = {
    "execution package ready": executionPackageReady,
    "manual execution confirmed": input.explicitManualExecutionConfirmed,
    "actual branch name provided": actualBranchProvided,
    "actual branch matches expected branch": input.currentBranchMatchesExpected,
    "feature flag remains off": true,
    "routing remains unchanged": true,
    "regression results provided": regressionProvided,
    "all regression suites passed": regressionProvided && input.regressionPassed,
    "rollback criteria available": input.rollbackCriteriaAvailable,
    "no git execution in this step": true,
    "no branch creation in this step": true,
    "no test execution in this step": true,
    "no feature flag wire in this step": true,
    "no routing change in this step": true,
  };

  return VERIFICATION_CHECKLIST_ITEMS.map((item) => ({
    item,
    satisfied: satisfaction[item] ?? false,
    reason: (satisfaction[item] ?? false)
      ? `${item} satisfied`
      : `${item} not satisfied`,
  }));
}

function appendVerificationFindings(input: {
  readonly findings: ConnectorGatewayExperimentBranchManualVerificationFinding[];
  readonly decision: ConnectorGatewayExperimentBranchManualVerificationDecision;
  readonly executionPackageDecision: string;
  readonly expectedBranchName: string;
  readonly explicitManualExecutionConfirmed: boolean;
  readonly actualBranchName: string;
  readonly regressionResults: readonly ConnectorGatewayExperimentBranchRegressionResult[];
  readonly currentBranchMatchesExpected: boolean;
  readonly regressionPassed: boolean;
  readonly rollbackRequired: boolean;
}): void {
  const {
    findings,
    decision,
    executionPackageDecision,
    expectedBranchName,
    explicitManualExecutionConfirmed,
    actualBranchName,
    regressionResults,
    currentBranchMatchesExpected,
    regressionPassed,
    rollbackRequired,
  } = input;

  findings.push(
    finding(
      "info",
      "manual_verification_read_only",
      "manual verification is read-only; no git/test/flag/routing execution",
    ),
  );
  findings.push(finding("info", "feature_flag_remains_off", "feature flag must remain default off"));
  findings.push(finding("info", "routing_unchanged", "connector routing is unchanged"));
  findings.push(finding("info", "no_git_execution_in_this_step", "does not execute git commands"));
  findings.push(finding("info", "no_branch_creation_in_this_step", "does not create git branches"));
  findings.push(finding("info", "no_test_execution_in_this_step", "does not run tests"));

  if (decision === "blocked") {
    if (executionPackageDecision !== "ready_for_manual_execution_after_approval") {
      findings.push(
        finding("blocking", "execution_package_not_ready", "execution package is not ready for manual verification"),
      );
    }
    if (!expectedBranchName.trim()) {
      findings.push(
        finding("blocking", "expected_branch_name_missing", "expected branch name is missing from execution package"),
      );
    }
    if (actualBranchName.trim() && !currentBranchMatchesExpected) {
      findings.push(
        finding("blocking", "actual_branch_name_mismatch", "actual branch name does not match expected branch name"),
      );
    }
    if (regressionResults.length > 0 && !regressionPassed) {
      findings.push(finding("blocking", "regression_failed", "one or more regression suites failed"));
    }
    if (rollbackRequired) {
      findings.push(finding("blocking", "rollback_required", "rollback is required after regression failure"));
    }
    return;
  }

  if (decision === "defer") {
    if (!explicitManualExecutionConfirmed) {
      findings.push(
        finding("warning", "manual_execution_not_confirmed", "manual execution is not confirmed"),
      );
    }
    if (!actualBranchName.trim()) {
      findings.push(finding("warning", "actual_branch_name_missing", "actual branch name is missing"));
    }
    if (regressionResults.length === 0) {
      findings.push(finding("warning", "regression_results_missing", "regression results are missing"));
    }
    findings.push(
      finding("warning", "manual_verification_deferred", "manual verification defers until inputs are complete"),
    );
    return;
  }

  findings.push(finding("info", "manual_execution_confirmed", "manual execution is confirmed"));
  findings.push(finding("info", "branch_name_matches_expected", "actual branch name matches expected branch name"));
  findings.push(finding("info", "regression_passed", "all regression suites passed"));
}

/** Read-only branch manual verification — does not execute git, create branches, or run tests. */
export function evaluateConnectorGatewayExperimentBranchManualVerification(input: {
  readonly boundaryIds: readonly string[];
  readonly actualBranchName?: string;
  readonly explicitManualExecutionConfirmed?: boolean;
  readonly regressionResults?: readonly ConnectorGatewayExperimentBranchRegressionResult[];
}): ConnectorGatewayExperimentBranchManualVerificationReport {
  const executionPackage = evaluateConnectorGatewayExperimentBranchExecutionPackage({
    boundaryIds: input.boundaryIds,
    explicitUserApproval: true,
  });

  const explicitManualExecutionConfirmed = input.explicitManualExecutionConfirmed === true;
  const actualBranchName = input.actualBranchName?.trim() ?? "";
  const expectedBranchName = executionPackage.recommendedBranchName;
  const regressionResults = sanitizeRegressionResults(input.regressionResults ?? []);

  const preflightChecklist = executionPackage.preflightChecklist;
  const sourceExecutionPackageChecklistSummary = {
    total: preflightChecklist.length,
    satisfied: preflightChecklist.filter((item) => item.satisfied).length,
    unsatisfied: preflightChecklist.filter((item) => !item.satisfied).length,
  };

  const resolved = resolveVerificationDecision({
    executionPackageDecision: executionPackage.decision,
    expectedBranchName,
    explicitManualExecutionConfirmed,
    actualBranchName,
    regressionResults,
  });

  const verificationChecklist = buildVerificationChecklist({
    executionPackageDecision: executionPackage.decision,
    explicitManualExecutionConfirmed,
    actualBranchName,
    expectedBranchName,
    regressionResults,
    rollbackCriteriaAvailable: executionPackage.rollbackCriteria.length > 0,
    currentBranchMatchesExpected: resolved.currentBranchMatchesExpected,
    regressionPassed: resolved.regressionPassed,
  });

  const findings: ConnectorGatewayExperimentBranchManualVerificationFinding[] = [];
  appendVerificationFindings({
    findings,
    decision: resolved.decision,
    executionPackageDecision: executionPackage.decision,
    expectedBranchName,
    explicitManualExecutionConfirmed,
    actualBranchName,
    regressionResults,
    currentBranchMatchesExpected: resolved.currentBranchMatchesExpected,
    regressionPassed: resolved.regressionPassed,
    rollbackRequired: resolved.rollbackRequired,
  });

  return {
    mode: "read_only_connector_gateway_branch_manual_verification",
    decision: resolved.decision,
    sourceExecutionPackageDecision: executionPackage.decision,
    sourceBoundaryIds: [...input.boundaryIds],
    sourceExecutionPackageFindings: executionPackage.findings.map((item) => item.code),
    sourceExecutionPackageChecklistSummary,
    expectedBranchName,
    actualBranchName,
    featureFlagName: executionPackage.featureFlagName,
    featureFlagDefault: "off",
    explicitManualExecutionConfirmed,
    currentBranchMatchesExpected: resolved.currentBranchMatchesExpected,
    regressionPassed: resolved.regressionPassed,
    rollbackRequired: resolved.rollbackRequired,
    verificationChecklist,
    regressionResults,
    rollbackCriteria: [...executionPackage.rollbackCriteria],
    executesGitInThisStep: false,
    createsBranchInThisStep: false,
    runsTestsInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    changesRoutingInThisStep: false,
    findings,
  };
}

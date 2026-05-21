/**
 * Evaluate Connector Gateway experiment branch approval readiness (read-only; no branch/flag/routing wire).
 */

import { evaluateConnectorGatewayExperimentBranchPlan } from "@/lib/agents/evaluateConnectorGatewayExperimentBranchPlan";
import type {
  ConnectorGatewayExperimentBranchPlanDecision,
  ConnectorGatewayExperimentBranchPlanReport,
} from "@/lib/agents/connectorGatewayExperimentBranchPlanTypes";
import type {
  ConnectorGatewayExperimentBranchApprovalChecklistItem,
  ConnectorGatewayExperimentBranchApprovalDecision,
  ConnectorGatewayExperimentBranchApprovalFinding,
  ConnectorGatewayExperimentBranchApprovalReport,
  ConnectorGatewayExperimentBranchApprovalScope,
} from "@/lib/agents/connectorGatewayExperimentBranchApprovalTypes";

function finding(
  severity: ConnectorGatewayExperimentBranchApprovalFinding["severity"],
  code: string,
  message: string,
): ConnectorGatewayExperimentBranchApprovalFinding {
  return { severity, code, message };
}

function mapBranchPlanDecision(
  branchPlanDecision: ConnectorGatewayExperimentBranchPlanDecision,
): ConnectorGatewayExperimentBranchApprovalDecision {
  switch (branchPlanDecision) {
    case "ready_for_branch_plan":
      return "ready_for_operator_approval";
    case "defer":
      return "defer";
    case "blocked":
      return "blocked";
    default:
      return "blocked";
  }
}

function resolveApprovalDecision(input: {
  readonly branchPlan: ConnectorGatewayExperimentBranchPlanReport;
  readonly requiresDirectCallFallback: boolean;
}): ConnectorGatewayExperimentBranchApprovalDecision {
  const { branchPlan, requiresDirectCallFallback } = input;
  let decision = mapBranchPlanDecision(branchPlan.decision);

  if (decision === "blocked") {
    return "blocked";
  }

  const hasBranchName = branchPlan.recommendedBranchName.length > 0;
  const hasFeatureFlag = branchPlan.featureFlagName.length > 0;
  const hasRollback = branchPlan.rollbackCriteria.length > 0;
  const hasRegression =
    branchPlan.requiredRegressionSuites.length > 0 || branchPlan.validationSuites.length > 0;

  if (!hasBranchName || !hasFeatureFlag || !hasRollback || !requiresDirectCallFallback) {
    return "blocked";
  }

  if (decision === "ready_for_operator_approval" && !hasRegression) {
    return "defer";
  }

  return decision;
}

function buildApprovalChecklist(input: {
  readonly decision: ConnectorGatewayExperimentBranchApprovalDecision;
  readonly recommendedBranchName: string;
  readonly featureFlagDefault: "off";
  readonly requiresDirectCallFallback: boolean;
  readonly requiresOperatorApproval: boolean;
  readonly rollbackCriteria: readonly string[];
  readonly requiredRegressionSuites: readonly string[];
  readonly validationSuiteCount: number;
}): ConnectorGatewayExperimentBranchApprovalChecklistItem[] {
  const isBlocked = input.decision === "blocked";
  const isReady = input.decision === "ready_for_operator_approval";
  const regressionDefined =
    !isBlocked &&
    (input.requiredRegressionSuites.length > 0 || input.validationSuiteCount > 0);

  const branchNameSatisfied = isBlocked
    ? false
    : isReady
      ? input.recommendedBranchName.length > 0
      : input.recommendedBranchName.length > 0;

  const operatorSatisfied = isBlocked ? false : input.requiresOperatorApproval;

  return [
    {
      item: "branch name selected",
      satisfied: branchNameSatisfied,
      reason: branchNameSatisfied ? "branch name is defined" : "branch name missing or blocked",
    },
    {
      item: "feature flag default off",
      satisfied: input.featureFlagDefault === "off",
      reason: "feature flag must default to off",
    },
    {
      item: "direct call fallback preserved",
      satisfied: isBlocked ? false : input.requiresDirectCallFallback,
      reason: isBlocked
        ? "direct call fallback not ready while blocked"
        : "direct call fallback is required during experiment",
    },
    {
      item: "rollback criteria defined",
      satisfied: isBlocked ? false : input.rollbackCriteria.length > 0,
      reason:
        input.rollbackCriteria.length > 0
          ? "rollback criteria are defined"
          : "rollback criteria missing",
    },
    {
      item: "regression suites defined",
      satisfied: isBlocked ? false : regressionDefined,
      reason: regressionDefined
        ? "regression suites are defined"
        : "regression suites missing for approval",
    },
    {
      item: "operator approval required",
      satisfied: operatorSatisfied,
      reason: operatorSatisfied
        ? "operator approval is required before experiment wire"
        : "operator approval not required while blocked",
    },
    {
      item: "no main execution path change",
      satisfied: true,
      reason: "this evaluator does not change main execution paths",
    },
    {
      item: "no git branch creation in this step",
      satisfied: true,
      reason: "this evaluator does not create git branches",
    },
    {
      item: "no feature flag wire in this step",
      satisfied: true,
      reason: "this evaluator does not wire feature flags",
    },
    {
      item: "no connector routing change in this step",
      satisfied: true,
      reason: "this evaluator does not change connector routing",
    },
  ];
}

function appendApprovalFindings(input: {
  readonly findings: ConnectorGatewayExperimentBranchApprovalFinding[];
  readonly decision: ConnectorGatewayExperimentBranchApprovalDecision;
  readonly scope: ConnectorGatewayExperimentBranchApprovalScope;
  readonly isBlocked: boolean;
  readonly recommendedBranchName: string;
  readonly featureFlagName: string;
  readonly requiredRegressionSuites: readonly string[];
  readonly requiresStage1Regression: boolean;
}): void {
  const { findings, decision, scope, isBlocked } = input;

  findings.push(
    finding("info", "branch_approval_read_only", "branch approval is read-only; no execution wire"),
  );
  findings.push(finding("info", "no_git_branch_creation", "does not create git branches"));
  findings.push(finding("info", "no_feature_flag_wire", "does not wire feature flags"));
  findings.push(finding("info", "no_routing_change", "does not change connector routing paths"));

  if (isBlocked) {
    findings.push(finding("blocking", "branch_plan_blocked", "branch plan is blocked; approval not ready"));
    return;
  }

  findings.push(finding("info", "feature_flag_default_off", "feature flag must default to off"));
  findings.push(
    finding("info", "direct_call_fallback_required", "direct call fallback is required during experiment"),
  );
  findings.push(finding("info", "rollback_plan_required", "rollback plan is required before experiment wire"));
  findings.push(
    finding("info", "operator_approval_required", "operator approval is required before experiment wire"),
  );

  if (decision === "defer") {
    findings.push(
      finding("warning", "approval_deferred", "branch approval defers until regression plan is approved"),
    );
  }

  if (input.requiresStage1Regression) {
    findings.push(
      finding(
        "warning",
        "github_stage1_regression_required",
        "GitHub boundary requires Stage1/ENV_TEST regression before experiment",
      ),
    );
  }

  if (scope === "cursor_and_github") {
    findings.push(
      finding("warning", "runtime_scope_large", "cursor+github scope has large execution impact; defer approval"),
    );
  }

  if (decision === "ready_for_operator_approval") {
    if (!input.recommendedBranchName) {
      findings.push(finding("blocking", "missing_branch_name", "branch name is required for approval"));
    }
    if (!input.featureFlagName) {
      findings.push(finding("blocking", "missing_feature_flag_name", "feature flag name is required for approval"));
    }
    if (input.requiredRegressionSuites.length === 0) {
      findings.push(
        finding("blocking", "missing_regression_suites", "required regression suites are missing for approval"),
      );
    }
  }
}

/** Read-only branch approval readiness — does not create branches, wire flags, or change routing. */
export function evaluateConnectorGatewayExperimentBranchApproval(input: {
  readonly boundaryIds: readonly string[];
}): ConnectorGatewayExperimentBranchApprovalReport {
  const branchPlan = evaluateConnectorGatewayExperimentBranchPlan({
    boundaryIds: input.boundaryIds,
  });

  const requiresDirectCallFallback = branchPlan.requiresDirectCallFallback;
  const decision = resolveApprovalDecision({ branchPlan, requiresDirectCallFallback });
  const scope = branchPlan.scope as ConnectorGatewayExperimentBranchApprovalScope;
  const isBlocked = decision === "blocked";

  const recommendedBranchName = isBlocked ? "" : branchPlan.recommendedBranchName;
  const featureFlagName = isBlocked ? "" : branchPlan.featureFlagName;
  const featureFlagDefault = "off" as const;

  const requiresOperatorApproval = !isBlocked;
  const requiresRegressionChecklist = !isBlocked;
  const requiresRollbackPlan = true;
  const requiresStage1Regression = isBlocked ? false : branchPlan.requiresStage1Regression;

  const requiredRegressionSuites = isBlocked ? [] : [...branchPlan.requiredRegressionSuites];
  const validationSuites = [...branchPlan.validationSuites];
  const rollbackCriteria = [...branchPlan.rollbackCriteria];

  const approvalChecklist = buildApprovalChecklist({
    decision,
    recommendedBranchName,
    featureFlagDefault,
    requiresDirectCallFallback,
    requiresOperatorApproval,
    rollbackCriteria,
    requiredRegressionSuites,
    validationSuiteCount: validationSuites.length,
  });

  const findings: ConnectorGatewayExperimentBranchApprovalFinding[] = [];
  appendApprovalFindings({
    findings,
    decision,
    scope,
    isBlocked,
    recommendedBranchName,
    featureFlagName,
    requiredRegressionSuites,
    requiresStage1Regression,
  });

  return {
    mode: "read_only_connector_gateway_experiment_branch_approval",
    decision,
    scope,
    recommendedBranchName,
    featureFlagName,
    featureFlagDefault,
    requiresOperatorApproval,
    requiresRegressionChecklist,
    requiresRollbackPlan,
    requiresDirectCallFallback,
    requiresStage1Regression,
    approvalChecklist,
    requiredRegressionSuites,
    validationSuites,
    rollbackCriteria,
    candidateBoundaries: [...branchPlan.candidateBoundaries],
    candidateConnectorIds: [...branchPlan.candidateConnectorIds],
    candidateBoundaryKinds: [...branchPlan.candidateBoundaryKinds],
    sourceBranchPlanDecision: branchPlan.decision,
    sourceRoutingDecision: branchPlan.sourceRoutingDecision,
    sourceRoutingScope: branchPlan.sourceRoutingScope,
    findings,
  };
}

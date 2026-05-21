/**
 * Evaluate Connector Gateway experiment branch plan from routing experiment (read-only; no branch/flag wire).
 */

import { evaluateConnectorGatewayRoutingExperiment } from "@/lib/agents/evaluateConnectorGatewayRoutingExperiment";
import type { ConnectorGatewayRoutingExperimentFinding } from "@/lib/agents/connectorGatewayRoutingExperimentTypes";
import type {
  ConnectorGatewayExperimentBranchPlanDecision,
  ConnectorGatewayExperimentBranchPlanFinding,
  ConnectorGatewayExperimentBranchPlanReport,
  ConnectorGatewayExperimentBranchPlanScope,
} from "@/lib/agents/connectorGatewayExperimentBranchPlanTypes";

const VALIDATION_SUITES: readonly string[] = [
  "multiAgentConnectorGatewayRoutingExperiment.unit.test.ts",
  "multiAgentConnectorGatewayFacade.unit.test.ts",
  "multiAgentConnectorPassThroughBoundary.unit.test.ts",
  "multiAgentFoundation.unit.test.ts",
];

const CURSOR_REGRESSION_SUITES: readonly string[] = [
  "multiAgentHarnessDryRun.unit.test.ts",
  "Cursor execution dry-run boundary regression",
];

const GITHUB_REGRESSION_SUITES: readonly string[] = [
  "ENV_TEST Stage1 Happy Path",
  "GitHub PR create regression",
  "GitHub merge/status regression",
  "GitHub status check regression",
  "requirementsOrchestrationPhase4Product.unit.test.ts",
];

const ROLLBACK_CRITERIA: readonly string[] = [
  "feature flag default off 유지",
  "direct call fallback 유지",
  "Stage1/ENV_TEST 실패 시 실험 중단",
  "GitHub PR/merge/status regression 실패 시 실험 중단",
  "Cursor execution boundary regression 실패 시 실험 중단",
  "Connector Gateway wrapper 실패 시 direct call fallback으로 복귀",
  "실험 브랜치 외 main 실행 경로 변경 금지",
];

const SCOPE_PLAN: Record<
  ConnectorGatewayExperimentBranchPlanScope,
  {
    readonly decision: ConnectorGatewayExperimentBranchPlanDecision;
    readonly recommendedBranchName: string;
    readonly featureFlagName: string;
  }
> = {
  none: { decision: "blocked", recommendedBranchName: "", featureFlagName: "" },
  cursor_only: {
    decision: "ready_for_branch_plan",
    recommendedBranchName: "experiment/connector-gateway-cursor-routing",
    featureFlagName: "JYO_CONNECTOR_GATEWAY_CURSOR_ROUTING",
  },
  github_only: {
    decision: "defer",
    recommendedBranchName: "experiment/connector-gateway-github-routing",
    featureFlagName: "JYO_CONNECTOR_GATEWAY_GITHUB_ROUTING",
  },
  cursor_and_github: {
    decision: "defer",
    recommendedBranchName: "experiment/connector-gateway-runtime-routing",
    featureFlagName: "JYO_CONNECTOR_GATEWAY_RUNTIME_ROUTING",
  },
};

function finding(
  severity: ConnectorGatewayExperimentBranchPlanFinding["severity"],
  code: string,
  message: string,
): ConnectorGatewayExperimentBranchPlanFinding {
  return { severity, code, message };
}

function mapRoutingFinding(
  rf: ConnectorGatewayRoutingExperimentFinding,
): ConnectorGatewayExperimentBranchPlanFinding {
  return { severity: rf.severity, code: rf.code, message: rf.message };
}

function resolveBranchPlanDecision(input: {
  readonly routingBlocked: boolean;
  readonly scope: ConnectorGatewayExperimentBranchPlanScope;
}): ConnectorGatewayExperimentBranchPlanDecision {
  if (input.routingBlocked) return "blocked";
  return SCOPE_PLAN[input.scope]?.decision ?? "blocked";
}

function buildRequiredRegressionSuites(scope: ConnectorGatewayExperimentBranchPlanScope): string[] {
  const suites: string[] = [];
  if (scope === "cursor_only" || scope === "cursor_and_github") {
    suites.push(...CURSOR_REGRESSION_SUITES);
  }
  if (scope === "github_only" || scope === "cursor_and_github") {
    suites.push(...GITHUB_REGRESSION_SUITES);
  }
  return suites;
}

function appendReadOnlyFindings(
  findings: ConnectorGatewayExperimentBranchPlanFinding[],
  decision: ConnectorGatewayExperimentBranchPlanDecision,
): void {
  findings.push(finding("info", "branch_plan_read_only", "branch plan is read-only; no execution wire"));
  findings.push(finding("info", "no_git_branch_creation", "does not create git branches"));
  findings.push(finding("info", "no_feature_flag_wire", "does not wire feature flags"));
  findings.push(finding("info", "no_routing_change", "does not change connector routing paths"));

  if (decision === "ready_for_branch_plan") {
    findings.push(finding("info", "branch_plan_ready", "branch plan is ready for review"));
  } else if (decision === "defer") {
    findings.push(finding("warning", "branch_plan_deferred", "branch plan is deferred"));
  } else if (decision === "blocked") {
    findings.push(finding("blocking", "branch_plan_blocked", "branch plan is blocked"));
  }
}

function appendPlanFindings(input: {
  readonly findings: ConnectorGatewayExperimentBranchPlanFinding[];
  readonly decision: ConnectorGatewayExperimentBranchPlanDecision;
  readonly scope: ConnectorGatewayExperimentBranchPlanScope;
  readonly routingBlocked: boolean;
  readonly stage1RegressionRequired: boolean;
}): void {
  const { findings, decision, scope, routingBlocked, stage1RegressionRequired } = input;

  if (routingBlocked) {
    findings.push(
      finding("blocking", "routing_experiment_blocked", "routing experiment blocked branch plan"),
    );
  }

  if (decision === "ready_for_branch_plan") {
    findings.push(finding("info", "feature_flag_default_off", "feature flag must default to off"));
    findings.push(
      finding("info", "direct_call_fallback_required", "direct call fallback is required during experiment"),
    );
    findings.push(finding("info", "rollback_plan_required", "rollback plan is required before experiment wire"));
    findings.push(
      finding("info", "operator_approval_required", "operator approval is required before experiment wire"),
    );
  }

  if (decision === "defer") {
    findings.push(
      finding("warning", "defer_until_regression_plan_ready", "branch plan defers until regression plan is approved"),
    );
  }

  if (stage1RegressionRequired) {
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
      finding("warning", "runtime_scope_large", "cursor+github scope has large execution impact; defer branch plan"),
    );
  }

  appendReadOnlyFindings(findings, decision);
}

/** Read-only branch plan — does not create git branches, wire flags, or change routing. */
export function evaluateConnectorGatewayExperimentBranchPlan(input: {
  readonly boundaryIds: readonly string[];
}): ConnectorGatewayExperimentBranchPlanReport {
  const routingExperiment = evaluateConnectorGatewayRoutingExperiment({
    boundaryIds: input.boundaryIds,
  });

  const scope = routingExperiment.scope;
  const routingBlocked = routingExperiment.decision === "blocked";
  const decision = resolveBranchPlanDecision({ routingBlocked, scope });
  const plan = SCOPE_PLAN[scope] ?? SCOPE_PLAN.none;
  const isBlocked = decision === "blocked";

  const findings: ConnectorGatewayExperimentBranchPlanFinding[] = routingExperiment.findings.map(
    mapRoutingFinding,
  );

  if (routingExperiment.findings.some((f) => f.code === "empty_boundary_ids")) {
    findings.push(finding("blocking", "no_candidate_boundaries", "no candidate boundaries for branch plan"));
  }

  appendPlanFindings({
    findings,
    decision,
    scope,
    routingBlocked,
    stage1RegressionRequired: routingExperiment.stage1RegressionRequired,
  });

  return {
    mode: "read_only_connector_gateway_experiment_branch_plan",
    decision,
    scope,
    recommendedBranchName: isBlocked ? "" : plan.recommendedBranchName,
    featureFlagName: isBlocked ? "" : plan.featureFlagName,
    featureFlagDefault: "off",
    requiresDirectCallFallback: true,
    requiresStage1Regression: isBlocked ? false : routingExperiment.stage1RegressionRequired,
    requiresRollbackPlan: true,
    requiresOperatorApproval: true,
    candidateBoundaries: [...routingExperiment.boundaryIds],
    candidateConnectorIds: [...routingExperiment.connectorIds],
    candidateBoundaryKinds: [...routingExperiment.boundaryKinds],
    sourceRoutingDecision: routingExperiment.decision,
    sourceRoutingScope: routingExperiment.scope,
    requiredRegressionSuites: isBlocked ? [] : buildRequiredRegressionSuites(scope),
    validationSuites: [...VALIDATION_SUITES],
    rollbackCriteria: [...ROLLBACK_CRITERIA],
    findings,
  };
}

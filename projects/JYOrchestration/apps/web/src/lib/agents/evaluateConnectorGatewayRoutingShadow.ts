/**
 * Evaluate Connector Gateway routing shadow (read-only; no route change, connector, or flag wire).
 */

import { evaluateConnectorGatewayExperimentBranchManualVerification } from "@/lib/agents/evaluateConnectorGatewayExperimentBranchManualVerification";
import { evaluateConnectorGatewayRoutingExperiment } from "@/lib/agents/evaluateConnectorGatewayRoutingExperiment";
import type {
  ConnectorGatewayRoutingShadowChecklistItem,
  ConnectorGatewayRoutingShadowDecision,
  ConnectorGatewayRoutingShadowFinding,
  ConnectorGatewayRoutingShadowReport,
  ConnectorGatewayRoutingShadowRequest,
  ConnectorGatewayRoutingShadowRouteMode,
} from "@/lib/agents/connectorGatewayRoutingShadowTypes";
import type { ConnectorGatewayRoutingExperimentScope } from "@/lib/agents/connectorGatewayRoutingExperimentTypes";

const DEFAULT_ACTUAL_RUNTIME_PATH = "existing_runtime_path";
const SHADOW_RUNTIME_PATH = "connector_gateway_shadow_path";

const CURSOR_BOUNDARY = ["cursor.execution.before"] as const;
const GITHUB_BOUNDARY = ["github.pr.create.before"] as const;
const MIXED_BOUNDARIES = ["cursor.execution.before", "github.pr.create.before"] as const;

const ROUTE_CHECKLIST_ITEMS = [
  "routing experiment available",
  "boundary ids provided",
  "connector ids provided",
  "actual runtime path preserved",
  "shadow runtime path proposed",
  "feature flag remains off",
  "explicit shadow approval confirmed",
] as const;

const SAFETY_CHECKLIST_ITEMS = [
  "observe only mode",
  "no runtime route change in this step",
  "no connector call in this step",
  "no Cursor invocation in this step",
  "no GitHub invocation in this step",
  "no feature flag wire in this step",
  "no data write in this step",
  "stage1 regression required if GitHub scope included",
  "fallback path available",
] as const;

const ROLLBACK_CHECKLIST_ITEMS = [
  "runtime route fallback available",
  "feature flag rollback available",
  "connector fallback available",
  "manual verification rollback reviewed",
  "stage1 regression rollback reviewed",
  "operator approval required for route switch",
] as const;

function finding(
  severity: ConnectorGatewayRoutingShadowFinding["severity"],
  code: string,
  message: string,
): ConnectorGatewayRoutingShadowFinding {
  return { severity, code, message };
}

export function normalizeConnectorGatewayRoutingShadowTarget(raw?: string): string {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return "unknown";
  if (value === "cursor" || value === "cursor_only" || value === "cursor_execution") {
    return "cursor_only";
  }
  if (value === "github" || value === "github_only" || value === "github_pr" || value === "github_merge") {
    return "github_only";
  }
  if (value === "runtime" || value === "cursor_and_github" || value === "connector_gateway_runtime") {
    return "cursor_and_github";
  }
  return "unknown";
}

function defaultBoundaryIdsForTarget(target: string): readonly string[] {
  if (target === "cursor_only") return CURSOR_BOUNDARY;
  if (target === "github_only") return GITHUB_BOUNDARY;
  if (target === "cursor_and_github") return MIXED_BOUNDARIES;
  return [];
}

function normalizeBoundaryIds(boundaryIds: readonly string[] | undefined, target: string): string[] {
  const provided = (boundaryIds ?? [])
    .map((id) => String(id ?? "").trim())
    .filter((id) => id.length > 0);
  if (provided.length > 0) {
    return [...new Set(provided)];
  }
  return [...defaultBoundaryIdsForTarget(target)];
}

function resolveRouteMode(decision: ConnectorGatewayRoutingShadowDecision): ConnectorGatewayRoutingShadowRouteMode {
  if (decision === "blocked") return "fallback_required";
  if (decision === "shadow_ready") return "shadow_compare";
  return "observe_only";
}

function resolveShadowDecision(input: {
  readonly target: string;
  readonly boundaryIds: readonly string[];
  readonly routingDecision: string;
  readonly routingScope: ConnectorGatewayRoutingExperimentScope;
  readonly manualVerificationRollbackRequired: boolean;
  readonly featureFlagEnabled: boolean;
  readonly explicitShadowApproval: boolean;
}): ConnectorGatewayRoutingShadowDecision {
  if (input.target === "unknown" || input.boundaryIds.length === 0) {
    return "blocked";
  }

  if (input.routingDecision === "blocked") {
    return "blocked";
  }

  if (input.manualVerificationRollbackRequired) {
    return "blocked";
  }

  if (input.featureFlagEnabled) {
    return "blocked";
  }

  if (!input.explicitShadowApproval) {
    return "defer";
  }

  if (
    input.routingDecision === "ready_for_experiment_design" &&
    input.routingScope === "cursor_only"
  ) {
    return "shadow_ready";
  }

  return "defer";
}

function buildChecklist(
  items: readonly string[],
  satisfaction: Record<string, boolean>,
): ConnectorGatewayRoutingShadowChecklistItem[] {
  return items.map((item) => ({
    item,
    satisfied: satisfaction[item] ?? false,
    reason: (satisfaction[item] ?? false)
      ? `${item} satisfied`
      : `${item} not satisfied`,
  }));
}

function buildRouteChecklist(input: {
  readonly routingAvailable: boolean;
  readonly boundaryIds: readonly string[];
  readonly connectorIds: readonly string[];
  readonly actualRuntimePath: string;
  readonly featureFlagEnabled: boolean;
  readonly explicitShadowApproval: boolean;
}): ConnectorGatewayRoutingShadowChecklistItem[] {
  return buildChecklist(ROUTE_CHECKLIST_ITEMS, {
    "routing experiment available": input.routingAvailable,
    "boundary ids provided": input.boundaryIds.length > 0,
    "connector ids provided": input.connectorIds.length > 0,
    "actual runtime path preserved": input.actualRuntimePath.length > 0,
    "shadow runtime path proposed": true,
    "feature flag remains off": !input.featureFlagEnabled,
    "explicit shadow approval confirmed": input.explicitShadowApproval,
  });
}

function buildSafetyChecklist(input: {
  readonly routingExperimentAvailable: boolean;
  readonly stage1RegressionRequired: boolean;
  readonly routeMode: ConnectorGatewayRoutingShadowRouteMode;
}): ConnectorGatewayRoutingShadowChecklistItem[] {
  return buildChecklist(SAFETY_CHECKLIST_ITEMS, {
    "observe only mode": input.routeMode === "observe_only" || input.routeMode === "shadow_compare",
    "no runtime route change in this step": true,
    "no connector call in this step": true,
    "no Cursor invocation in this step": true,
    "no GitHub invocation in this step": true,
    "no feature flag wire in this step": true,
    "no data write in this step": true,
    "stage1 regression required if GitHub scope included": input.stage1RegressionRequired,
    "fallback path available": input.routingExperimentAvailable,
  });
}

function buildRollbackChecklist(input: {
  readonly routingDirectCallFallbackRequired: boolean;
  readonly manualVerificationRollbackRequired: boolean;
  readonly stage1RegressionRequired: boolean;
}): ConnectorGatewayRoutingShadowChecklistItem[] {
  return buildChecklist(ROLLBACK_CHECKLIST_ITEMS, {
    "runtime route fallback available": input.routingDirectCallFallbackRequired,
    "feature flag rollback available": true,
    "connector fallback available": input.routingDirectCallFallbackRequired,
    "manual verification rollback reviewed": !input.manualVerificationRollbackRequired,
    "stage1 regression rollback reviewed": !input.stage1RegressionRequired,
    "operator approval required for route switch": true,
  });
}

function appendShadowFindings(input: {
  readonly findings: ConnectorGatewayRoutingShadowFinding[];
  readonly decision: ConnectorGatewayRoutingShadowDecision;
  readonly target: string;
  readonly boundaryIds: readonly string[];
  readonly routingScope: ConnectorGatewayRoutingExperimentScope;
  readonly routingDecision: string;
  readonly manualVerificationRollbackRequired: boolean;
  readonly featureFlagEnabled: boolean;
  readonly explicitShadowApproval: boolean;
  readonly actualRuntimePath: string;
}): void {
  const {
    findings,
    decision,
    target,
    boundaryIds,
    routingScope,
    routingDecision,
    manualVerificationRollbackRequired,
    featureFlagEnabled,
    explicitShadowApproval,
    actualRuntimePath,
  } = input;

  findings.push(finding("info", "routing_shadow_read_only", "routing shadow is read-only; no route or connector wire"));
  findings.push(finding("info", "actual_runtime_path_preserved", "actual runtime path is preserved"));
  findings.push(finding("info", "shadow_runtime_path_proposed", "shadow runtime path is proposed for comparison"));
  findings.push(finding("info", "observe_only_shadowing", "shadowing observes routing without changing runtime path"));
  findings.push(finding("info", "no_runtime_route_change_in_this_step", "runtime route is not changed in this step"));
  findings.push(finding("info", "no_connector_call_in_this_step", "connectors are not called in this step"));
  findings.push(finding("info", "no_cursor_invocation_in_this_step", "Cursor is not invoked in this step"));
  findings.push(finding("info", "no_github_invocation_in_this_step", "GitHub is not invoked in this step"));

  if (decision === "blocked") {
    if (target === "unknown") {
      findings.push(finding("blocking", "routing_shadow_target_unknown", "routing shadow target is unknown"));
    }
    if (boundaryIds.length === 0) {
      findings.push(finding("blocking", "routing_shadow_boundary_missing", "routing shadow boundary ids are missing"));
    }
    if (routingDecision === "blocked") {
      findings.push(finding("blocking", "routing_experiment_blocked", "routing experiment is blocked"));
    }
    if (manualVerificationRollbackRequired) {
      findings.push(
        finding("blocking", "manual_verification_rollback_required", "manual verification requires rollback"),
      );
    }
    if (featureFlagEnabled) {
      findings.push(
        finding(
          "blocking",
          "feature_flag_enabled_not_allowed_in_shadow",
          "feature flag enabled is not allowed during shadowing",
        ),
      );
    }
    return;
  }

  if (decision === "defer") {
    if (!explicitShadowApproval) {
      findings.push(
        finding("warning", "explicit_shadow_approval_missing", "explicit shadow approval is required"),
      );
    }
    findings.push(
      finding("warning", "branch_manual_verification_deferred", "branch manual verification is deferred"),
    );
    if (routingScope === "github_only" || routingScope === "cursor_and_github") {
      findings.push(finding("warning", "stage1_regression_required", "Stage1 regression is required for GitHub scope"));
    }
    findings.push(finding("warning", "routing_shadow_deferred", "routing shadow defers until prerequisites are met"));
    return;
  }

  findings.push(finding("info", "routing_shadow_ready", "routing shadow is ready for comparison"));
}

/** Read-only routing shadow — does not change runtime route, call connectors, or wire feature flags. */
export function evaluateConnectorGatewayRoutingShadow(
  input?: ConnectorGatewayRoutingShadowRequest,
): ConnectorGatewayRoutingShadowReport {
  const target = normalizeConnectorGatewayRoutingShadowTarget(input?.target);
  const boundaryIds = normalizeBoundaryIds(input?.boundaryIds, target);
  const featureFlagEnabled = input?.featureFlagEnabled === true;
  const explicitShadowApproval = input?.explicitShadowApproval === true;
  const actualRuntimePath = input?.actualRuntimePath?.trim() || DEFAULT_ACTUAL_RUNTIME_PATH;

  const routingExperiment = evaluateConnectorGatewayRoutingExperiment({ boundaryIds });
  const manualVerification = evaluateConnectorGatewayExperimentBranchManualVerification({
    boundaryIds,
    explicitManualExecutionConfirmed: false,
    regressionResults: [],
  });

  const decision = resolveShadowDecision({
    target,
    boundaryIds,
    routingDecision: routingExperiment.decision,
    routingScope: routingExperiment.scope,
    manualVerificationRollbackRequired: manualVerification.rollbackRequired,
    featureFlagEnabled,
    explicitShadowApproval,
  });

  const routeMode = resolveRouteMode(decision);
  const connectorIds =
    input?.connectorIds && input.connectorIds.length > 0
      ? [...new Set(input.connectorIds.map((id) => String(id).trim()).filter(Boolean))]
      : [...routingExperiment.connectorIds];

  const routeChecklist = buildRouteChecklist({
    routingAvailable: routingExperiment.decision !== "blocked",
    boundaryIds,
    connectorIds,
    actualRuntimePath,
    featureFlagEnabled,
    explicitShadowApproval,
  });

  const safetyChecklist = buildSafetyChecklist({
    routingExperimentAvailable: routingExperiment.decision !== "blocked",
    stage1RegressionRequired: routingExperiment.stage1RegressionRequired,
    routeMode,
  });

  const rollbackChecklist = buildRollbackChecklist({
    routingDirectCallFallbackRequired: routingExperiment.directCallFallbackRequired,
    manualVerificationRollbackRequired: manualVerification.rollbackRequired,
    stage1RegressionRequired: routingExperiment.stage1RegressionRequired,
  });

  const findings: ConnectorGatewayRoutingShadowFinding[] = [];
  appendShadowFindings({
    findings,
    decision,
    target,
    boundaryIds,
    routingScope: routingExperiment.scope,
    routingDecision: routingExperiment.decision,
    manualVerificationRollbackRequired: manualVerification.rollbackRequired,
    featureFlagEnabled,
    explicitShadowApproval,
    actualRuntimePath,
  });

  return {
    mode: "read_only_connector_gateway_routing_shadow",
    decision,
    routeMode,
    target,
    boundaryIds,
    connectorIds,
    sourceRoutingDecision: routingExperiment.decision,
    sourceRoutingScope: routingExperiment.scope,
    sourceRoutingRequiresStage1Regression: routingExperiment.stage1RegressionRequired,
    sourceBranchManualVerificationDecision: manualVerification.decision,
    sourceBranchManualVerificationRollbackRequired: manualVerification.rollbackRequired,
    featureFlagEnabled,
    explicitShadowApproval,
    actualRuntimePath,
    shadowRuntimePath: SHADOW_RUNTIME_PATH,
    routeChecklist,
    safetyChecklist,
    rollbackChecklist,
    observesOnly: true,
    changesRuntimeRouteInThisStep: false,
    callsConnectorInThisStep: false,
    invokesCursorInThisStep: false,
    invokesGithubInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    writesDataInThisStep: false,
    findings,
  };
}

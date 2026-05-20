/**
 * Evaluate Connector Gateway routing experiment branch design (read-only; no routing wire).
 */

import { getConnectorPassThroughBoundaryById } from "@/lib/agents/connectorPassThroughBoundaryRegistry";
import type {
  ConnectorPassThroughBoundary,
  ConnectorPassThroughBoundaryKind,
} from "@/lib/agents/connectorPassThroughBoundaryTypes";
import type {
  ConnectorGatewayRoutingExperimentDecision,
  ConnectorGatewayRoutingExperimentFinding,
  ConnectorGatewayRoutingExperimentReport,
  ConnectorGatewayRoutingExperimentScope,
} from "@/lib/agents/connectorGatewayRoutingExperimentTypes";

const GITHUB_BOUNDARY_KINDS = new Set<ConnectorPassThroughBoundaryKind>([
  "github_pr",
  "github_branch",
  "github_merge",
  "github_status",
]);

function finding(
  severity: ConnectorGatewayRoutingExperimentFinding["severity"],
  code: string,
  message: string,
): ConnectorGatewayRoutingExperimentFinding {
  return { severity, code, message };
}

function normalizeBoundaryIds(
  boundaryIds: readonly string[],
  findings: ConnectorGatewayRoutingExperimentFinding[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of boundaryIds) {
    const id = String(raw ?? "").trim();
    if (!id) continue;
    if (seen.has(id)) {
      findings.push(
        finding("warning", "duplicate_boundary_id_removed", `duplicate boundary removed: ${id}`),
      );
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

function collectBoundaryTrace(boundaries: readonly ConnectorPassThroughBoundary[]): {
  readonly boundaryIds: readonly string[];
  readonly connectorIds: readonly string[];
  readonly boundaryKinds: readonly string[];
} {
  const boundaryIds = boundaries.map((b) => b.id);
  const connectorIds = [...new Set(boundaries.map((b) => b.connectorId))];
  const boundaryKinds = [...new Set(boundaries.map((b) => b.kind))];
  return { boundaryIds, connectorIds, boundaryKinds };
}

function isCursorBoundaryKind(kind: ConnectorPassThroughBoundaryKind): boolean {
  return kind === "cursor_execution";
}

function isGithubBoundaryKind(kind: ConnectorPassThroughBoundaryKind): boolean {
  return GITHUB_BOUNDARY_KINDS.has(kind);
}

function resolveScope(hasCursor: boolean, hasGithub: boolean): ConnectorGatewayRoutingExperimentScope {
  if (!hasCursor && !hasGithub) return "none";
  if (hasCursor && hasGithub) return "cursor_and_github";
  if (hasCursor) return "cursor_only";
  if (hasGithub) return "github_only";
  return "none";
}

const SCOPE_DECISION: Record<
  ConnectorGatewayRoutingExperimentScope,
  ConnectorGatewayRoutingExperimentDecision
> = {
  none: "blocked",
  cursor_only: "ready_for_experiment_design",
  github_only: "defer",
  cursor_and_github: "defer",
};

const SCOPE_INFO_FINDINGS: Partial<
  Record<ConnectorGatewayRoutingExperimentScope, { readonly code: string; readonly message: string }>
> = {
  cursor_only: {
    code: "ready_for_cursor_experiment",
    message: "cursor-only boundary is ready for experiment branch design review",
  },
  github_only: {
    code: "defer_github_experiment",
    message:
      "github-only routing experiment defers until Stage1/ENV_TEST regression plan is approved",
  },
  cursor_and_github: {
    code: "defer_mixed_scope_experiment",
    message: "cursor+github routing experiment defers due to broad execution impact",
  },
};

function resolveDecision(scope: ConnectorGatewayRoutingExperimentScope) {
  return SCOPE_DECISION[scope] ?? "blocked";
}

/** Blocked reports keep direct fallback + rollback; experiment/flag flags stay off. */
function blockedReport(input: {
  readonly findings: ConnectorGatewayRoutingExperimentFinding[];
  readonly boundaryIds?: readonly string[];
  readonly connectorIds?: readonly string[];
  readonly boundaryKinds?: readonly string[];
}): ConnectorGatewayRoutingExperimentReport {
  return {
    mode: "read_only_routing_experiment_design",
    decision: "blocked",
    scope: "none",
    boundaryIds: input.boundaryIds ?? [],
    connectorIds: input.connectorIds ?? [],
    boundaryKinds: input.boundaryKinds ?? [],
    experimentBranchRequired: false,
    featureFlagRequired: false,
    featureFlagDefault: "off",
    directCallFallbackRequired: true,
    stage1RegressionRequired: false,
    rollbackPlanRequired: true,
    findings: input.findings,
  };
}

function activeExperimentReport(input: {
  readonly decision: ConnectorGatewayRoutingExperimentDecision;
  readonly scope: ConnectorGatewayRoutingExperimentScope;
  readonly boundaryIds: readonly string[];
  readonly connectorIds: readonly string[];
  readonly boundaryKinds: readonly string[];
  readonly stage1RegressionRequired: boolean;
  readonly findings: ConnectorGatewayRoutingExperimentFinding[];
}): ConnectorGatewayRoutingExperimentReport {
  return {
    mode: "read_only_routing_experiment_design",
    decision: input.decision,
    scope: input.scope,
    boundaryIds: input.boundaryIds,
    connectorIds: input.connectorIds,
    boundaryKinds: input.boundaryKinds,
    experimentBranchRequired: true,
    featureFlagRequired: true,
    featureFlagDefault: "off",
    directCallFallbackRequired: true,
    stage1RegressionRequired: input.stage1RegressionRequired,
    rollbackPlanRequired: true,
    findings: input.findings,
  };
}

/** Read-only routing experiment design — does not change Cursor/GitHub execution paths. */
export function evaluateConnectorGatewayRoutingExperiment(input: {
  readonly boundaryIds: readonly string[];
}): ConnectorGatewayRoutingExperimentReport {
  const findings: ConnectorGatewayRoutingExperimentFinding[] = [];
  const boundaryIds = normalizeBoundaryIds(input.boundaryIds, findings);

  if (boundaryIds.length === 0) {
    findings.push(finding("blocking", "empty_boundary_ids", "boundaryIds must not be empty"));
    return blockedReport({ findings, boundaryIds: [] });
  }

  const resolvedBoundaries: ConnectorPassThroughBoundary[] = [];
  let hasCursor = false;
  let hasGithub = false;

  for (const boundaryId of boundaryIds) {
    const boundary = getConnectorPassThroughBoundaryById(boundaryId);
    if (!boundary) {
      findings.push(finding("blocking", "unknown_boundary", `unknown boundary: ${boundaryId}`));
      return blockedReport({ findings, boundaryIds });
    }
    if (!boundary.enabled) {
      findings.push(finding("blocking", "disabled_boundary", `disabled boundary: ${boundaryId}`));
      const trace = collectBoundaryTrace([...resolvedBoundaries, boundary]);
      return blockedReport({ findings, ...trace });
    }
    resolvedBoundaries.push(boundary);
    if (isCursorBoundaryKind(boundary.kind)) hasCursor = true;
    if (isGithubBoundaryKind(boundary.kind)) hasGithub = true;
  }

  const trace = collectBoundaryTrace(resolvedBoundaries);

  const scope = resolveScope(hasCursor, hasGithub);
  const decision = resolveDecision(scope);
  const stage1RegressionRequired = hasGithub;

  const scopeInfo = SCOPE_INFO_FINDINGS[scope];
  if (scopeInfo) {
    findings.push(finding("info", scopeInfo.code, scopeInfo.message));
  }

  return activeExperimentReport({
    decision,
    scope,
    stage1RegressionRequired,
    findings,
    ...trace,
  });
}

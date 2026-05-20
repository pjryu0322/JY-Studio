/**
 * Evaluate Connector Gateway routing transition readiness (read-only; no routing wire).
 */

import type { ConnectorPassThroughBoundaryKind } from "@/lib/agents/connectorPassThroughBoundaryTypes";
import { getConnectorPassThroughBoundaryById } from "@/lib/agents/connectorPassThroughBoundaryRegistry";
import type {
  ConnectorGatewayRoutingDecision,
  ConnectorGatewayRoutingDecisionReport,
  ConnectorGatewayRoutingFinding,
  ConnectorGatewayRoutingTarget,
} from "@/lib/agents/connectorGatewayRoutingDecisionTypes";
import type { ConnectorRoutingDecisionDiagnosticSection } from "@/lib/agents/agentRuntimeDiagnosticViewTypes";

const ROUTING_TARGET_KINDS = new Set<ConnectorPassThroughBoundaryKind>([
  "cursor_execution",
  "github_pr",
  "github_branch",
  "github_merge",
  "github_status",
]);

function finding(
  severity: ConnectorGatewayRoutingFinding["severity"],
  code: string,
  message: string,
): ConnectorGatewayRoutingFinding {
  return { severity, code, message };
}

function boundaryKindToTarget(
  kind: ConnectorPassThroughBoundaryKind,
): ConnectorGatewayRoutingTarget | undefined {
  if (kind === "cursor_execution") return "cursor_execution";
  if (kind === "github_pr") return "github_pr";
  if (kind === "github_branch") return "github_branch";
  if (kind === "github_merge") return "github_merge";
  if (kind === "github_status") return "github_status";
  return undefined;
}

function isGithubRoutingTarget(target: ConnectorGatewayRoutingTarget): boolean {
  return (
    target === "github_pr" ||
    target === "github_branch" ||
    target === "github_merge" ||
    target === "github_status"
  );
}

function blockedReport(input: {
  readonly boundaryId: string;
  readonly operation?: string;
  readonly connectorId: string;
  readonly findings: ConnectorGatewayRoutingFinding[];
}): ConnectorGatewayRoutingDecisionReport {
  return {
    mode: "read_only_routing_decision",
    decision: "blocked",
    target: "unknown",
    boundaryId: input.boundaryId,
    ...(input.operation ? { operation: input.operation } : {}),
    connectorId: input.connectorId,
    requiresExecutionPathChange: false,
    requiresRollbackPlan: true,
    requiresStage1Regression: false,
    findings: input.findings,
  };
}

/** Read-only routing decision — does not change Cursor/GitHub execution paths. */
export function evaluateConnectorGatewayRoutingDecision(input: {
  readonly boundaryId: string;
}): ConnectorGatewayRoutingDecisionReport {
  const findings: ConnectorGatewayRoutingFinding[] = [];
  const boundaryId = String(input.boundaryId ?? "").trim();
  const boundary = getConnectorPassThroughBoundaryById(boundaryId);

  if (!boundary) {
    findings.push(finding("blocking", "boundary_not_found", `boundary not found: ${boundaryId}`));
    return blockedReport({ boundaryId, connectorId: "unknown", findings });
  }

  if (!boundary.enabled) {
    findings.push(finding("blocking", "boundary_disabled", `boundary disabled: ${boundary.id}`));
  }

  if (boundary.recordOnly !== true) {
    findings.push(
      finding("blocking", "boundary_not_record_only", "routing requires recordOnly boundary"),
    );
  }

  const target = boundaryKindToTarget(boundary.kind);
  if (!target || !ROUTING_TARGET_KINDS.has(boundary.kind)) {
    findings.push(
      finding("blocking", "unsupported_boundary_kind", `unsupported boundary kind: ${boundary.kind}`),
    );
    return blockedReport({
      boundaryId: boundary.id,
      operation: boundary.operation,
      connectorId: boundary.connectorId,
      findings,
    });
  }

  const requiresExecutionPathChange = true;
  const requiresRollbackPlan = true;
  const requiresStage1Regression = isGithubRoutingTarget(target);

  const blockingCount = findings.filter((f) => f.severity === "blocking").length;
  let decision: ConnectorGatewayRoutingDecision;

  if (blockingCount > 0) {
    decision = "blocked";
  } else if (boundary.kind === "cursor_execution") {
    decision = "defer";
    findings.push(
      finding(
        "info",
        "defer_cursor_execution",
        "Cursor execution path change has high impact; defer routing transition",
      ),
    );
  } else if (isGithubRoutingTarget(target)) {
    decision = "defer";
    findings.push(
      finding(
        "info",
        "defer_github_routing",
        "GitHub routing requires Stage1/ENV_TEST regression before transition",
      ),
    );
  } else {
    decision = "defer";
    findings.push(finding("info", "defer_default", "default defer until impact analysis is complete"));
  }

  return {
    mode: "read_only_routing_decision",
    decision,
    target,
    boundaryId: boundary.id,
    operation: boundary.operation,
    connectorId: boundary.connectorId,
    requiresExecutionPathChange,
    requiresRollbackPlan,
    requiresStage1Regression,
    findings,
  };
}

/** Maps routing report to diagnostic VM section (no connector execution). */
export function mapConnectorRoutingDecisionToDiagnosticSection(
  report: ConnectorGatewayRoutingDecisionReport,
): ConnectorRoutingDecisionDiagnosticSection {
  return {
    decision: report.decision,
    target: report.target,
    boundaryId: report.boundaryId,
    operation: report.operation,
    connectorId: report.connectorId,
    requiresExecutionPathChange: report.requiresExecutionPathChange,
    requiresRollbackPlan: report.requiresRollbackPlan,
    requiresStage1Regression: report.requiresStage1Regression,
    findingCount: report.findings.length,
    blockingFindingCount: report.findings.filter((f) => f.severity === "blocking").length,
  };
}

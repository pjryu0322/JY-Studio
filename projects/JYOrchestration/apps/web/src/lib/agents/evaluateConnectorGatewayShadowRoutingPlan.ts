/**
 * Evaluate Connector Gateway shadow routing plan (read-only; no routing/connector/Cursor/GitHub/runtime execution).
 */

import { evaluateRuntimeWireManualBranchVerification } from "@/lib/agents/evaluateRuntimeWireManualBranchVerification";
import { buildRuntimeWireFeatureFlagName } from "@/lib/agents/evaluateRuntimeWireExperimentBranchPlan";
import type {
  ConnectorGatewayShadowRouteCandidate,
  ConnectorGatewayShadowRoutingPlanChecklistItem,
  ConnectorGatewayShadowRoutingPlanDecision,
  ConnectorGatewayShadowRoutingPlanFinding,
  ConnectorGatewayShadowRoutingPlanReport,
} from "@/lib/agents/connectorGatewayShadowRoutingPlanTypes";

const MANUAL_BRANCH_VERIFIED = "manual_branch_verified";
const FEATURE_FLAG_DEFAULT = "off" as const;

type ConnectorGatewayShadowRoutingPlanInput = Parameters<typeof evaluateRuntimeWireManualBranchVerification>[0] & {
  readonly shadowRoutingReviewConfirmed?: boolean;
  readonly connectorGatewayShadowModeConfirmed?: boolean;
  readonly stage1RegressionReviewedForShadowRouting?: boolean;
  readonly rollbackPlanReviewedForShadowRouting?: boolean;
};

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

const SHADOW_ROUTE_SPECS: readonly Omit<ConnectorGatewayShadowRouteCandidate, "reason">[] = [
  {
    sequence: 1,
    routeName: "cursor.execution.shadow",
    sourcePath: "cursor.execution.current",
    shadowPath: "connectorGateway.cursor.execution.shadow",
    connectorId: "cursor",
    mode: "shadow_compare",
    executesInThisStep: false,
    changesRoutingInThisStep: false,
  },
  {
    sequence: 2,
    routeName: "github.pr.shadow",
    sourcePath: "github.pr.current",
    shadowPath: "connectorGateway.github.pr.shadow",
    connectorId: "github",
    mode: "shadow_compare",
    executesInThisStep: false,
    changesRoutingInThisStep: false,
  },
  {
    sequence: 3,
    routeName: "runtime.audit.observe",
    sourcePath: "runtime.audit.current",
    shadowPath: "connectorGateway.runtime.audit.observe",
    connectorId: "internal",
    mode: "observe_only",
    executesInThisStep: false,
    changesRoutingInThisStep: false,
  },
];

function resolveShadowRoutingFlags(input?: ConnectorGatewayShadowRoutingPlanInput) {
  return {
    shadowRoutingReviewConfirmed: input?.shadowRoutingReviewConfirmed === true,
    connectorGatewayShadowModeConfirmed: input?.connectorGatewayShadowModeConfirmed === true,
    stage1RegressionReviewedForShadowRouting: input?.stage1RegressionReviewedForShadowRouting === true,
    rollbackPlanReviewedForShadowRouting: input?.rollbackPlanReviewedForShadowRouting === true,
  };
}

function finding(
  severity: ConnectorGatewayShadowRoutingPlanFinding["severity"],
  code: string,
  message: string,
): ConnectorGatewayShadowRoutingPlanFinding {
  return { severity, code, message };
}

function checklistReason(input: ChecklistEntry): string {
  return `${input.item}: ${input.satisfied ? "satisfied" : "not satisfied"} — ${input.detail}`;
}

function mapChecklistEntries(entries: readonly ChecklistEntry[]): ConnectorGatewayShadowRoutingPlanChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: checklistReason(entry),
  }));
}

function buildShadowRouteCandidates(
  manualDecision: string,
): ConnectorGatewayShadowRouteCandidate[] {
  return SHADOW_ROUTE_SPECS.map((spec) => ({
    ...spec,
    reason: `${spec.routeName}: sourceManualBranchDecision=${manualDecision}; no actual routing change; requires Stage 4-D approval`,
  }));
}

function resolveShadowRoutingPlanDecision(input: {
  readonly manualVerificationDecision: string;
  readonly rollbackRequired: boolean;
  readonly shadowRoutingReviewConfirmed: boolean;
  readonly connectorGatewayShadowModeConfirmed: boolean;
  readonly stage1RegressionReviewedForShadowRouting: boolean;
  readonly rollbackPlanReviewedForShadowRouting: boolean;
}): ConnectorGatewayShadowRoutingPlanDecision {
  if (input.manualVerificationDecision === "blocked" || input.rollbackRequired) {
    return "blocked";
  }

  if (input.manualVerificationDecision !== MANUAL_BRANCH_VERIFIED) {
    return "defer";
  }

  if (!input.shadowRoutingReviewConfirmed) {
    return "defer";
  }

  if (!input.connectorGatewayShadowModeConfirmed) {
    return "defer";
  }

  if (!input.stage1RegressionReviewedForShadowRouting) {
    return "defer";
  }

  if (!input.rollbackPlanReviewedForShadowRouting) {
    return "defer";
  }

  return "ready_for_shadow_routing_review";
}

function buildShadowRoutingChecklist(input: {
  readonly manualVerification: ReturnType<typeof evaluateRuntimeWireManualBranchVerification>;
  readonly shadowRoutingReviewConfirmed: boolean;
  readonly connectorGatewayShadowModeConfirmed: boolean;
  readonly stage1RegressionReviewedForShadowRouting: boolean;
  readonly rollbackPlanReviewedForShadowRouting: boolean;
  readonly routeCandidateCount: number;
}): ConnectorGatewayShadowRoutingPlanChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "source manual branch verified",
      satisfied: input.manualVerification.decision === MANUAL_BRANCH_VERIFIED,
      detail: `sourceManualBranchDecision=${input.manualVerification.decision}`,
    },
    {
      item: "source branch matches expected",
      satisfied: input.manualVerification.branchMatches,
      detail: `sourceBranchMatches=${input.manualVerification.branchMatches}`,
    },
    {
      item: "source regression passed",
      satisfied: input.manualVerification.regressionPassed,
      detail: `sourceRegressionPassed=${input.manualVerification.regressionPassed}`,
    },
    {
      item: "shadowRoutingReviewConfirmed",
      satisfied: input.shadowRoutingReviewConfirmed,
      detail: `shadowRoutingReviewConfirmed=${input.shadowRoutingReviewConfirmed}`,
    },
    {
      item: "connectorGatewayShadowModeConfirmed",
      satisfied: input.connectorGatewayShadowModeConfirmed,
      detail: `connectorGatewayShadowModeConfirmed=${input.connectorGatewayShadowModeConfirmed}`,
    },
    {
      item: "stage1RegressionReviewedForShadowRouting",
      satisfied: input.stage1RegressionReviewedForShadowRouting,
      detail: `stage1RegressionReviewedForShadowRouting=${input.stage1RegressionReviewedForShadowRouting}`,
    },
    {
      item: "rollbackPlanReviewedForShadowRouting",
      satisfied: input.rollbackPlanReviewedForShadowRouting,
      detail: `rollbackPlanReviewedForShadowRouting=${input.rollbackPlanReviewedForShadowRouting}`,
    },
    {
      item: "three shadow route candidates generated",
      satisfied: input.routeCandidateCount === 3,
      detail: `routeCandidateCount=${input.routeCandidateCount}`,
    },
  ]);
}

function buildSafetyChecklist(): ConnectorGatewayShadowRoutingPlanChecklistItem[] {
  return mapChecklistEntries([
    { item: "no runtime execution in this step", satisfied: true, detail: "executesRuntimeInThisStep=false" },
    {
      item: "no connector routing change in this step",
      satisfied: true,
      detail: "changesConnectorRoutingInThisStep=false",
    },
    { item: "no connector call in this step", satisfied: true, detail: "callsConnectorInThisStep=false" },
    { item: "no Cursor call in this step", satisfied: true, detail: "callsCursorInThisStep=false" },
    { item: "no GitHub call in this step", satisfied: true, detail: "callsGitHubInThisStep=false" },
    { item: "no feature flag wire in this step", satisfied: true, detail: "wiresFeatureFlagInThisStep=false" },
    { item: "no DB write in this step", satisfied: true, detail: "writesDataInThisStep=false" },
    { item: "no Prisma call in this step", satisfied: true, detail: "callsPrismaInThisStep=false" },
    { item: "no schema change in this step", satisfied: true, detail: "modifiesSchemaInThisStep=false" },
    { item: "no migration in this step", satisfied: true, detail: "createsMigrationInThisStep=false" },
  ]);
}

function buildRollbackChecklist(input: {
  readonly sourceRollbackRequired: boolean;
  readonly rollbackPlanReviewedForShadowRouting: boolean;
}): ConnectorGatewayShadowRoutingPlanChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "source rollback not required",
      satisfied: !input.sourceRollbackRequired,
      detail: `sourceRollbackRequired=${input.sourceRollbackRequired}`,
    },
    {
      item: "rollback plan reviewed for shadow routing",
      satisfied: input.rollbackPlanReviewedForShadowRouting,
      detail: `rollbackPlanReviewedForShadowRouting=${input.rollbackPlanReviewedForShadowRouting}`,
    },
    {
      item: "feature flag default off",
      satisfied: true,
      detail: `featureFlagDefault=${FEATURE_FLAG_DEFAULT}`,
    },
  ]);
}

function buildNoRunChecklist(): ConnectorGatewayShadowRoutingPlanChecklistItem[] {
  return mapChecklistEntries([
    { item: "executesRuntimeInThisStep=false", satisfied: true, detail: "executesRuntimeInThisStep=false" },
    {
      item: "changesConnectorRoutingInThisStep=false",
      satisfied: true,
      detail: "changesConnectorRoutingInThisStep=false",
    },
    { item: "callsConnectorInThisStep=false", satisfied: true, detail: "callsConnectorInThisStep=false" },
    { item: "callsCursorInThisStep=false", satisfied: true, detail: "callsCursorInThisStep=false" },
    { item: "callsGitHubInThisStep=false", satisfied: true, detail: "callsGitHubInThisStep=false" },
    { item: "createsPullRequestInThisStep=false", satisfied: true, detail: "createsPullRequestInThisStep=false" },
    { item: "executesGitInThisStep=false", satisfied: true, detail: "executesGitInThisStep=false" },
    { item: "createsBranchInThisStep=false", satisfied: true, detail: "createsBranchInThisStep=false" },
    { item: "wiresWritePathInThisStep=false", satisfied: true, detail: "wiresWritePathInThisStep=false" },
    { item: "wiresFeatureFlagInThisStep=false", satisfied: true, detail: "wiresFeatureFlagInThisStep=false" },
    { item: "writesDataInThisStep=false", satisfied: true, detail: "writesDataInThisStep=false" },
    { item: "callsPrismaInThisStep=false", satisfied: true, detail: "callsPrismaInThisStep=false" },
    { item: "modifiesSchemaInThisStep=false", satisfied: true, detail: "modifiesSchemaInThisStep=false" },
    { item: "createsMigrationInThisStep=false", satisfied: true, detail: "createsMigrationInThisStep=false" },
  ]);
}

function appendShadowRoutingFindings(input: {
  readonly findings: ConnectorGatewayShadowRoutingPlanFinding[];
  readonly decision: ConnectorGatewayShadowRoutingPlanDecision;
  readonly manualVerification: ReturnType<typeof evaluateRuntimeWireManualBranchVerification>;
  readonly shadowRoutingReviewConfirmed: boolean;
  readonly connectorGatewayShadowModeConfirmed: boolean;
  readonly stage1RegressionReviewedForShadowRouting: boolean;
  readonly rollbackPlanReviewedForShadowRouting: boolean;
}): void {
  const { findings, decision, manualVerification } = input;

  findings.push(
    finding(
      "info",
      "connector_gateway_shadow_routing_plan_read_only",
      "Connector Gateway shadow routing plan is read-only; no routing change",
    ),
  );

  if (decision === "blocked") {
    if (manualVerification.decision === "blocked") {
      findings.push(finding("blocking", "source_manual_branch_blocked", "Source manual branch verification is blocked"));
    }
    if (manualVerification.rollbackRequired) {
      findings.push(
        finding("blocking", "source_manual_branch_rollback_required", "Source manual branch rollback is required"),
      );
    }
    findings.push(finding("blocking", "shadow_routing_plan_blocked", "Shadow routing plan is blocked"));
    return;
  }

  if (decision === "defer") {
    if (manualVerification.decision !== MANUAL_BRANCH_VERIFIED) {
      findings.push(finding("warning", "source_manual_branch_not_verified", "Source manual branch is not verified"));
    }
    if (!input.shadowRoutingReviewConfirmed) {
      findings.push(finding("warning", "shadow_routing_review_missing", "Shadow routing review is missing"));
    }
    if (!input.connectorGatewayShadowModeConfirmed) {
      findings.push(
        finding("warning", "connector_gateway_shadow_mode_missing", "Connector Gateway shadow mode confirmation is missing"),
      );
    }
    if (!input.stage1RegressionReviewedForShadowRouting) {
      findings.push(
        finding(
          "warning",
          "stage1_regression_for_shadow_routing_missing",
          "Stage1 regression review for shadow routing is missing",
        ),
      );
    }
    if (!input.rollbackPlanReviewedForShadowRouting) {
      findings.push(
        finding("warning", "rollback_plan_for_shadow_routing_missing", "Rollback plan review for shadow routing is missing"),
      );
    }
    findings.push(finding("warning", "shadow_routing_plan_deferred", "Shadow routing plan defers"));
    return;
  }

  findings.push(finding("info", "shadow_route_candidates_generated", "Shadow route candidates generated"));
  findings.push(finding("info", "shadow_routing_plan_ready", "Shadow routing plan is ready for review"));
  findings.push(
    finding(
      "info",
      "ready_for_shadow_routing_review_not_routing_permission",
      "Ready for shadow routing review; not routing change permission; Stage 4-D controlled execution path candidate required",
    ),
  );
}

/** Read-only Connector Gateway shadow routing plan — does not change routing or call connectors. */
export function evaluateConnectorGatewayShadowRoutingPlan(
  input?: ConnectorGatewayShadowRoutingPlanInput,
): ConnectorGatewayShadowRoutingPlanReport {
  const manualVerification = evaluateRuntimeWireManualBranchVerification(input);
  const flags = resolveShadowRoutingFlags(input);

  const shadowRouteCandidates = buildShadowRouteCandidates(manualVerification.decision);
  const routeCandidateCount = shadowRouteCandidates.length;
  const routeCandidateSatisfiedCount = routeCandidateCount;

  const decision = resolveShadowRoutingPlanDecision({
    manualVerificationDecision: manualVerification.decision,
    rollbackRequired: manualVerification.rollbackRequired,
    ...flags,
  });

  const featureFlagName = buildRuntimeWireFeatureFlagName();

  const findings: ConnectorGatewayShadowRoutingPlanFinding[] = [];
  appendShadowRoutingFindings({
    findings,
    decision,
    manualVerification,
    ...flags,
  });

  return {
    mode: "read_only_connector_gateway_shadow_routing_plan",
    stage: "stage_4_c",
    decision,
    sourceManualBranchDecision: manualVerification.decision,
    sourceExpectedBranchName: manualVerification.expectedBranchName,
    sourceActualBranchName: manualVerification.actualBranchName,
    sourceBranchMatches: manualVerification.branchMatches,
    sourceRegressionPassed: manualVerification.regressionPassed,
    sourceRollbackRequired: manualVerification.rollbackRequired,
    sourceFindingCodes: manualVerification.findings.map((f) => f.code),
    featureFlagName,
    featureFlagDefault: FEATURE_FLAG_DEFAULT,
    featureFlagEnabledInThisStep: false,
    shadowRouteCandidates,
    routeCandidateCount,
    routeCandidateSatisfiedCount,
    shadowRoutingChecklist: buildShadowRoutingChecklist({
      manualVerification,
      ...flags,
      routeCandidateCount,
    }),
    safetyChecklist: buildSafetyChecklist(),
    rollbackChecklist: buildRollbackChecklist({
      sourceRollbackRequired: manualVerification.rollbackRequired,
      rollbackPlanReviewedForShadowRouting: flags.rollbackPlanReviewedForShadowRouting,
    }),
    noRunChecklist: buildNoRunChecklist(),
    executesRuntimeInThisStep: false,
    changesConnectorRoutingInThisStep: false,
    callsConnectorInThisStep: false,
    callsCursorInThisStep: false,
    callsGitHubInThisStep: false,
    createsPullRequestInThisStep: false,
    executesGitInThisStep: false,
    createsBranchInThisStep: false,
    wiresWritePathInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    findings,
  };
}

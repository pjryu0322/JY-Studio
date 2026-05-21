/**
 * Evaluate controlled execution path candidate (read-only; no execution path/routing/connector/runtime/DB/git changes).
 */

import { evaluateConnectorGatewayShadowRoutingPlan } from "@/lib/agents/evaluateConnectorGatewayShadowRoutingPlan";
import type { ConnectorGatewayShadowRouteCandidate } from "@/lib/agents/connectorGatewayShadowRoutingPlanTypes";
import type {
  ControlledExecutionPathCandidate,
  ControlledExecutionPathCandidateChecklistItem,
  ControlledExecutionPathCandidateDecision,
  ControlledExecutionPathCandidateFinding,
  ControlledExecutionPathCandidateReport,
} from "@/lib/agents/controlledExecutionPathCandidateTypes";

const SHADOW_ROUTING_READY = "ready_for_shadow_routing_review";

type ControlledExecutionPathCandidateInput = Parameters<typeof evaluateConnectorGatewayShadowRoutingPlan>[0] & {
  readonly executionPathReviewConfirmed?: boolean;
  readonly shadowRoutingReviewConfirmedForExecutionPath?: boolean;
  readonly rollbackReviewConfirmedForExecutionPath?: boolean;
  readonly featureFlagPlanConfirmedForExecutionPath?: boolean;
};

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

function resolveExecutionPathFlags(input?: ControlledExecutionPathCandidateInput) {
  return {
    executionPathReviewConfirmed: input?.executionPathReviewConfirmed === true,
    shadowRoutingReviewConfirmedForExecutionPath:
      input?.shadowRoutingReviewConfirmedForExecutionPath === true,
    rollbackReviewConfirmedForExecutionPath: input?.rollbackReviewConfirmedForExecutionPath === true,
    featureFlagPlanConfirmedForExecutionPath: input?.featureFlagPlanConfirmedForExecutionPath === true,
  };
}

function finding(
  severity: ControlledExecutionPathCandidateFinding["severity"],
  code: string,
  message: string,
): ControlledExecutionPathCandidateFinding {
  return { severity, code, message };
}

function checklistReason(input: ChecklistEntry): string {
  return `${input.item}: ${input.satisfied ? "satisfied" : "not satisfied"} — ${input.detail}`;
}

function mapChecklistEntries(entries: readonly ChecklistEntry[]): ControlledExecutionPathCandidateChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: checklistReason(entry),
  }));
}

function checklistCounts<T extends { readonly satisfied: boolean }>(items: readonly T[]) {
  return {
    count: items.length,
    satisfiedCount: items.filter((item) => item.satisfied).length,
  };
}

function buildExecutionPathCandidates(
  shadowRoutes: readonly ConnectorGatewayShadowRouteCandidate[],
): ControlledExecutionPathCandidate[] {
  return shadowRoutes.map((candidate) => ({
    sequence: candidate.sequence,
    candidateId: `controlled-${candidate.connectorId}-${candidate.sequence}`,
    sourceRouteName: candidate.routeName,
    currentExecutionPath: candidate.sourcePath,
    proposedExecutionPath: candidate.shadowPath,
    connectorId: candidate.connectorId,
    mode: candidate.mode === "shadow_compare" ? "controlled_candidate" : "observe_only",
    executesInThisStep: false,
    changesExecutionPathInThisStep: false,
    changesRoutingInThisStep: false,
    reason: `${candidate.routeName}: sourceShadowRoute; no actual execution path change; requires Stage 4-E review`,
  }));
}

function countExecutionPathCandidateSatisfied(
  candidates: readonly ControlledExecutionPathCandidate[],
): number {
  return candidates.filter(
    (candidate) =>
      candidate.executesInThisStep === false &&
      candidate.changesExecutionPathInThisStep === false &&
      candidate.changesRoutingInThisStep === false &&
      candidate.candidateId.trim().length > 0 &&
      candidate.sourceRouteName.trim().length > 0 &&
      candidate.proposedExecutionPath.trim().length > 0 &&
      candidate.currentExecutionPath.trim().length > 0 &&
      candidate.connectorId.trim().length > 0,
  ).length;
}

export type ControlledExecutionPathCandidateDecisionInput = {
  readonly shadowRoutingDecision: string;
  readonly sourceNoRunChecklistCount: number;
  readonly sourceNoRunChecklistSatisfiedCount: number;
  readonly executionPathReviewConfirmed: boolean;
  readonly shadowRoutingReviewConfirmedForExecutionPath: boolean;
  readonly rollbackReviewConfirmedForExecutionPath: boolean;
  readonly featureFlagPlanConfirmedForExecutionPath: boolean;
};

/** Pure decision helper for controlled execution path candidate (no shadow plan side effects). */
export function resolveControlledExecutionPathCandidateDecision(
  input: ControlledExecutionPathCandidateDecisionInput,
): ControlledExecutionPathCandidateDecision {
  if (input.shadowRoutingDecision === "blocked") {
    return "blocked";
  }

  if (input.shadowRoutingDecision !== SHADOW_ROUTING_READY) {
    return "defer";
  }

  if (input.sourceNoRunChecklistSatisfiedCount !== input.sourceNoRunChecklistCount) {
    return "blocked";
  }

  const executionPathConfirmationsSatisfied =
    input.executionPathReviewConfirmed &&
    input.shadowRoutingReviewConfirmedForExecutionPath &&
    input.rollbackReviewConfirmedForExecutionPath &&
    input.featureFlagPlanConfirmedForExecutionPath;

  if (!executionPathConfirmationsSatisfied) {
    return "defer";
  }

  return "ready_for_execution_path_review";
}

function buildCandidateChecklist(input: {
  readonly shadowPlan: ReturnType<typeof evaluateConnectorGatewayShadowRoutingPlan>;
  readonly executionPathReviewConfirmed: boolean;
  readonly shadowRoutingReviewConfirmedForExecutionPath: boolean;
  readonly rollbackReviewConfirmedForExecutionPath: boolean;
  readonly featureFlagPlanConfirmedForExecutionPath: boolean;
  readonly executionPathCandidateCount: number;
}): ControlledExecutionPathCandidateChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "source shadow routing ready",
      satisfied: input.shadowPlan.decision === SHADOW_ROUTING_READY,
      detail: `sourceShadowRoutingDecision=${input.shadowPlan.decision}`,
    },
    {
      item: "source route candidates satisfied",
      satisfied: input.shadowPlan.routeCandidateSatisfiedCount === input.shadowPlan.routeCandidateCount,
      detail: `sourceRouteCandidateSatisfiedCount=${input.shadowPlan.routeCandidateSatisfiedCount}`,
    },
    {
      item: "executionPathReviewConfirmed",
      satisfied: input.executionPathReviewConfirmed,
      detail: `executionPathReviewConfirmed=${input.executionPathReviewConfirmed}`,
    },
    {
      item: "shadowRoutingReviewConfirmedForExecutionPath",
      satisfied: input.shadowRoutingReviewConfirmedForExecutionPath,
      detail: `shadowRoutingReviewConfirmedForExecutionPath=${input.shadowRoutingReviewConfirmedForExecutionPath}`,
    },
    {
      item: "rollbackReviewConfirmedForExecutionPath",
      satisfied: input.rollbackReviewConfirmedForExecutionPath,
      detail: `rollbackReviewConfirmedForExecutionPath=${input.rollbackReviewConfirmedForExecutionPath}`,
    },
    {
      item: "featureFlagPlanConfirmedForExecutionPath",
      satisfied: input.featureFlagPlanConfirmedForExecutionPath,
      detail: `featureFlagPlanConfirmedForExecutionPath=${input.featureFlagPlanConfirmedForExecutionPath}`,
    },
    {
      item: "execution path candidates generated",
      satisfied: input.executionPathCandidateCount > 0,
      detail: `executionPathCandidateCount=${input.executionPathCandidateCount}`,
    },
  ]);
}

function buildSafetyChecklist(): ControlledExecutionPathCandidateChecklistItem[] {
  return mapChecklistEntries([
    { item: "no runtime execution in this step", satisfied: true, detail: "executesRuntimeInThisStep=false" },
    {
      item: "no execution path change in this step",
      satisfied: true,
      detail: "changesExecutionPathInThisStep=false",
    },
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
  readonly sourceFeatureFlagDefault: string;
  readonly rollbackReviewConfirmedForExecutionPath: boolean;
}): ControlledExecutionPathCandidateChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "rollback review confirmed for execution path",
      satisfied: input.rollbackReviewConfirmedForExecutionPath,
      detail: `rollbackReviewConfirmedForExecutionPath=${input.rollbackReviewConfirmedForExecutionPath}`,
    },
    {
      item: "source feature flag default off",
      satisfied: input.sourceFeatureFlagDefault === "off",
      detail: `sourceFeatureFlagDefault=${input.sourceFeatureFlagDefault}`,
    },
    {
      item: "no execution path change in this step",
      satisfied: true,
      detail: "changesExecutionPathInThisStep=false",
    },
  ]);
}

function buildHandoffChecklist(input: {
  readonly decision: ControlledExecutionPathCandidateDecision;
}): ControlledExecutionPathCandidateChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "ready for Stage 4-E review package",
      satisfied: input.decision === "ready_for_execution_path_review",
      detail: `decision=${input.decision}`,
    },
    {
      item: "not execution path change permission",
      satisfied: true,
      detail: "ready_for_execution_path_review is review handoff only; no execution permission",
    },
  ]);
}

function buildNoRunChecklist(): ControlledExecutionPathCandidateChecklistItem[] {
  return mapChecklistEntries([
    { item: "executesRuntimeInThisStep=false", satisfied: true, detail: "executesRuntimeInThisStep=false" },
    {
      item: "changesExecutionPathInThisStep=false",
      satisfied: true,
      detail: "changesExecutionPathInThisStep=false",
    },
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

const CONTROLLED_EXECUTION_PATH_NO_RUN_REPORT = {
  executesRuntimeInThisStep: false,
  changesExecutionPathInThisStep: false,
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
} as const;

function appendControlledExecutionPathFindings(input: {
  readonly findings: ControlledExecutionPathCandidateFinding[];
  readonly decision: ControlledExecutionPathCandidateDecision;
  readonly shadowPlan: ReturnType<typeof evaluateConnectorGatewayShadowRoutingPlan>;
  readonly executionPathReviewConfirmed: boolean;
  readonly shadowRoutingReviewConfirmedForExecutionPath: boolean;
  readonly rollbackReviewConfirmedForExecutionPath: boolean;
  readonly featureFlagPlanConfirmedForExecutionPath: boolean;
}): void {
  const { findings, decision, shadowPlan } = input;

  findings.push(
    finding(
      "info",
      "controlled_execution_path_candidate_read_only",
      "Controlled execution path candidate is read-only; no execution path change",
    ),
  );
  findings.push(
    finding("info", "execution_path_candidates_generated", "Execution path candidates generated"),
  );

  if (decision === "blocked") {
    if (shadowPlan.decision === "blocked") {
      findings.push(
        finding("blocking", "source_shadow_routing_plan_blocked", "Source shadow routing plan is blocked"),
      );
    }
    if (shadowPlan.noRunChecklistSatisfiedCount !== shadowPlan.noRunChecklistCount) {
      findings.push(
        finding("blocking", "source_shadow_routing_no_run_violation", "Source shadow routing no-run checklist is not satisfied"),
      );
    }
    findings.push(finding("blocking", "controlled_execution_path_candidate_blocked", "Controlled execution path candidate is blocked"));
    return;
  }

  if (decision === "defer") {
    if (shadowPlan.decision !== SHADOW_ROUTING_READY) {
      findings.push(
        finding("warning", "source_shadow_routing_plan_not_ready", "Source shadow routing plan is not ready"),
      );
    }
    if (!input.executionPathReviewConfirmed) {
      findings.push(finding("warning", "execution_path_review_missing", "Execution path review is missing"));
    }
    if (!input.shadowRoutingReviewConfirmedForExecutionPath) {
      findings.push(
        finding(
          "warning",
          "shadow_routing_review_for_execution_path_missing",
          "Shadow routing review for execution path is missing",
        ),
      );
    }
    if (!input.rollbackReviewConfirmedForExecutionPath) {
      findings.push(
        finding("warning", "rollback_review_for_execution_path_missing", "Rollback review for execution path is missing"),
      );
    }
    if (!input.featureFlagPlanConfirmedForExecutionPath) {
      findings.push(
        finding(
          "warning",
          "feature_flag_plan_for_execution_path_missing",
          "Feature flag plan review for execution path is missing",
        ),
      );
    }
    findings.push(finding("warning", "controlled_execution_path_candidate_deferred", "Controlled execution path candidate defers"));
    return;
  }

  findings.push(finding("info", "controlled_execution_path_candidate_ready", "Controlled execution path candidate is ready for review"));
  findings.push(
    finding(
      "info",
      "ready_for_execution_path_review_not_execution_permission",
      "Ready for execution path review; not execution path change permission; Stage 4-E review package required",
    ),
  );
}

/** Read-only controlled execution path candidate — does not change execution path or call connectors. */
export function evaluateControlledExecutionPathCandidate(
  input?: ControlledExecutionPathCandidateInput,
): ControlledExecutionPathCandidateReport {
  const shadowPlan = evaluateConnectorGatewayShadowRoutingPlan(input);
  const flags = resolveExecutionPathFlags(input);

  const executionPathCandidates = buildExecutionPathCandidates(shadowPlan.shadowRouteCandidates);
  const executionPathCandidateCount = executionPathCandidates.length;
  const executionPathCandidateSatisfiedCount = countExecutionPathCandidateSatisfied(executionPathCandidates);

  const decision = resolveControlledExecutionPathCandidateDecision({
    shadowRoutingDecision: shadowPlan.decision,
    sourceNoRunChecklistCount: shadowPlan.noRunChecklistCount,
    sourceNoRunChecklistSatisfiedCount: shadowPlan.noRunChecklistSatisfiedCount,
    ...flags,
  });

  const findings: ControlledExecutionPathCandidateFinding[] = [];
  appendControlledExecutionPathFindings({
    findings,
    decision,
    shadowPlan,
    ...flags,
  });

  const noRunChecklist = buildNoRunChecklist();
  const noRunCounts = checklistCounts(noRunChecklist);

  return {
    mode: "read_only_controlled_execution_path_candidate",
    stage: "stage_4_d",
    decision,
    sourceShadowRoutingDecision: shadowPlan.decision,
    sourceFeatureFlagName: shadowPlan.featureFlagName,
    sourceFeatureFlagDefault: shadowPlan.featureFlagDefault,
    sourceRouteCandidateCount: shadowPlan.routeCandidateCount,
    sourceRouteCandidateSatisfiedCount: shadowPlan.routeCandidateSatisfiedCount,
    sourceNoRunChecklistCount: shadowPlan.noRunChecklistCount,
    sourceNoRunChecklistSatisfiedCount: shadowPlan.noRunChecklistSatisfiedCount,
    sourceFindingCodes: shadowPlan.findings.map((f) => f.code),
    sourceShadowRoutingFindingCodes: shadowPlan.findings.map((f) => f.code),
    sourceShadowRoutingNoRunChecklistCount: shadowPlan.noRunChecklistCount,
    sourceShadowRoutingNoRunChecklistSatisfiedCount: shadowPlan.noRunChecklistSatisfiedCount,
    sourceShadowRoutingRouteCandidateCount: shadowPlan.routeCandidateCount,
    sourceShadowRoutingRouteCandidateSatisfiedCount: shadowPlan.routeCandidateSatisfiedCount,
    executionPathCandidates,
    executionPathCandidateCount,
    executionPathCandidateSatisfiedCount,
    ...flags,
    candidateChecklist: buildCandidateChecklist({
      shadowPlan,
      ...flags,
      executionPathCandidateCount,
    }),
    safetyChecklist: buildSafetyChecklist(),
    rollbackChecklist: buildRollbackChecklist({
      sourceFeatureFlagDefault: shadowPlan.featureFlagDefault,
      rollbackReviewConfirmedForExecutionPath: flags.rollbackReviewConfirmedForExecutionPath,
    }),
    handoffChecklist: buildHandoffChecklist({ decision }),
    noRunChecklist,
    noRunChecklistCount: noRunCounts.count,
    noRunChecklistSatisfiedCount: noRunCounts.satisfiedCount,
    ...CONTROLLED_EXECUTION_PATH_NO_RUN_REPORT,
    findings,
  };
}

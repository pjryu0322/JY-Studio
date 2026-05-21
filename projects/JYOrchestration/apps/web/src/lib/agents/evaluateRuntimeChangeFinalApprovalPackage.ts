/**
 * Evaluate runtime change final approval package (read-only; no runtime/routing/write/DB/schema/git/Cursor/GitHub execution).
 */

import { evaluateConnectorGatewayRoutingShadow } from "@/lib/agents/evaluateConnectorGatewayRoutingShadow";
import { evaluateWritePathWireCandidateVerification } from "@/lib/agents/evaluateWritePathWireCandidateVerification";
import type {
  RuntimeChangeFinalApprovalPackageChecklistItem,
  RuntimeChangeFinalApprovalPackageDecision,
  RuntimeChangeFinalApprovalPackageFinding,
  RuntimeChangeFinalApprovalPackageReport,
} from "@/lib/agents/runtimeChangeFinalApprovalPackageTypes";

const ROUTING_SHADOW_READY = "shadow_ready";
const WIRE_CANDIDATE_READY = "ready_for_wire_candidate_verification";

const FINAL_APPROVAL_CHECKLIST_ITEMS = [
  "routing shadow ready",
  "wire candidate verification ready",
  "final runtime approval confirmed",
  "routing shadow review confirmed",
  "wire candidate review confirmed",
  "stage1 regression review confirmed when required",
  "rollback plan review confirmed when required",
  "operator audit review confirmed",
] as const;

const RUNTIME_SAFETY_CHECKLIST_ITEMS = [
  "final approval package only",
  "no runtime change in this step",
  "no connector routing change in this step",
  "no write path wire in this step",
  "no adapter wire in this step",
  "no feature flag wire in this step",
  "no DB write in this step",
  "no Prisma call in this step",
  "no schema change in this step",
  "no migration in this step",
  "no git execution in this step",
  "no Cursor call in this step",
  "no GitHub call in this step",
  "existing execution path preserved",
] as const;

const ROLLBACK_CHECKLIST_ITEMS = [
  "routing rollback plan reviewed",
  "write path rollback plan reviewed",
  "schema rollback plan reviewed",
  "migration rollback plan reviewed",
  "feature flag rollback plan reviewed",
  "Stage1 regression plan reviewed when required",
  "manual recovery plan required before actual runtime change",
] as const;

const OPERATOR_CHECKLIST_ITEMS = [
  "operator approval required before actual runtime change",
  "operator audit trail required before actual runtime change",
  "operator override policy reviewed",
  "rollback approval policy reviewed",
  "security/reviewer gate must remain before actual route change",
] as const;

function finding(
  severity: RuntimeChangeFinalApprovalPackageFinding["severity"],
  code: string,
  message: string,
): RuntimeChangeFinalApprovalPackageFinding {
  return { severity, code, message };
}

export function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function collectBlockingFindingCodes(
  findings: readonly { readonly severity: string; readonly code: string }[],
): string[] {
  return uniqueStrings(
    findings.filter((f) => f.severity === "blocking").map((f) => f.code),
  );
}

function resolvePackageDecision(input: {
  readonly routingShadowDecision: string;
  readonly wireCandidateDecision: string;
  readonly finalRuntimeApprovalConfirmed: boolean;
  readonly routingShadowReviewConfirmed: boolean;
  readonly wireCandidateReviewConfirmed: boolean;
  readonly requiresStage1Regression: boolean;
  readonly stage1RegressionReviewConfirmed: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly rollbackPlanReviewConfirmed: boolean;
  readonly operatorAuditReviewConfirmed: boolean;
}): RuntimeChangeFinalApprovalPackageDecision {
  if (input.routingShadowDecision === "blocked" || input.wireCandidateDecision === "blocked") {
    return "blocked";
  }

  if (input.routingShadowDecision !== ROUTING_SHADOW_READY) {
    return "defer";
  }

  if (input.wireCandidateDecision !== WIRE_CANDIDATE_READY) {
    return "defer";
  }

  if (!input.finalRuntimeApprovalConfirmed) {
    return "defer";
  }

  if (!input.routingShadowReviewConfirmed) {
    return "defer";
  }

  if (!input.wireCandidateReviewConfirmed) {
    return "defer";
  }

  if (input.requiresStage1Regression && !input.stage1RegressionReviewConfirmed) {
    return "defer";
  }

  if (input.requiresRollbackPlan && !input.rollbackPlanReviewConfirmed) {
    return "defer";
  }

  if (!input.operatorAuditReviewConfirmed) {
    return "defer";
  }

  return "ready_for_final_runtime_change_approval";
}

function buildChecklistFromReasons(
  items: readonly { readonly item: string; readonly satisfied: boolean; readonly reason: string }[],
): RuntimeChangeFinalApprovalPackageChecklistItem[] {
  return items.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: entry.reason,
  }));
}

function buildFinalApprovalChecklist(input: {
  readonly routingShadowReady: boolean;
  readonly routingShadowDecision: string;
  readonly wireCandidateReady: boolean;
  readonly wireCandidateDecision: string;
  readonly finalRuntimeApprovalConfirmed: boolean;
  readonly routingShadowReviewConfirmed: boolean;
  readonly wireCandidateReviewConfirmed: boolean;
  readonly requiresStage1Regression: boolean;
  readonly stage1RegressionReviewConfirmed: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly rollbackPlanReviewConfirmed: boolean;
  readonly operatorAuditReviewConfirmed: boolean;
}): RuntimeChangeFinalApprovalPackageChecklistItem[] {
  return buildChecklistFromReasons(
    FINAL_APPROVAL_CHECKLIST_ITEMS.map((item) => {
      switch (item) {
        case "routing shadow ready":
          return {
            item,
            satisfied: input.routingShadowReady,
            reason: `routing shadow decision=${input.routingShadowDecision}`,
          };
        case "wire candidate verification ready":
          return {
            item,
            satisfied: input.wireCandidateReady,
            reason: `wire candidate decision=${input.wireCandidateDecision}`,
          };
        case "final runtime approval confirmed":
          return {
            item,
            satisfied: input.finalRuntimeApprovalConfirmed,
            reason: `finalRuntimeApprovalConfirmed=${input.finalRuntimeApprovalConfirmed}`,
          };
        case "routing shadow review confirmed":
          return {
            item,
            satisfied: input.routingShadowReviewConfirmed,
            reason: `routingShadowReviewConfirmed=${input.routingShadowReviewConfirmed}`,
          };
        case "wire candidate review confirmed":
          return {
            item,
            satisfied: input.wireCandidateReviewConfirmed,
            reason: `wireCandidateReviewConfirmed=${input.wireCandidateReviewConfirmed}`,
          };
        case "stage1 regression review confirmed when required":
          return {
            item,
            satisfied: !input.requiresStage1Regression || input.stage1RegressionReviewConfirmed,
            reason: `requiresStage1Regression=${input.requiresStage1Regression}; stage1RegressionReviewConfirmed=${input.stage1RegressionReviewConfirmed}`,
          };
        case "rollback plan review confirmed when required":
          return {
            item,
            satisfied: !input.requiresRollbackPlan || input.rollbackPlanReviewConfirmed,
            reason: `requiresRollbackPlan=${input.requiresRollbackPlan}; rollbackPlanReviewConfirmed=${input.rollbackPlanReviewConfirmed}`,
          };
        case "operator audit review confirmed":
          return {
            item,
            satisfied: input.operatorAuditReviewConfirmed,
            reason: `operatorAuditReviewConfirmed=${input.operatorAuditReviewConfirmed}`,
          };
        default:
          return { item, satisfied: false, reason: `${item} not evaluated` };
      }
    }),
  );
}

function buildRuntimeSafetyChecklist(): RuntimeChangeFinalApprovalPackageChecklistItem[] {
  return buildChecklistFromReasons(
    RUNTIME_SAFETY_CHECKLIST_ITEMS.map((item) => {
      let reason = "read-only final approval package only";
      if (item === "no runtime change in this step") {
        reason = "read-only final approval package only; runtime is not changed";
      } else if (item === "no connector routing change in this step") {
        reason = "read-only final approval package only; connector routing is not changed";
      } else if (item === "no write path wire in this step") {
        reason = "read-only final approval package only; write path is not wired";
      } else if (item === "no GitHub call in this step") {
        reason = "read-only final approval package only; GitHub connector is not called";
      } else if (item === "no Cursor call in this step") {
        reason = "read-only final approval package only; Cursor connector is not called";
      } else if (item === "no git execution in this step") {
        reason = "read-only final approval package only; git is not executed";
      } else if (item === "existing execution path preserved") {
        reason = "existing Stage1/runtime execution path is preserved";
      }
      return { item, satisfied: true, reason };
    }),
  );
}

function buildRollbackChecklist(input: {
  readonly routingRollbackChecklistCount: number;
  readonly writePathRollbackChecklistCount: number;
  readonly schemaRollbackReviewed: boolean;
  readonly migrationRollbackReviewed: boolean;
  readonly featureFlagRollbackReviewed: boolean;
  readonly requiresStage1Regression: boolean;
  readonly stage1RegressionReviewConfirmed: boolean;
}): RuntimeChangeFinalApprovalPackageChecklistItem[] {
  return buildChecklistFromReasons(
    ROLLBACK_CHECKLIST_ITEMS.map((item) => {
      switch (item) {
        case "routing rollback plan reviewed":
          return {
            item,
            satisfied: input.routingRollbackChecklistCount > 0,
            reason: `routing shadow rollback checklist count=${input.routingRollbackChecklistCount}`,
          };
        case "write path rollback plan reviewed":
          return {
            item,
            satisfied: input.writePathRollbackChecklistCount > 0,
            reason: `wire candidate rollback checklist count=${input.writePathRollbackChecklistCount}`,
          };
        case "schema rollback plan reviewed":
          return {
            item,
            satisfied: input.schemaRollbackReviewed,
            reason: `schema rollback reviewed=${input.schemaRollbackReviewed}`,
          };
        case "migration rollback plan reviewed":
          return {
            item,
            satisfied: input.migrationRollbackReviewed,
            reason: `migration rollback reviewed=${input.migrationRollbackReviewed}`,
          };
        case "feature flag rollback plan reviewed":
          return {
            item,
            satisfied: input.featureFlagRollbackReviewed,
            reason: `feature flag rollback reviewed=${input.featureFlagRollbackReviewed}`,
          };
        case "Stage1 regression plan reviewed when required":
          return {
            item,
            satisfied: !input.requiresStage1Regression || input.stage1RegressionReviewConfirmed,
            reason: `requiresStage1Regression=${input.requiresStage1Regression}; reviewed=${input.stage1RegressionReviewConfirmed}`,
          };
        case "manual recovery plan required before actual runtime change":
          return {
            item,
            satisfied: true,
            reason: "manual recovery plan is required before any actual runtime change",
          };
        default:
          return { item, satisfied: false, reason: `${item} not evaluated` };
      }
    }),
  );
}

function buildOperatorChecklist(input: {
  readonly operatorApprovalRequired: boolean;
  readonly operatorAuditRequired: boolean;
  readonly overridePolicyReviewed: boolean;
  readonly rollbackApprovalReviewed: boolean;
  readonly securityGateReviewed: boolean;
}): RuntimeChangeFinalApprovalPackageChecklistItem[] {
  return buildChecklistFromReasons(
    OPERATOR_CHECKLIST_ITEMS.map((item) => {
      switch (item) {
        case "operator approval required before actual runtime change":
          return {
            item,
            satisfied: input.operatorApprovalRequired,
            reason: "operator approval is required before any actual runtime change",
          };
        case "operator audit trail required before actual runtime change":
          return {
            item,
            satisfied: input.operatorAuditRequired,
            reason: `operator audit trail required=${input.operatorAuditRequired}`,
          };
        case "operator override policy reviewed":
          return {
            item,
            satisfied: input.overridePolicyReviewed,
            reason: `operator override policy reviewed=${input.overridePolicyReviewed}`,
          };
        case "rollback approval policy reviewed":
          return {
            item,
            satisfied: input.rollbackApprovalReviewed,
            reason: `rollback approval policy reviewed=${input.rollbackApprovalReviewed}`,
          };
        case "security/reviewer gate must remain before actual route change":
          return {
            item,
            satisfied: input.securityGateReviewed,
            reason: "security/reviewer gate must remain before actual route change",
          };
        default:
          return { item, satisfied: false, reason: `${item} not evaluated` };
      }
    }),
  );
}

function appendPackageFindings(input: {
  readonly findings: RuntimeChangeFinalApprovalPackageFinding[];
  readonly decision: RuntimeChangeFinalApprovalPackageDecision;
  readonly routingShadowDecision: string;
  readonly wireCandidateDecision: string;
  readonly finalRuntimeApprovalConfirmed: boolean;
  readonly routingShadowReviewConfirmed: boolean;
  readonly wireCandidateReviewConfirmed: boolean;
  readonly requiresStage1Regression: boolean;
  readonly stage1RegressionReviewConfirmed: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly rollbackPlanReviewConfirmed: boolean;
  readonly operatorAuditReviewConfirmed: boolean;
}): void {
  const {
    findings,
    decision,
    routingShadowDecision,
    wireCandidateDecision,
    finalRuntimeApprovalConfirmed,
    routingShadowReviewConfirmed,
    wireCandidateReviewConfirmed,
    requiresStage1Regression,
    stage1RegressionReviewConfirmed,
    requiresRollbackPlan,
    rollbackPlanReviewConfirmed,
    operatorAuditReviewConfirmed,
  } = input;

  findings.push(
    finding(
      "info",
      "runtime_change_final_approval_package_read_only",
      "runtime change final approval package is read-only; no runtime/routing/write execution",
    ),
  );
  findings.push(finding("info", "no_runtime_change_in_this_step", "runtime is not changed in this step"));
  findings.push(
    finding("info", "no_connector_routing_change_in_this_step", "connector gateway routing is not changed"),
  );
  findings.push(finding("info", "no_write_path_wire_in_this_step", "write path is not wired in this step"));
  findings.push(finding("info", "no_feature_flag_wire_in_this_step", "feature flag is not wired in this step"));
  findings.push(finding("info", "no_db_write_in_this_step", "DB write is not performed in this step"));
  findings.push(finding("info", "no_prisma_call_in_this_step", "Prisma client is not called in this step"));
  findings.push(finding("info", "no_schema_change_in_this_step", "schema.prisma is not modified in this step"));
  findings.push(finding("info", "no_git_execution_in_this_step", "git is not executed in this step"));
  findings.push(finding("info", "no_cursor_call_in_this_step", "Cursor connector is not called in this step"));
  findings.push(finding("info", "no_github_call_in_this_step", "GitHub connector is not called in this step"));

  if (decision === "blocked") {
    if (routingShadowDecision === "blocked") {
      findings.push(finding("blocking", "routing_shadow_blocked", "connector gateway routing shadow is blocked"));
    }
    if (wireCandidateDecision === "blocked") {
      findings.push(
        finding("blocking", "wire_candidate_verification_blocked", "write path wire candidate verification is blocked"),
      );
    }
    findings.push(
      finding("blocking", "runtime_change_final_approval_blocked", "runtime change final approval package is blocked"),
    );
    return;
  }

  if (decision === "defer") {
    if (routingShadowDecision !== ROUTING_SHADOW_READY) {
      findings.push(finding("warning", "routing_shadow_deferred", "connector gateway routing shadow is deferred"));
    }
    if (wireCandidateDecision !== WIRE_CANDIDATE_READY) {
      findings.push(
        finding("warning", "wire_candidate_verification_deferred", "write path wire candidate verification is deferred"),
      );
    }
    if (!finalRuntimeApprovalConfirmed) {
      findings.push(
        finding("warning", "final_runtime_approval_not_confirmed", "final runtime approval is not confirmed"),
      );
    }
    if (!routingShadowReviewConfirmed) {
      findings.push(
        finding("warning", "routing_shadow_review_not_confirmed", "routing shadow review is not confirmed"),
      );
    }
    if (!wireCandidateReviewConfirmed) {
      findings.push(
        finding("warning", "wire_candidate_review_not_confirmed", "wire candidate review is not confirmed"),
      );
    }
    if (requiresStage1Regression && !stage1RegressionReviewConfirmed) {
      findings.push(
        finding("warning", "stage1_regression_review_required", "Stage1 regression review is required before approval"),
      );
    }
    if (requiresRollbackPlan && !rollbackPlanReviewConfirmed) {
      findings.push(
        finding("warning", "rollback_plan_review_required", "rollback plan review is required before approval"),
      );
    }
    if (!operatorAuditReviewConfirmed) {
      findings.push(
        finding("warning", "operator_audit_review_required", "operator audit review is required before approval"),
      );
    }
    findings.push(
      finding(
        "warning",
        "runtime_change_final_approval_deferred",
        "runtime change final approval defers until prerequisites are met",
      ),
    );
    return;
  }

  findings.push(finding("info", "routing_shadow_ready", "connector gateway routing shadow is ready"));
  findings.push(
    finding("info", "wire_candidate_verification_ready", "write path wire candidate verification is ready"),
  );
  findings.push(
    finding("info", "final_runtime_change_approval_ready", "runtime change final approval package is ready"),
  );
  findings.push(
    finding(
      "info",
      "runtime_change_still_requires_separate_execution_stage",
      "final approval package is ready but actual runtime change requires a separate execution stage",
    ),
  );
  findings.push(
    finding("info", "connector_routing_still_not_changed", "connector gateway routing is still not changed"),
  );
  findings.push(finding("info", "write_path_still_not_wired", "write path is still not wired"));
  findings.push(
    finding("info", "schema_migration_still_not_applied", "schema/migration is still not applied in runtime"),
  );
}

/** Read-only final approval package — does not change runtime, routing, write paths, or call git/Cursor/GitHub. */
export function evaluateRuntimeChangeFinalApprovalPackage(input?: {
  readonly routingTarget?: string;
  readonly routingBoundaryIds?: readonly string[];
  readonly routingConnectorIds?: readonly string[];
  readonly agentTarget?: string;
  readonly operatorTarget?: string;
  readonly agentExplicitUserApproval?: boolean;
  readonly operatorExplicitUserApproval?: boolean;
  readonly agentSchemaAppliedConfirmed?: boolean;
  readonly operatorSchemaAppliedConfirmed?: boolean;
  readonly agentMigrationAppliedConfirmed?: boolean;
  readonly operatorMigrationAppliedConfirmed?: boolean;
  readonly agentFeatureFlagWireApproved?: boolean;
  readonly operatorFeatureFlagWireApproved?: boolean;
  readonly agentWriteAdapterImplementedConfirmed?: boolean;
  readonly operatorWriteAdapterImplementedConfirmed?: boolean;
  readonly operatorPermissionModelConfirmed?: boolean;
  readonly operatorAuditTrailConfirmed?: boolean;
  readonly schemaMigrationReadinessConfirmed?: boolean;
  readonly explicitShadowApproval?: boolean;
  readonly finalRuntimeApprovalConfirmed?: boolean;
  readonly routingShadowReviewConfirmed?: boolean;
  readonly wireCandidateReviewConfirmed?: boolean;
  readonly stage1RegressionReviewConfirmed?: boolean;
  readonly rollbackPlanReviewConfirmed?: boolean;
  readonly operatorAuditReviewConfirmed?: boolean;
}): RuntimeChangeFinalApprovalPackageReport {
  const requestedRoutingTarget = input?.routingTarget ?? "cursor_only";
  const requestedRoutingBoundaryIds = input?.routingBoundaryIds ?? ["cursor.execution.before"];
  const requestedRoutingConnectorIds = input?.routingConnectorIds ?? [];

  const routingShadow = evaluateConnectorGatewayRoutingShadow({
    target: requestedRoutingTarget,
    boundaryIds: requestedRoutingBoundaryIds,
    connectorIds: input?.routingConnectorIds,
    explicitShadowApproval: input?.explicitShadowApproval,
  });

  const wireCandidate = evaluateWritePathWireCandidateVerification({
    agentTarget: input?.agentTarget ?? "agent_execution_record",
    operatorTarget: input?.operatorTarget ?? "operator_approval",
    agentExplicitUserApproval: input?.agentExplicitUserApproval,
    operatorExplicitUserApproval: input?.operatorExplicitUserApproval,
    agentSchemaAppliedConfirmed: input?.agentSchemaAppliedConfirmed,
    operatorSchemaAppliedConfirmed: input?.operatorSchemaAppliedConfirmed,
    agentMigrationAppliedConfirmed: input?.agentMigrationAppliedConfirmed,
    operatorMigrationAppliedConfirmed: input?.operatorMigrationAppliedConfirmed,
    agentFeatureFlagWireApproved: input?.agentFeatureFlagWireApproved,
    operatorFeatureFlagWireApproved: input?.operatorFeatureFlagWireApproved,
    agentWriteAdapterImplementedConfirmed: input?.agentWriteAdapterImplementedConfirmed,
    operatorWriteAdapterImplementedConfirmed: input?.operatorWriteAdapterImplementedConfirmed,
    operatorPermissionModelConfirmed: input?.operatorPermissionModelConfirmed,
    operatorAuditTrailConfirmed: input?.operatorAuditTrailConfirmed,
    schemaMigrationReadinessConfirmed: input?.schemaMigrationReadinessConfirmed,
  });

  const finalRuntimeApprovalConfirmed = input?.finalRuntimeApprovalConfirmed === true;
  const routingShadowReviewConfirmed = input?.routingShadowReviewConfirmed === true;
  const wireCandidateReviewConfirmed = input?.wireCandidateReviewConfirmed === true;
  const stage1RegressionReviewConfirmed = input?.stage1RegressionReviewConfirmed === true;
  const rollbackPlanReviewConfirmed = input?.rollbackPlanReviewConfirmed === true;
  const operatorAuditReviewConfirmed = input?.operatorAuditReviewConfirmed === true;

  const sourceRoutingShadowRequiresStage1Regression = routingShadow.sourceRoutingRequiresStage1Regression;
  const sourceRoutingShadowRequiresRollbackPlan = routingShadow.sourceBranchManualVerificationRollbackRequired;

  const decision = resolvePackageDecision({
    routingShadowDecision: routingShadow.decision,
    wireCandidateDecision: wireCandidate.decision,
    finalRuntimeApprovalConfirmed,
    routingShadowReviewConfirmed,
    wireCandidateReviewConfirmed,
    requiresStage1Regression: sourceRoutingShadowRequiresStage1Regression,
    stage1RegressionReviewConfirmed,
    requiresRollbackPlan: sourceRoutingShadowRequiresRollbackPlan,
    rollbackPlanReviewConfirmed,
    operatorAuditReviewConfirmed,
  });

  const routingShadowReady = routingShadow.decision === ROUTING_SHADOW_READY;
  const wireCandidateReady = wireCandidate.decision === WIRE_CANDIDATE_READY;

  const sourceRoutingShadowBlockingFindingCodes = collectBlockingFindingCodes(routingShadow.findings);
  const sourceWireCandidateBlockingFindingCodes = uniqueStrings([
    ...wireCandidate.sourceAgentWireGateBlockingFindingCodes,
    ...wireCandidate.sourceOperatorWireGateBlockingFindingCodes,
    ...collectBlockingFindingCodes(wireCandidate.findings),
  ]);

  const finalApprovalChecklist = buildFinalApprovalChecklist({
    routingShadowReady,
    routingShadowDecision: routingShadow.decision,
    wireCandidateReady,
    wireCandidateDecision: wireCandidate.decision,
    finalRuntimeApprovalConfirmed,
    routingShadowReviewConfirmed,
    wireCandidateReviewConfirmed,
    requiresStage1Regression: sourceRoutingShadowRequiresStage1Regression,
    stage1RegressionReviewConfirmed,
    requiresRollbackPlan: sourceRoutingShadowRequiresRollbackPlan,
    rollbackPlanReviewConfirmed,
    operatorAuditReviewConfirmed,
  });

  const runtimeSafetyChecklist = buildRuntimeSafetyChecklist();

  const rollbackChecklist = buildRollbackChecklist({
    routingRollbackChecklistCount: routingShadow.rollbackChecklist.length,
    writePathRollbackChecklistCount: wireCandidate.rollbackChecklist.length,
    schemaRollbackReviewed: wireCandidate.sourceSchemaMigrationAgentRequiresSchemaChange,
    migrationRollbackReviewed: wireCandidate.sourceSchemaMigrationOperatorRequiresMigration,
    featureFlagRollbackReviewed: wireCandidate.sourceAgentFeatureFlagName.length > 0,
    requiresStage1Regression: sourceRoutingShadowRequiresStage1Regression,
    stage1RegressionReviewConfirmed,
  });

  const operatorChecklist = buildOperatorChecklist({
    operatorApprovalRequired: true,
    operatorAuditRequired: wireCandidate.sourceOperatorWireGateAuditChecklistCount > 0,
    overridePolicyReviewed: wireCandidate.operatorPermissionModelConfirmed,
    rollbackApprovalReviewed: rollbackPlanReviewConfirmed,
    securityGateReviewed: true,
  });

  const findings: RuntimeChangeFinalApprovalPackageFinding[] = [];
  appendPackageFindings({
    findings,
    decision,
    routingShadowDecision: routingShadow.decision,
    wireCandidateDecision: wireCandidate.decision,
    finalRuntimeApprovalConfirmed,
    routingShadowReviewConfirmed,
    wireCandidateReviewConfirmed,
    requiresStage1Regression: sourceRoutingShadowRequiresStage1Regression,
    stage1RegressionReviewConfirmed,
    requiresRollbackPlan: sourceRoutingShadowRequiresRollbackPlan,
    rollbackPlanReviewConfirmed,
    operatorAuditReviewConfirmed,
  });

  return {
    mode: "read_only_runtime_change_final_approval_package",
    decision,
    requestedRoutingTarget,
    requestedRoutingBoundaryIds: [...requestedRoutingBoundaryIds],
    requestedRoutingConnectorIds: [...requestedRoutingConnectorIds],
    sourceRoutingShadowDecision: routingShadow.decision,
    sourceRoutingShadowRouteMode: routingShadow.routeMode,
    sourceRoutingShadowTarget: routingShadow.target,
    sourceRoutingShadowActualRuntimePath: routingShadow.actualRuntimePath,
    sourceRoutingShadowShadowRuntimePath: routingShadow.shadowRuntimePath,
    sourceRoutingShadowObservesOnly: routingShadow.observesOnly,
    sourceRoutingShadowChangesRuntimeRouteInThisStep: false,
    sourceRoutingShadowCallsConnectorInThisStep: false,
    sourceRoutingShadowInvokesCursorInThisStep: false,
    sourceRoutingShadowInvokesGithubInThisStep: false,
    sourceRoutingShadowWiresFeatureFlagInThisStep: false,
    sourceRoutingShadowWritesDataInThisStep: false,
    sourceRoutingShadowBoundaryIds: [...routingShadow.boundaryIds],
    sourceRoutingShadowConnectorIds: [...routingShadow.connectorIds],
    sourceRoutingShadowBoundarySource: routingShadow.boundarySource,
    sourceRoutingShadowConnectorSource: routingShadow.connectorSource,
    sourceRoutingShadowRequiresStage1Regression,
    sourceRoutingShadowRequiresRollbackPlan,
    sourceRoutingShadowBlockingFindingCodes,
    sourceWireCandidateDecision: wireCandidate.decision,
    sourceWireCandidateAgentWireGateDecision: wireCandidate.sourceAgentWireGateDecision,
    sourceWireCandidateOperatorWireGateDecision: wireCandidate.sourceOperatorWireGateDecision,
    sourceWireCandidateSchemaMigrationDecision: wireCandidate.sourceSchemaMigrationReadinessDecision,
    sourceWireCandidateBlockingFindingCodes,
    sourceWireCandidateRequestedAgentTarget: wireCandidate.requestedAgentTarget,
    sourceWireCandidateRequestedOperatorTarget: wireCandidate.requestedOperatorTarget,
    sourceWireCandidateNormalizedAgentTarget: wireCandidate.normalizedAgentTarget,
    sourceWireCandidateNormalizedOperatorTarget: wireCandidate.normalizedOperatorTarget,
    sourceWireCandidateSchemaMigrationReviewConfirmed: wireCandidate.schemaMigrationReadinessReviewConfirmed,
    sourceWireCandidateSchemaAppliedInRuntime: false,
    sourceWireCandidateMigrationAppliedInRuntime: false,
    sourceWireCandidateVerifiesCandidateOnly: true,
    sourceWireCandidateWiresWritePathInThisStep: false,
    sourceWireCandidateWiresAdapterInThisStep: false,
    sourceWireCandidateWritesDataInThisStep: false,
    sourceWireCandidateCallsPrismaInThisStep: false,
    sourceWireCandidateModifiesSchemaInThisStep: false,
    sourceWireCandidateCreatesMigrationInThisStep: false,
    sourceWireCandidateWiresFeatureFlagInThisStep: false,
    sourceWireCandidateChangesRuntimeRouteInThisStep: false,
    finalRuntimeApprovalConfirmed,
    routingShadowReviewConfirmed,
    wireCandidateReviewConfirmed,
    stage1RegressionReviewConfirmed,
    rollbackPlanReviewConfirmed,
    operatorAuditReviewConfirmed,
    finalApprovalChecklist,
    runtimeSafetyChecklist,
    rollbackChecklist,
    operatorChecklist,
    packagesApprovalOnly: true,
    changesRuntimeInThisStep: false,
    changesConnectorRoutingInThisStep: false,
    wiresWritePathInThisStep: false,
    wiresAdapterInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    executesGitInThisStep: false,
    callsCursorInThisStep: false,
    callsGitHubInThisStep: false,
    findings,
  };
}

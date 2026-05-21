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

function collectBlockingFindingCodes(
  findings: readonly { readonly severity: string; readonly code: string }[],
): string[] {
  return findings.filter((f) => f.severity === "blocking").map((f) => f.code);
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

function buildChecklist(
  items: readonly string[],
  satisfaction: Record<string, boolean>,
): RuntimeChangeFinalApprovalPackageChecklistItem[] {
  return items.map((item) => ({
    item,
    satisfied: satisfaction[item] ?? false,
    reason: (satisfaction[item] ?? false)
      ? `${item} satisfied`
      : `${item} not satisfied`,
  }));
}

function buildFinalApprovalChecklist(input: {
  readonly routingShadowReady: boolean;
  readonly wireCandidateReady: boolean;
  readonly finalRuntimeApprovalConfirmed: boolean;
  readonly routingShadowReviewConfirmed: boolean;
  readonly wireCandidateReviewConfirmed: boolean;
  readonly requiresStage1Regression: boolean;
  readonly stage1RegressionReviewConfirmed: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly rollbackPlanReviewConfirmed: boolean;
  readonly operatorAuditReviewConfirmed: boolean;
}): RuntimeChangeFinalApprovalPackageChecklistItem[] {
  return buildChecklist(FINAL_APPROVAL_CHECKLIST_ITEMS, {
    "routing shadow ready": input.routingShadowReady,
    "wire candidate verification ready": input.wireCandidateReady,
    "final runtime approval confirmed": input.finalRuntimeApprovalConfirmed,
    "routing shadow review confirmed": input.routingShadowReviewConfirmed,
    "wire candidate review confirmed": input.wireCandidateReviewConfirmed,
    "stage1 regression review confirmed when required":
      !input.requiresStage1Regression || input.stage1RegressionReviewConfirmed,
    "rollback plan review confirmed when required":
      !input.requiresRollbackPlan || input.rollbackPlanReviewConfirmed,
    "operator audit review confirmed": input.operatorAuditReviewConfirmed,
  });
}

function buildRuntimeSafetyChecklist(): RuntimeChangeFinalApprovalPackageChecklistItem[] {
  return buildChecklist(RUNTIME_SAFETY_CHECKLIST_ITEMS, {
    "final approval package only": true,
    "no runtime change in this step": true,
    "no connector routing change in this step": true,
    "no write path wire in this step": true,
    "no adapter wire in this step": true,
    "no feature flag wire in this step": true,
    "no DB write in this step": true,
    "no Prisma call in this step": true,
    "no schema change in this step": true,
    "no migration in this step": true,
    "no git execution in this step": true,
    "no Cursor call in this step": true,
    "no GitHub call in this step": true,
    "existing execution path preserved": true,
  });
}

function buildRollbackChecklist(input: {
  readonly routingRollbackReviewed: boolean;
  readonly writePathRollbackReviewed: boolean;
  readonly schemaRollbackReviewed: boolean;
  readonly migrationRollbackReviewed: boolean;
  readonly featureFlagRollbackReviewed: boolean;
  readonly requiresStage1Regression: boolean;
  readonly stage1RegressionReviewConfirmed: boolean;
}): RuntimeChangeFinalApprovalPackageChecklistItem[] {
  return buildChecklist(ROLLBACK_CHECKLIST_ITEMS, {
    "routing rollback plan reviewed": input.routingRollbackReviewed,
    "write path rollback plan reviewed": input.writePathRollbackReviewed,
    "schema rollback plan reviewed": input.schemaRollbackReviewed,
    "migration rollback plan reviewed": input.migrationRollbackReviewed,
    "feature flag rollback plan reviewed": input.featureFlagRollbackReviewed,
    "Stage1 regression plan reviewed when required":
      !input.requiresStage1Regression || input.stage1RegressionReviewConfirmed,
    "manual recovery plan required before actual runtime change": true,
  });
}

function buildOperatorChecklist(input: {
  readonly operatorApprovalRequired: boolean;
  readonly operatorAuditRequired: boolean;
  readonly overridePolicyReviewed: boolean;
  readonly rollbackApprovalReviewed: boolean;
  readonly securityGateReviewed: boolean;
}): RuntimeChangeFinalApprovalPackageChecklistItem[] {
  return buildChecklist(OPERATOR_CHECKLIST_ITEMS, {
    "operator approval required before actual runtime change": input.operatorApprovalRequired,
    "operator audit trail required before actual runtime change": input.operatorAuditRequired,
    "operator override policy reviewed": input.overridePolicyReviewed,
    "rollback approval policy reviewed": input.rollbackApprovalReviewed,
    "security/reviewer gate must remain before actual route change": input.securityGateReviewed,
  });
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
  const routingTarget = input?.routingTarget ?? "cursor_only";
  const routingBoundaryIds = input?.routingBoundaryIds ?? ["cursor.execution.before"];

  const routingShadow = evaluateConnectorGatewayRoutingShadow({
    target: routingTarget,
    boundaryIds: routingBoundaryIds,
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
  const sourceWireCandidateBlockingFindingCodes = [
    ...wireCandidate.sourceAgentWireGateBlockingFindingCodes,
    ...wireCandidate.sourceOperatorWireGateBlockingFindingCodes,
  ];

  const finalApprovalChecklist = buildFinalApprovalChecklist({
    routingShadowReady,
    wireCandidateReady,
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
    routingRollbackReviewed: routingShadow.rollbackChecklist.length > 0,
    writePathRollbackReviewed: wireCandidate.rollbackChecklist.some((c) => c.satisfied),
    schemaRollbackReviewed: wireCandidate.sourceSchemaMigrationAgentRequiresMigration,
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
    sourceRoutingShadowDecision: routingShadow.decision,
    sourceRoutingShadowRouteMode: routingShadow.routeMode,
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

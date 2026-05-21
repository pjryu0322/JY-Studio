/**
 * Evaluate Agent / Operator write path wire candidate verification (read-only; no wire/adapter/DB/Prisma/schema/migration).
 */

import { evaluateAgentExecutionRecordWritePathWireApprovalGate } from "@/lib/agents/evaluateAgentExecutionRecordWritePathWireApprovalGate";
import { evaluateOperatorApprovalAuditWritePathWireApprovalGate } from "@/lib/agents/evaluateOperatorApprovalAuditWritePathWireApprovalGate";
import { evaluateSchemaMigrationPrReadinessIntegration } from "@/lib/agents/evaluateSchemaMigrationPrReadinessIntegration";
import type {
  WritePathWireCandidateVerificationChecklistItem,
  WritePathWireCandidateVerificationDecision,
  WritePathWireCandidateVerificationFinding,
  WritePathWireCandidateVerificationReport,
} from "@/lib/agents/writePathWireCandidateVerificationTypes";

const SCHEMA_MIGRATION_READY_DECISION = "ready_for_schema_migration_pr_readiness";
const WIRE_GATE_READY_DECISION = "ready_for_write_path_wire_approval";

const CANDIDATE_CHECKLIST_ITEMS = [
  "agent wire gate ready",
  "operator wire gate ready",
  "schema migration readiness ready",
  "schema migration readiness confirmed",
  "agent explicit user approval provided",
  "operator explicit user approval provided",
  "agent schema applied confirmed",
  "operator schema applied confirmed",
  "agent migration applied confirmed",
  "operator migration applied confirmed",
  "agent feature flag wire approved",
  "operator feature flag wire approved",
  "agent write adapter implemented confirmed",
  "operator write adapter implemented confirmed",
  "operator permission model confirmed",
  "operator audit trail confirmed",
] as const;

const SAFETY_CHECKLIST_ITEMS = [
  "wire candidate verification only",
  "no write path wire in this step",
  "no adapter wire in this step",
  "no DB write in this step",
  "no Prisma call in this step",
  "no schema change in this step",
  "no migration in this step",
  "no feature flag wire in this step",
  "no runtime route change in this step",
  "existing execution path preserved",
] as const;

const ROLLBACK_CHECKLIST_ITEMS = [
  "agent rollback plan reviewed",
  "operator rollback plan reviewed",
  "schema rollback reviewed",
  "migration rollback reviewed",
  "feature flag rollback reviewed",
  "operator approval required before actual wire",
  "audit trail impact reviewed before actual wire",
] as const;

function finding(
  severity: WritePathWireCandidateVerificationFinding["severity"],
  code: string,
  message: string,
): WritePathWireCandidateVerificationFinding {
  return { severity, code, message };
}

function resolveVerificationDecision(input: {
  readonly agentWireGateDecision: string;
  readonly operatorWireGateDecision: string;
  readonly schemaMigrationReadinessDecision: string;
  readonly schemaMigrationReadinessConfirmed: boolean;
}): WritePathWireCandidateVerificationDecision {
  if (
    input.agentWireGateDecision === "blocked" ||
    input.operatorWireGateDecision === "blocked" ||
    input.schemaMigrationReadinessDecision === "blocked"
  ) {
    return "blocked";
  }

  if (!input.schemaMigrationReadinessConfirmed) {
    return "defer";
  }

  if (input.agentWireGateDecision !== WIRE_GATE_READY_DECISION) {
    return "defer";
  }

  if (input.operatorWireGateDecision !== WIRE_GATE_READY_DECISION) {
    return "defer";
  }

  if (input.schemaMigrationReadinessDecision !== SCHEMA_MIGRATION_READY_DECISION) {
    return "defer";
  }

  return "ready_for_wire_candidate_verification";
}

function buildChecklist(
  items: readonly string[],
  satisfaction: Record<string, boolean>,
): WritePathWireCandidateVerificationChecklistItem[] {
  return items.map((item) => ({
    item,
    satisfied: satisfaction[item] ?? false,
    reason: (satisfaction[item] ?? false)
      ? `${item} satisfied`
      : `${item} not satisfied`,
  }));
}

function buildCandidateChecklist(input: {
  readonly agentWireGateReady: boolean;
  readonly operatorWireGateReady: boolean;
  readonly schemaMigrationReadinessReady: boolean;
  readonly schemaMigrationReadinessConfirmed: boolean;
  readonly agentExplicitUserApprovalProvided: boolean;
  readonly operatorExplicitUserApprovalProvided: boolean;
  readonly agentSchemaAppliedConfirmed: boolean;
  readonly operatorSchemaAppliedConfirmed: boolean;
  readonly agentMigrationAppliedConfirmed: boolean;
  readonly operatorMigrationAppliedConfirmed: boolean;
  readonly agentFeatureFlagWireApproved: boolean;
  readonly operatorFeatureFlagWireApproved: boolean;
  readonly agentWriteAdapterImplementedConfirmed: boolean;
  readonly operatorWriteAdapterImplementedConfirmed: boolean;
  readonly operatorPermissionModelConfirmed: boolean;
  readonly operatorAuditTrailConfirmed: boolean;
}): WritePathWireCandidateVerificationChecklistItem[] {
  return buildChecklist(CANDIDATE_CHECKLIST_ITEMS, {
    "agent wire gate ready": input.agentWireGateReady,
    "operator wire gate ready": input.operatorWireGateReady,
    "schema migration readiness ready": input.schemaMigrationReadinessReady,
    "schema migration readiness confirmed": input.schemaMigrationReadinessConfirmed,
    "agent explicit user approval provided": input.agentExplicitUserApprovalProvided,
    "operator explicit user approval provided": input.operatorExplicitUserApprovalProvided,
    "agent schema applied confirmed": input.agentSchemaAppliedConfirmed,
    "operator schema applied confirmed": input.operatorSchemaAppliedConfirmed,
    "agent migration applied confirmed": input.agentMigrationAppliedConfirmed,
    "operator migration applied confirmed": input.operatorMigrationAppliedConfirmed,
    "agent feature flag wire approved": input.agentFeatureFlagWireApproved,
    "operator feature flag wire approved": input.operatorFeatureFlagWireApproved,
    "agent write adapter implemented confirmed": input.agentWriteAdapterImplementedConfirmed,
    "operator write adapter implemented confirmed": input.operatorWriteAdapterImplementedConfirmed,
    "operator permission model confirmed": input.operatorPermissionModelConfirmed,
    "operator audit trail confirmed": input.operatorAuditTrailConfirmed,
  });
}

function buildSafetyChecklist(): WritePathWireCandidateVerificationChecklistItem[] {
  return buildChecklist(SAFETY_CHECKLIST_ITEMS, {
    "wire candidate verification only": true,
    "no write path wire in this step": true,
    "no adapter wire in this step": true,
    "no DB write in this step": true,
    "no Prisma call in this step": true,
    "no schema change in this step": true,
    "no migration in this step": true,
    "no feature flag wire in this step": true,
    "no runtime route change in this step": true,
    "existing execution path preserved": true,
  });
}

function buildRollbackChecklist(input: {
  readonly agentRollbackReviewed: boolean;
  readonly operatorRollbackReviewed: boolean;
  readonly schemaRollbackReviewed: boolean;
  readonly migrationRollbackReviewed: boolean;
  readonly featureFlagRollbackReviewed: boolean;
  readonly operatorApprovalRequired: boolean;
  readonly auditTrailImpactReviewed: boolean;
}): WritePathWireCandidateVerificationChecklistItem[] {
  return buildChecklist(ROLLBACK_CHECKLIST_ITEMS, {
    "agent rollback plan reviewed": input.agentRollbackReviewed,
    "operator rollback plan reviewed": input.operatorRollbackReviewed,
    "schema rollback reviewed": input.schemaRollbackReviewed,
    "migration rollback reviewed": input.migrationRollbackReviewed,
    "feature flag rollback reviewed": input.featureFlagRollbackReviewed,
    "operator approval required before actual wire": input.operatorApprovalRequired,
    "audit trail impact reviewed before actual wire": input.auditTrailImpactReviewed,
  });
}

function appendVerificationFindings(input: {
  readonly findings: WritePathWireCandidateVerificationFinding[];
  readonly decision: WritePathWireCandidateVerificationDecision;
  readonly agentWireGateDecision: string;
  readonly operatorWireGateDecision: string;
  readonly schemaMigrationReadinessDecision: string;
  readonly schemaMigrationReadinessConfirmed: boolean;
}): void {
  const {
    findings,
    decision,
    agentWireGateDecision,
    operatorWireGateDecision,
    schemaMigrationReadinessDecision,
    schemaMigrationReadinessConfirmed,
  } = input;

  findings.push(
    finding(
      "info",
      "write_path_wire_candidate_verification_read_only",
      "write path wire candidate verification is read-only; no write path wire or DB access",
    ),
  );
  findings.push(finding("info", "no_write_path_wire_in_this_step", "write path is not wired in this step"));
  findings.push(finding("info", "no_adapter_wire_in_this_step", "write adapter is not wired in this step"));
  findings.push(finding("info", "no_db_write_in_this_step", "DB write is not performed in this step"));
  findings.push(finding("info", "no_prisma_call_in_this_step", "Prisma client is not called in this step"));
  findings.push(finding("info", "no_feature_flag_wire_in_this_step", "feature flag is not wired in this step"));

  if (decision === "blocked") {
    if (agentWireGateDecision === "blocked") {
      findings.push(finding("blocking", "agent_wire_gate_blocked", "agent write path wire gate is blocked"));
    }
    if (operatorWireGateDecision === "blocked") {
      findings.push(finding("blocking", "operator_wire_gate_blocked", "operator write path wire gate is blocked"));
    }
    if (schemaMigrationReadinessDecision === "blocked") {
      findings.push(
        finding("blocking", "schema_migration_readiness_blocked", "schema migration PR readiness is blocked"),
      );
    }
    findings.push(
      finding(
        "blocking",
        "write_path_wire_candidate_verification_blocked",
        "write path wire candidate verification is blocked",
      ),
    );
    return;
  }

  if (decision === "defer") {
    if (agentWireGateDecision !== WIRE_GATE_READY_DECISION) {
      findings.push(finding("warning", "agent_wire_gate_deferred", "agent write path wire gate is deferred"));
    }
    if (operatorWireGateDecision !== WIRE_GATE_READY_DECISION) {
      findings.push(finding("warning", "operator_wire_gate_deferred", "operator write path wire gate is deferred"));
    }
    if (schemaMigrationReadinessDecision !== SCHEMA_MIGRATION_READY_DECISION) {
      findings.push(
        finding("warning", "schema_migration_readiness_deferred", "schema migration PR readiness is deferred"),
      );
    }
    if (!schemaMigrationReadinessConfirmed) {
      findings.push(
        finding(
          "warning",
          "schema_migration_readiness_not_confirmed",
          "schema migration PR readiness review is not confirmed",
        ),
      );
    }
    findings.push(
      finding(
        "warning",
        "write_path_wire_candidate_verification_deferred",
        "write path wire candidate verification defers until prerequisites are met",
      ),
    );
    return;
  }

  findings.push(finding("info", "agent_wire_gate_ready", "agent write path wire gate is ready"));
  findings.push(finding("info", "operator_wire_gate_ready", "operator write path wire gate is ready"));
  findings.push(finding("info", "schema_migration_readiness_ready", "schema migration PR readiness is ready"));
  findings.push(
    finding("info", "schema_migration_readiness_confirmed", "schema migration PR readiness review is confirmed"),
  );
  findings.push(
    finding("info", "wire_candidate_verification_ready", "write path wire candidate verification is ready"),
  );
}

/** Read-only write path wire candidate verification — does not wire write paths, adapters, or modify schema. */
export function evaluateWritePathWireCandidateVerification(input?: {
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
}): WritePathWireCandidateVerificationReport {
  const agentTarget = input?.agentTarget ?? "agent_execution_record";
  const operatorTarget = input?.operatorTarget ?? "operator_approval";

  const agentExplicitUserApprovalProvided = input?.agentExplicitUserApproval === true;
  const operatorExplicitUserApprovalProvided = input?.operatorExplicitUserApproval === true;
  const agentSchemaAppliedConfirmed = input?.agentSchemaAppliedConfirmed === true;
  const operatorSchemaAppliedConfirmed = input?.operatorSchemaAppliedConfirmed === true;
  const agentMigrationAppliedConfirmed = input?.agentMigrationAppliedConfirmed === true;
  const operatorMigrationAppliedConfirmed = input?.operatorMigrationAppliedConfirmed === true;
  const agentFeatureFlagWireApproved = input?.agentFeatureFlagWireApproved === true;
  const operatorFeatureFlagWireApproved = input?.operatorFeatureFlagWireApproved === true;
  const agentWriteAdapterImplementedConfirmed = input?.agentWriteAdapterImplementedConfirmed === true;
  const operatorWriteAdapterImplementedConfirmed = input?.operatorWriteAdapterImplementedConfirmed === true;
  const operatorPermissionModelConfirmed = input?.operatorPermissionModelConfirmed === true;
  const operatorAuditTrailConfirmed = input?.operatorAuditTrailConfirmed === true;
  const schemaMigrationReadinessConfirmed = input?.schemaMigrationReadinessConfirmed === true;

  const agentWireGate = evaluateAgentExecutionRecordWritePathWireApprovalGate({
    target: agentTarget,
    explicitUserApproval: input?.agentExplicitUserApproval,
    schemaAppliedConfirmed: input?.agentSchemaAppliedConfirmed,
    migrationAppliedConfirmed: input?.agentMigrationAppliedConfirmed,
    featureFlagWireApproved: input?.agentFeatureFlagWireApproved,
    writeAdapterImplementedConfirmed: input?.agentWriteAdapterImplementedConfirmed,
  });

  const operatorWireGate = evaluateOperatorApprovalAuditWritePathWireApprovalGate({
    target: operatorTarget,
    explicitUserApproval: input?.operatorExplicitUserApproval,
    schemaAppliedConfirmed: input?.operatorSchemaAppliedConfirmed,
    migrationAppliedConfirmed: input?.operatorMigrationAppliedConfirmed,
    featureFlagWireApproved: input?.operatorFeatureFlagWireApproved,
    writeAdapterImplementedConfirmed: input?.operatorWriteAdapterImplementedConfirmed,
    permissionModelConfirmed: input?.operatorPermissionModelConfirmed,
    auditTrailConfirmed: input?.operatorAuditTrailConfirmed,
  });

  const schemaMigrationReadiness = evaluateSchemaMigrationPrReadinessIntegration({
    agentTarget,
    operatorTarget,
    agentExplicitUserApproval: input?.agentExplicitUserApproval,
    operatorExplicitUserApproval: input?.operatorExplicitUserApproval,
    writeAdapterIntegrationConfirmed: schemaMigrationReadinessConfirmed,
  });

  const decision = resolveVerificationDecision({
    agentWireGateDecision: agentWireGate.decision,
    operatorWireGateDecision: operatorWireGate.decision,
    schemaMigrationReadinessDecision: schemaMigrationReadiness.decision,
    schemaMigrationReadinessConfirmed,
  });

  const agentWireGateReady = agentWireGate.decision === WIRE_GATE_READY_DECISION;
  const operatorWireGateReady = operatorWireGate.decision === WIRE_GATE_READY_DECISION;
  const schemaMigrationReadinessReady =
    schemaMigrationReadiness.decision === SCHEMA_MIGRATION_READY_DECISION;

  const candidateChecklist = buildCandidateChecklist({
    agentWireGateReady,
    operatorWireGateReady,
    schemaMigrationReadinessReady,
    schemaMigrationReadinessConfirmed,
    agentExplicitUserApprovalProvided,
    operatorExplicitUserApprovalProvided,
    agentSchemaAppliedConfirmed,
    operatorSchemaAppliedConfirmed,
    agentMigrationAppliedConfirmed,
    operatorMigrationAppliedConfirmed,
    agentFeatureFlagWireApproved,
    operatorFeatureFlagWireApproved,
    agentWriteAdapterImplementedConfirmed,
    operatorWriteAdapterImplementedConfirmed,
    operatorPermissionModelConfirmed,
    operatorAuditTrailConfirmed,
  });

  const safetyChecklist = buildSafetyChecklist();

  const rollbackChecklist = buildRollbackChecklist({
    agentRollbackReviewed: agentWireGate.sourceWritePathRollbackPlan.length > 0,
    operatorRollbackReviewed: operatorWireGate.sourceWritePathRollbackPlan.length > 0,
    schemaRollbackReviewed: agentWireGate.sourceSchemaApprovalRollbackItemCount > 0,
    migrationRollbackReviewed:
      agentWireGate.sourceSchemaApprovalMigrationItemCount > 0 ||
      operatorWireGate.sourceSchemaApprovalMigrationItemCount > 0,
    featureFlagRollbackReviewed:
      agentWireGate.sourceWritePathFeatureFlagName.length > 0 &&
      agentWireGate.sourceWritePathRollbackPlan.length > 0,
    operatorApprovalRequired: true,
    auditTrailImpactReviewed: operatorWireGate.auditChecklist.length > 0,
  });

  const findings: WritePathWireCandidateVerificationFinding[] = [];
  appendVerificationFindings({
    findings,
    decision,
    agentWireGateDecision: agentWireGate.decision,
    operatorWireGateDecision: operatorWireGate.decision,
    schemaMigrationReadinessDecision: schemaMigrationReadiness.decision,
    schemaMigrationReadinessConfirmed,
  });

  return {
    mode: "read_only_write_path_wire_candidate_verification",
    decision,
    sourceAgentWireGateDecision: agentWireGate.decision,
    sourceOperatorWireGateDecision: operatorWireGate.decision,
    sourceSchemaMigrationReadinessDecision: schemaMigrationReadiness.decision,
    sourceAgentWritePathTarget: agentWireGate.sourceWritePathTarget,
    sourceOperatorWritePathTarget: operatorWireGate.sourceWritePathTarget,
    sourceAgentFeatureFlagName: agentWireGate.sourceWritePathFeatureFlagName,
    sourceOperatorFeatureFlagName: operatorWireGate.sourceWritePathFeatureFlagName,
    sourceAgentSchemaApprovalDecision: agentWireGate.sourceSchemaApprovalDecision,
    sourceOperatorSchemaApprovalDecision: operatorWireGate.sourceSchemaApprovalDecision,
    sourceAgentSchemaApprovalReferenceOnly: agentWireGate.schemaApprovalReferenceOnly,
    sourceOperatorSchemaApprovalReferenceOnly: operatorWireGate.schemaApprovalReferenceOnly,
    sourceAgentBlockingFindingCodes: [...agentWireGate.sourceBlockingFindingCodes],
    sourceOperatorBlockingFindingCodes: [...operatorWireGate.sourceBlockingFindingCodes],
    agentExplicitUserApprovalProvided,
    operatorExplicitUserApprovalProvided,
    schemaMigrationReadinessConfirmed,
    agentWriteAdapterImplementedConfirmed,
    operatorWriteAdapterImplementedConfirmed,
    operatorPermissionModelConfirmed,
    operatorAuditTrailConfirmed,
    candidateChecklist,
    safetyChecklist,
    rollbackChecklist,
    verifiesCandidateOnly: true,
    wiresWritePathInThisStep: false,
    wiresAdapterInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    changesRuntimeRouteInThisStep: false,
    findings,
  };
}

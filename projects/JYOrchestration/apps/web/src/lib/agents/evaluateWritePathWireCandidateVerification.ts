/**
 * Evaluate Agent / Operator write path wire candidate verification (read-only; no wire/adapter/DB/Prisma/schema/migration).
 */

import { evaluateAgentExecutionRecordWritePathWireApprovalGate } from "@/lib/agents/evaluateAgentExecutionRecordWritePathWireApprovalGate";
import { normalizeAgentExecutionRecordWritePathTarget } from "@/lib/agents/evaluateAgentExecutionRecordWritePathDesign";
import { evaluateOperatorApprovalAuditWritePathWireApprovalGate } from "@/lib/agents/evaluateOperatorApprovalAuditWritePathWireApprovalGate";
import {
  normalizeOperatorApprovalAuditWritePathTarget,
} from "@/lib/agents/evaluateOperatorApprovalAuditWritePathDesign";
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

function buildChecklistFromReasons(
  items: readonly { readonly item: string; readonly satisfied: boolean; readonly reason: string }[],
): WritePathWireCandidateVerificationChecklistItem[] {
  return items.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: entry.reason,
  }));
}

function buildCandidateChecklist(input: {
  readonly agentWireGateReady: boolean;
  readonly operatorWireGateReady: boolean;
  readonly agentWireGateDecision: string;
  readonly operatorWireGateDecision: string;
  readonly schemaMigrationReadinessReady: boolean;
  readonly schemaMigrationReadinessDecision: string;
  readonly schemaMigrationReadinessConfirmed: boolean;
  readonly normalizedAgentTarget: string;
  readonly normalizedOperatorTarget: string;
  readonly sourceAgentFeatureFlagName: string;
  readonly sourceOperatorFeatureFlagName: string;
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
  return buildChecklistFromReasons(
    CANDIDATE_CHECKLIST_ITEMS.map((item) => {
      switch (item) {
        case "agent wire gate ready":
          return {
            item,
            satisfied: input.agentWireGateReady,
            reason: `agent wire gate decision=${input.agentWireGateDecision}; target=${input.normalizedAgentTarget}`,
          };
        case "operator wire gate ready":
          return {
            item,
            satisfied: input.operatorWireGateReady,
            reason: `operator wire gate decision=${input.operatorWireGateDecision}; target=${input.normalizedOperatorTarget}`,
          };
        case "schema migration readiness ready":
          return {
            item,
            satisfied: input.schemaMigrationReadinessReady,
            reason: `schema migration readiness decision=${input.schemaMigrationReadinessDecision}`,
          };
        case "schema migration readiness confirmed":
          return {
            item,
            satisfied: input.schemaMigrationReadinessConfirmed,
            reason: `operator confirmed Stage 2-C readiness review=${input.schemaMigrationReadinessConfirmed}`,
          };
        case "agent explicit user approval provided":
          return {
            item,
            satisfied: input.agentExplicitUserApprovalProvided,
            reason: `agent explicit user approval=${input.agentExplicitUserApprovalProvided}`,
          };
        case "operator explicit user approval provided":
          return {
            item,
            satisfied: input.operatorExplicitUserApprovalProvided,
            reason: `operator explicit user approval=${input.operatorExplicitUserApprovalProvided}`,
          };
        case "agent schema applied confirmed":
          return {
            item,
            satisfied: input.agentSchemaAppliedConfirmed,
            reason: `agent schema applied confirmation flag=${input.agentSchemaAppliedConfirmed} (report input only)`,
          };
        case "operator schema applied confirmed":
          return {
            item,
            satisfied: input.operatorSchemaAppliedConfirmed,
            reason: `operator schema applied confirmation flag=${input.operatorSchemaAppliedConfirmed} (report input only)`,
          };
        case "agent migration applied confirmed":
          return {
            item,
            satisfied: input.agentMigrationAppliedConfirmed,
            reason: `agent migration applied confirmation flag=${input.agentMigrationAppliedConfirmed} (report input only)`,
          };
        case "operator migration applied confirmed":
          return {
            item,
            satisfied: input.operatorMigrationAppliedConfirmed,
            reason: `operator migration applied confirmation flag=${input.operatorMigrationAppliedConfirmed} (report input only)`,
          };
        case "agent feature flag wire approved":
          return {
            item,
            satisfied: input.agentFeatureFlagWireApproved,
            reason: `agent feature flag=${input.sourceAgentFeatureFlagName}; approved=${input.agentFeatureFlagWireApproved}`,
          };
        case "operator feature flag wire approved":
          return {
            item,
            satisfied: input.operatorFeatureFlagWireApproved,
            reason: `operator feature flag=${input.sourceOperatorFeatureFlagName}; approved=${input.operatorFeatureFlagWireApproved}`,
          };
        case "agent write adapter implemented confirmed":
          return {
            item,
            satisfied: input.agentWriteAdapterImplementedConfirmed,
            reason: `agent write adapter implemented confirmed=${input.agentWriteAdapterImplementedConfirmed}`,
          };
        case "operator write adapter implemented confirmed":
          return {
            item,
            satisfied: input.operatorWriteAdapterImplementedConfirmed,
            reason: `operator write adapter implemented confirmed=${input.operatorWriteAdapterImplementedConfirmed}`,
          };
        case "operator permission model confirmed":
          return {
            item,
            satisfied: input.operatorPermissionModelConfirmed,
            reason: `operator permission model confirmed=${input.operatorPermissionModelConfirmed}`,
          };
        case "operator audit trail confirmed":
          return {
            item,
            satisfied: input.operatorAuditTrailConfirmed,
            reason: `operator audit trail confirmed=${input.operatorAuditTrailConfirmed}`,
          };
        default:
          return { item, satisfied: false, reason: `${item} not evaluated` };
      }
    }),
  );
}

function buildSafetyChecklist(): WritePathWireCandidateVerificationChecklistItem[] {
  return buildChecklistFromReasons(
    SAFETY_CHECKLIST_ITEMS.map((item) => {
      let reason = "read-only candidate verification only";
      if (item === "no write path wire in this step") {
        reason = "read-only candidate verification only; write path is not wired";
      } else if (item === "no adapter wire in this step") {
        reason = "read-only candidate verification only; write adapter is not wired";
      } else if (item === "no DB write in this step") {
        reason = "read-only candidate verification only; DB write is not performed";
      } else if (item === "no Prisma call in this step") {
        reason = "read-only candidate verification only; Prisma client is not called";
      } else if (item === "no schema change in this step") {
        reason = "read-only candidate verification only; schema.prisma is not modified";
      } else if (item === "no migration in this step") {
        reason = "read-only candidate verification only; migration is not created";
      } else if (item === "no feature flag wire in this step") {
        reason = "read-only candidate verification only; feature flag is not wired";
      } else if (item === "no runtime route change in this step") {
        reason = "read-only candidate verification only; runtime route is not changed";
      } else if (item === "existing execution path preserved") {
        reason = "existing Stage1/runtime execution path is preserved";
      } else if (item === "wire candidate verification only") {
        reason = "wire candidate verification report only; no actual wire";
      }
      return { item, satisfied: true, reason };
    }),
  );
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
  return buildChecklistFromReasons(
    ROLLBACK_CHECKLIST_ITEMS.map((item) => {
      switch (item) {
        case "agent rollback plan reviewed":
          return {
            item,
            satisfied: input.agentRollbackReviewed,
            reason: `agent rollback plan reviewed=${input.agentRollbackReviewed}`,
          };
        case "operator rollback plan reviewed":
          return {
            item,
            satisfied: input.operatorRollbackReviewed,
            reason: `operator rollback plan reviewed=${input.operatorRollbackReviewed}`,
          };
        case "schema rollback reviewed":
          return {
            item,
            satisfied: input.schemaRollbackReviewed,
            reason: `schema rollback reviewed=${input.schemaRollbackReviewed}`,
          };
        case "migration rollback reviewed":
          return {
            item,
            satisfied: input.migrationRollbackReviewed,
            reason: `migration rollback reviewed=${input.migrationRollbackReviewed}`,
          };
        case "feature flag rollback reviewed":
          return {
            item,
            satisfied: input.featureFlagRollbackReviewed,
            reason: `feature flag rollback reviewed=${input.featureFlagRollbackReviewed}`,
          };
        case "operator approval required before actual wire":
          return {
            item,
            satisfied: input.operatorApprovalRequired,
            reason: "operator approval is required before any actual write path wire",
          };
        case "audit trail impact reviewed before actual wire":
          return {
            item,
            satisfied: input.auditTrailImpactReviewed,
            reason: `audit trail impact reviewed=${input.auditTrailImpactReviewed}`,
          };
        default:
          return { item, satisfied: false, reason: `${item} not evaluated` };
      }
    }),
  );
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

  if (schemaMigrationReadinessConfirmed) {
    findings.push(
      finding(
        "info",
        "schema_migration_readiness_review_confirmed",
        "operator confirmed Stage 2-C schema/migration PR readiness review",
      ),
    );
  }

  findings.push(
    finding("info", "schema_not_applied_in_runtime", "schema is not applied in runtime by this report"),
  );
  findings.push(
    finding("info", "migration_not_applied_in_runtime", "migration is not applied in runtime by this report"),
  );

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
  findings.push(
    finding(
      "info",
      "wire_candidate_requires_final_runtime_approval",
      "wire candidate is ready for review only; final runtime approval is required before actual wire",
    ),
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
  const requestedAgentTarget = input?.agentTarget ?? "agent_execution_record";
  const requestedOperatorTarget = input?.operatorTarget ?? "operator_approval";
  const normalizedAgentTarget = normalizeAgentExecutionRecordWritePathTarget(requestedAgentTarget);
  const normalizedOperatorTarget = normalizeOperatorApprovalAuditWritePathTarget(requestedOperatorTarget);

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
  const schemaMigrationReadinessReviewConfirmed = input?.schemaMigrationReadinessConfirmed === true;

  const agentWireGate = evaluateAgentExecutionRecordWritePathWireApprovalGate({
    target: normalizedAgentTarget,
    explicitUserApproval: input?.agentExplicitUserApproval,
    schemaAppliedConfirmed: input?.agentSchemaAppliedConfirmed,
    migrationAppliedConfirmed: input?.agentMigrationAppliedConfirmed,
    featureFlagWireApproved: input?.agentFeatureFlagWireApproved,
    writeAdapterImplementedConfirmed: input?.agentWriteAdapterImplementedConfirmed,
  });

  const operatorWireGate = evaluateOperatorApprovalAuditWritePathWireApprovalGate({
    target: normalizedOperatorTarget,
    explicitUserApproval: input?.operatorExplicitUserApproval,
    schemaAppliedConfirmed: input?.operatorSchemaAppliedConfirmed,
    migrationAppliedConfirmed: input?.operatorMigrationAppliedConfirmed,
    featureFlagWireApproved: input?.operatorFeatureFlagWireApproved,
    writeAdapterImplementedConfirmed: input?.operatorWriteAdapterImplementedConfirmed,
    permissionModelConfirmed: input?.operatorPermissionModelConfirmed,
    auditTrailConfirmed: input?.operatorAuditTrailConfirmed,
  });

  const schemaMigrationReadiness = evaluateSchemaMigrationPrReadinessIntegration({
    agentTarget: normalizedAgentTarget,
    operatorTarget: normalizedOperatorTarget,
    agentExplicitUserApproval: input?.agentExplicitUserApproval,
    operatorExplicitUserApproval: input?.operatorExplicitUserApproval,
    writeAdapterIntegrationConfirmed: schemaMigrationReadinessReviewConfirmed,
  });

  const decision = resolveVerificationDecision({
    agentWireGateDecision: agentWireGate.decision,
    operatorWireGateDecision: operatorWireGate.decision,
    schemaMigrationReadinessDecision: schemaMigrationReadiness.decision,
    schemaMigrationReadinessConfirmed: schemaMigrationReadinessReviewConfirmed,
  });

  const agentWireGateReady = agentWireGate.decision === WIRE_GATE_READY_DECISION;
  const operatorWireGateReady = operatorWireGate.decision === WIRE_GATE_READY_DECISION;
  const schemaMigrationReadinessReady =
    schemaMigrationReadiness.decision === SCHEMA_MIGRATION_READY_DECISION;

  const candidateChecklist = buildCandidateChecklist({
    agentWireGateReady,
    operatorWireGateReady,
    agentWireGateDecision: agentWireGate.decision,
    operatorWireGateDecision: operatorWireGate.decision,
    schemaMigrationReadinessReady,
    schemaMigrationReadinessDecision: schemaMigrationReadiness.decision,
    schemaMigrationReadinessConfirmed: schemaMigrationReadinessReviewConfirmed,
    normalizedAgentTarget,
    normalizedOperatorTarget,
    sourceAgentFeatureFlagName: agentWireGate.sourceWritePathFeatureFlagName,
    sourceOperatorFeatureFlagName: operatorWireGate.sourceWritePathFeatureFlagName,
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
    schemaMigrationReadinessConfirmed: schemaMigrationReadinessReviewConfirmed,
  });

  return {
    mode: "read_only_write_path_wire_candidate_verification",
    decision,
    requestedAgentTarget,
    requestedOperatorTarget,
    normalizedAgentTarget,
    normalizedOperatorTarget,
    sourceAgentWireGateDecision: agentWireGate.decision,
    sourceOperatorWireGateDecision: operatorWireGate.decision,
    sourceSchemaMigrationReadinessDecision: schemaMigrationReadiness.decision,
    sourceSchemaMigrationRequestedAgentTarget: schemaMigrationReadiness.requestedAgentTarget,
    sourceSchemaMigrationRequestedOperatorTarget: schemaMigrationReadiness.requestedOperatorTarget,
    sourceSchemaMigrationNormalizedAgentTarget: schemaMigrationReadiness.normalizedAgentTarget,
    sourceSchemaMigrationNormalizedOperatorTarget: schemaMigrationReadiness.normalizedOperatorTarget,
    sourceSchemaMigrationAgentSchemaDecision: schemaMigrationReadiness.sourceAgentSchemaPrReadinessDecision,
    sourceSchemaMigrationOperatorSchemaDecision:
      schemaMigrationReadiness.sourceOperatorSchemaPrReadinessDecision,
    sourceSchemaMigrationWriteAdapterDecision: schemaMigrationReadiness.sourceWriteAdapterIntegrationDecision,
    sourceSchemaMigrationAgentRequiresSchemaChange: schemaMigrationReadiness.sourceAgentRequiresSchemaChange,
    sourceSchemaMigrationOperatorRequiresSchemaChange:
      schemaMigrationReadiness.sourceOperatorRequiresSchemaChange,
    sourceSchemaMigrationAgentRequiresMigration: schemaMigrationReadiness.sourceAgentRequiresMigration,
    sourceSchemaMigrationOperatorRequiresMigration:
      schemaMigrationReadiness.sourceOperatorRequiresMigration,
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
    sourceAgentWireGateBlockingFindingCodes: [...agentWireGate.sourceBlockingFindingCodes],
    sourceOperatorWireGateBlockingFindingCodes: [...operatorWireGate.sourceBlockingFindingCodes],
    sourceAgentWireGateApprovalChecklistCount: agentWireGate.approvalChecklist.length,
    sourceOperatorWireGateApprovalChecklistCount: operatorWireGate.approvalChecklist.length,
    sourceAgentWireGateRuntimeChecklistCount: agentWireGate.runtimeChecklist.length,
    sourceOperatorWireGateRuntimeChecklistCount: operatorWireGate.runtimeChecklist.length,
    sourceOperatorWireGatePermissionChecklistCount: operatorWireGate.permissionChecklist.length,
    sourceOperatorWireGateAuditChecklistCount: operatorWireGate.auditChecklist.length,
    agentExplicitUserApprovalProvided,
    operatorExplicitUserApprovalProvided,
    schemaMigrationReadinessConfirmed: schemaMigrationReadinessReviewConfirmed,
    schemaMigrationReadinessReviewConfirmed,
    schemaAppliedInRuntime: false,
    migrationAppliedInRuntime: false,
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

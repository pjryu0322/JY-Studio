/**
 * Evaluate Agent / Operator schema-migration PR readiness integration (read-only; no schema/migration/DB/PR wire).
 */

import { evaluateAgentExecutionRecordSchemaPrReadiness } from "@/lib/agents/evaluateAgentExecutionRecordSchemaPrReadiness";
import { evaluateOperatorApprovalAuditSchemaPrReadiness } from "@/lib/agents/evaluateOperatorApprovalAuditSchemaPrReadiness";
import { evaluateWriteAdapterDesignIntegration } from "@/lib/agents/evaluateWriteAdapterDesignIntegration";
import type {
  SchemaMigrationPrReadinessIntegrationChecklistItem,
  SchemaMigrationPrReadinessIntegrationDecision,
  SchemaMigrationPrReadinessIntegrationFinding,
  SchemaMigrationPrReadinessIntegrationReport,
} from "@/lib/agents/schemaMigrationPrReadinessIntegrationTypes";

const SCHEMA_PR_READY_DECISION = "ready_for_schema_pr_plan";

const SCHEMA_CHECKLIST_ITEMS = [
  "agent schema readiness ready",
  "operator schema readiness ready",
  "agent model candidate available",
  "operator model candidate available",
  "agent required fields reviewed",
  "operator required fields reviewed",
  "agent forbidden fields reviewed",
  "operator forbidden fields reviewed",
  "write adapter integration reviewed",
] as const;

const MIGRATION_CHECKLIST_ITEMS = [
  "agent migration checklist available",
  "operator migration checklist available",
  "schema change requires separate PR",
  "migration generation requires explicit approval",
  "no migration in this step",
] as const;

const ROLLBACK_CHECKLIST_ITEMS = [
  "agent rollback checklist available",
  "operator rollback checklist available",
  "agent retention policy reviewed",
  "operator retention policy reviewed",
  "rollback requires explicit approval",
] as const;

const SAFETY_CHECKLIST_ITEMS = [
  "schema PR readiness only",
  "no schema change in this step",
  "no migration in this step",
  "no DB write in this step",
  "no Prisma call in this step",
  "no pull request creation in this step",
  "no adapter wire in this step",
  "existing runtime path preserved",
] as const;

function finding(
  severity: SchemaMigrationPrReadinessIntegrationFinding["severity"],
  code: string,
  message: string,
): SchemaMigrationPrReadinessIntegrationFinding {
  return { severity, code, message };
}

function isSchemaPrReady(decision: string): boolean {
  return decision === SCHEMA_PR_READY_DECISION;
}

function resolveIntegrationDecision(input: {
  readonly agentSchemaDecision: string;
  readonly operatorSchemaDecision: string;
  readonly writeAdapterIntegrationDecision: string;
  readonly writeAdapterIntegrationConfirmed: boolean;
}): SchemaMigrationPrReadinessIntegrationDecision {
  if (
    input.agentSchemaDecision === "blocked" ||
    input.operatorSchemaDecision === "blocked" ||
    input.writeAdapterIntegrationDecision === "blocked"
  ) {
    return "blocked";
  }

  if (!isSchemaPrReady(input.agentSchemaDecision) || !isSchemaPrReady(input.operatorSchemaDecision)) {
    return "defer";
  }

  if (!input.writeAdapterIntegrationConfirmed) {
    return "defer";
  }

  return "ready_for_schema_migration_pr_readiness";
}

function buildChecklist(
  items: readonly string[],
  satisfaction: Record<string, boolean>,
): SchemaMigrationPrReadinessIntegrationChecklistItem[] {
  return items.map((item) => ({
    item,
    satisfied: satisfaction[item] ?? false,
    reason: (satisfaction[item] ?? false)
      ? `${item} satisfied`
      : `${item} not satisfied`,
  }));
}

function buildSchemaChecklist(input: {
  readonly agentSchemaReady: boolean;
  readonly operatorSchemaReady: boolean;
  readonly agentModelCandidateCount: number;
  readonly operatorModelCandidateCount: number;
  readonly agentRequiredFieldCount: number;
  readonly operatorRequiredFieldCount: number;
  readonly agentForbiddenFieldChecklistCount: number;
  readonly operatorForbiddenFieldChecklistCount: number;
  readonly writeAdapterIntegrationReviewed: boolean;
}): SchemaMigrationPrReadinessIntegrationChecklistItem[] {
  return buildChecklist(SCHEMA_CHECKLIST_ITEMS, {
    "agent schema readiness ready": input.agentSchemaReady,
    "operator schema readiness ready": input.operatorSchemaReady,
    "agent model candidate available": input.agentModelCandidateCount > 0,
    "operator model candidate available": input.operatorModelCandidateCount > 0,
    "agent required fields reviewed": input.agentRequiredFieldCount > 0,
    "operator required fields reviewed": input.operatorRequiredFieldCount > 0,
    "agent forbidden fields reviewed": input.agentForbiddenFieldChecklistCount > 0,
    "operator forbidden fields reviewed": input.operatorForbiddenFieldChecklistCount > 0,
    "write adapter integration reviewed": input.writeAdapterIntegrationReviewed,
  });
}

function buildMigrationChecklist(input: {
  readonly agentMigrationChecklistCount: number;
  readonly operatorMigrationChecklistCount: number;
  readonly agentRequiresSeparatePr: boolean;
  readonly operatorRequiresSeparatePr: boolean;
}): SchemaMigrationPrReadinessIntegrationChecklistItem[] {
  return buildChecklist(MIGRATION_CHECKLIST_ITEMS, {
    "agent migration checklist available": input.agentMigrationChecklistCount > 0,
    "operator migration checklist available": input.operatorMigrationChecklistCount > 0,
    "schema change requires separate PR":
      input.agentRequiresSeparatePr && input.operatorRequiresSeparatePr,
    "migration generation requires explicit approval": true,
    "no migration in this step": true,
  });
}

function buildRollbackChecklist(input: {
  readonly agentRollbackChecklistCount: number;
  readonly operatorRollbackChecklistCount: number;
  readonly agentRetentionChecklistCount: number;
  readonly operatorRetentionChecklistCount: number;
}): SchemaMigrationPrReadinessIntegrationChecklistItem[] {
  return buildChecklist(ROLLBACK_CHECKLIST_ITEMS, {
    "agent rollback checklist available": input.agentRollbackChecklistCount > 0,
    "operator rollback checklist available": input.operatorRollbackChecklistCount > 0,
    "agent retention policy reviewed": input.agentRetentionChecklistCount > 0,
    "operator retention policy reviewed": input.operatorRetentionChecklistCount > 0,
    "rollback requires explicit approval": true,
  });
}

function buildSafetyChecklist(): SchemaMigrationPrReadinessIntegrationChecklistItem[] {
  return buildChecklist(SAFETY_CHECKLIST_ITEMS, {
    "schema PR readiness only": true,
    "no schema change in this step": true,
    "no migration in this step": true,
    "no DB write in this step": true,
    "no Prisma call in this step": true,
    "no pull request creation in this step": true,
    "no adapter wire in this step": true,
    "existing runtime path preserved": true,
  });
}

function appendIntegrationFindings(input: {
  readonly findings: SchemaMigrationPrReadinessIntegrationFinding[];
  readonly decision: SchemaMigrationPrReadinessIntegrationDecision;
  readonly agentSchemaDecision: string;
  readonly operatorSchemaDecision: string;
  readonly writeAdapterIntegrationDecision: string;
  readonly writeAdapterIntegrationConfirmed: boolean;
}): void {
  const {
    findings,
    decision,
    agentSchemaDecision,
    operatorSchemaDecision,
    writeAdapterIntegrationDecision,
    writeAdapterIntegrationConfirmed,
  } = input;

  findings.push(
    finding(
      "info",
      "schema_migration_pr_readiness_integration_read_only",
      "schema migration PR readiness integration is read-only; no schema/migration/PR wire",
    ),
  );
  findings.push(finding("info", "no_schema_change_in_this_step", "schema.prisma is not modified in this step"));
  findings.push(finding("info", "no_migration_in_this_step", "migration is not created in this step"));
  findings.push(finding("info", "no_db_write_in_this_step", "DB write is not performed in this step"));
  findings.push(finding("info", "no_prisma_call_in_this_step", "Prisma client is not called in this step"));

  if (decision === "blocked") {
    if (agentSchemaDecision === "blocked") {
      findings.push(finding("blocking", "agent_schema_pr_readiness_blocked", "agent schema PR readiness is blocked"));
    }
    if (operatorSchemaDecision === "blocked") {
      findings.push(
        finding("blocking", "operator_schema_pr_readiness_blocked", "operator schema PR readiness is blocked"),
      );
    }
    if (writeAdapterIntegrationDecision === "blocked") {
      findings.push(
        finding("blocking", "write_adapter_integration_blocked", "write adapter design integration is blocked"),
      );
    }
    findings.push(
      finding("blocking", "schema_migration_pr_readiness_blocked", "schema migration PR readiness is blocked"),
    );
    return;
  }

  if (decision === "defer") {
    if (!isSchemaPrReady(agentSchemaDecision)) {
      findings.push(
        finding("warning", "agent_schema_pr_readiness_deferred", "agent schema PR readiness is deferred"),
      );
    }
    if (!isSchemaPrReady(operatorSchemaDecision)) {
      findings.push(
        finding("warning", "operator_schema_pr_readiness_deferred", "operator schema PR readiness is deferred"),
      );
    }
    if (!writeAdapterIntegrationConfirmed) {
      findings.push(
        finding("warning", "write_adapter_integration_not_confirmed", "write adapter integration is not confirmed"),
      );
    }
    findings.push(
      finding(
        "warning",
        "schema_migration_pr_readiness_deferred",
        "schema migration PR readiness defers until prerequisites are met",
      ),
    );
    return;
  }

  findings.push(finding("info", "agent_schema_pr_readiness_ready", "agent schema PR readiness is ready"));
  findings.push(finding("info", "operator_schema_pr_readiness_ready", "operator schema PR readiness is ready"));
  findings.push(finding("info", "write_adapter_integration_reviewed", "write adapter integration is reviewed"));
  findings.push(
    finding("info", "schema_migration_pr_readiness_ready", "schema migration PR readiness integration is ready"),
  );
}

/** Read-only schema-migration PR readiness integration — does not modify schema, create migrations, or open PRs. */
export function evaluateSchemaMigrationPrReadinessIntegration(input?: {
  readonly agentTarget?: string;
  readonly operatorTarget?: string;
  readonly agentExplicitUserApproval?: boolean;
  readonly operatorExplicitUserApproval?: boolean;
  readonly writeAdapterIntegrationConfirmed?: boolean;
}): SchemaMigrationPrReadinessIntegrationReport {
  const agentTarget = input?.agentTarget ?? "agent_execution_record";
  const operatorTarget = input?.operatorTarget ?? "operator_approval";
  const writeAdapterIntegrationConfirmed = input?.writeAdapterIntegrationConfirmed === true;

  const agentSchemaReadiness = evaluateAgentExecutionRecordSchemaPrReadiness({ target: agentTarget });
  const operatorSchemaReadiness = evaluateOperatorApprovalAuditSchemaPrReadiness({ target: operatorTarget });

  const writeAdapterIntegration = evaluateWriteAdapterDesignIntegration({
    agentTarget,
    operatorTarget,
    agentExplicitUserApproval: input?.agentExplicitUserApproval,
    operatorExplicitUserApproval: input?.operatorExplicitUserApproval,
  });

  const decision = resolveIntegrationDecision({
    agentSchemaDecision: agentSchemaReadiness.decision,
    operatorSchemaDecision: operatorSchemaReadiness.decision,
    writeAdapterIntegrationDecision: writeAdapterIntegration.decision,
    writeAdapterIntegrationConfirmed,
  });

  const agentSchemaReady = isSchemaPrReady(agentSchemaReadiness.decision);
  const operatorSchemaReady = isSchemaPrReady(operatorSchemaReadiness.decision);

  const operatorProposedTableNames = operatorSchemaReadiness.modelCandidates.map(
    (candidate) => candidate.modelName,
  );

  const schemaChecklist = buildSchemaChecklist({
    agentSchemaReady,
    operatorSchemaReady,
    agentModelCandidateCount: agentSchemaReadiness.modelCandidates.length,
    operatorModelCandidateCount: operatorSchemaReadiness.modelCandidates.length,
    agentRequiredFieldCount: agentSchemaReadiness.sourceFieldProposalCount,
    operatorRequiredFieldCount: operatorSchemaReadiness.sourceFieldProposalCount,
    agentForbiddenFieldChecklistCount: agentSchemaReadiness.forbiddenFieldChecklist.length,
    operatorForbiddenFieldChecklistCount: operatorSchemaReadiness.forbiddenFieldChecklist.length,
    writeAdapterIntegrationReviewed: writeAdapterIntegrationConfirmed,
  });

  const migrationChecklist = buildMigrationChecklist({
    agentMigrationChecklistCount: agentSchemaReadiness.migrationChecklist.length,
    operatorMigrationChecklistCount: operatorSchemaReadiness.migrationChecklist.length,
    agentRequiresSeparatePr: agentSchemaReadiness.requiresSeparatePr,
    operatorRequiresSeparatePr: operatorSchemaReadiness.requiresSeparatePr,
  });

  const rollbackChecklist = buildRollbackChecklist({
    agentRollbackChecklistCount: agentSchemaReadiness.rollbackChecklist.length,
    operatorRollbackChecklistCount: operatorSchemaReadiness.rollbackChecklist.length,
    agentRetentionChecklistCount: agentSchemaReadiness.retentionAccessChecklist.length,
    operatorRetentionChecklistCount: operatorSchemaReadiness.permissionAccessChecklist.length,
  });

  const safetyChecklist = buildSafetyChecklist();

  const findings: SchemaMigrationPrReadinessIntegrationFinding[] = [];
  appendIntegrationFindings({
    findings,
    decision,
    agentSchemaDecision: agentSchemaReadiness.decision,
    operatorSchemaDecision: operatorSchemaReadiness.decision,
    writeAdapterIntegrationDecision: writeAdapterIntegration.decision,
    writeAdapterIntegrationConfirmed,
  });

  return {
    mode: "read_only_schema_migration_pr_readiness_integration",
    decision,
    sourceAgentSchemaPrReadinessDecision: agentSchemaReadiness.decision,
    sourceOperatorSchemaPrReadinessDecision: operatorSchemaReadiness.decision,
    sourceWriteAdapterIntegrationDecision: writeAdapterIntegration.decision,
    agentProposedTableName: agentSchemaReadiness.sourceProposedTableName,
    operatorProposedTableNames,
    agentModelCandidateCount: agentSchemaReadiness.modelCandidates.length,
    operatorModelCandidateCount: operatorSchemaReadiness.modelCandidates.length,
    agentRequiredFieldCount: agentSchemaReadiness.sourceFieldProposalCount,
    operatorRequiredFieldCount: operatorSchemaReadiness.sourceFieldProposalCount,
    agentForbiddenFieldChecklistCount: agentSchemaReadiness.forbiddenFieldChecklist.length,
    operatorForbiddenFieldChecklistCount: operatorSchemaReadiness.forbiddenFieldChecklist.length,
    agentMigrationChecklistCount: agentSchemaReadiness.migrationChecklist.length,
    operatorMigrationChecklistCount: operatorSchemaReadiness.migrationChecklist.length,
    agentRollbackChecklistCount: agentSchemaReadiness.rollbackChecklist.length,
    operatorRollbackChecklistCount: operatorSchemaReadiness.rollbackChecklist.length,
    agentRetentionChecklistCount: agentSchemaReadiness.retentionAccessChecklist.length,
    operatorRetentionChecklistCount: operatorSchemaReadiness.permissionAccessChecklist.length,
    schemaChecklist,
    migrationChecklist,
    rollbackChecklist,
    safetyChecklist,
    plansSchemaPrOnly: true,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    createsPullRequestInThisStep: false,
    wiresAdapterInThisStep: false,
    findings,
  };
}

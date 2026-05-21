/**
 * Evaluate Agent / Operator schema-migration PR readiness integration (read-only; no schema/migration/DB/PR wire).
 */

import { evaluateAgentExecutionRecordSchemaPrReadiness } from "@/lib/agents/evaluateAgentExecutionRecordSchemaPrReadiness";
import { normalizeAgentExecutionRecordSchemaTarget } from "@/lib/agents/evaluateAgentExecutionRecordSchemaDecision";
import {
  evaluateOperatorApprovalAuditSchemaPrReadiness,
} from "@/lib/agents/evaluateOperatorApprovalAuditSchemaPrReadiness";
import { normalizeOperatorApprovalAuditSchemaTarget } from "@/lib/agents/evaluateOperatorApprovalAuditSchemaDecision";
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
  readonly normalizedAgentTarget: string;
  readonly normalizedOperatorTarget: string;
  readonly agentSchemaDecision: string;
  readonly operatorSchemaDecision: string;
  readonly writeAdapterIntegrationDecision: string;
  readonly writeAdapterIntegrationConfirmed: boolean;
}): SchemaMigrationPrReadinessIntegrationDecision {
  if (input.normalizedAgentTarget === "unknown" || input.normalizedOperatorTarget === "unknown") {
    return "blocked";
  }

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

function buildChecklistFromReasons(
  items: readonly { readonly item: string; readonly satisfied: boolean; readonly reason: string }[],
): SchemaMigrationPrReadinessIntegrationChecklistItem[] {
  return items.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: entry.reason,
  }));
}

function buildSchemaChecklist(input: {
  readonly agentSchemaReady: boolean;
  readonly operatorSchemaReady: boolean;
  readonly agentSchemaDecision: string;
  readonly operatorSchemaDecision: string;
  readonly agentModelCandidateCount: number;
  readonly operatorModelCandidateCount: number;
  readonly agentRequiredFieldCount: number;
  readonly operatorRequiredFieldCount: number;
  readonly agentForbiddenFieldChecklistCount: number;
  readonly operatorForbiddenFieldChecklistCount: number;
  readonly writeAdapterIntegrationReviewed: boolean;
  readonly writeAdapterIntegrationDecision: string;
}): SchemaMigrationPrReadinessIntegrationChecklistItem[] {
  return buildChecklistFromReasons(
    SCHEMA_CHECKLIST_ITEMS.map((item) => {
      switch (item) {
        case "agent schema readiness ready":
          return {
            item,
            satisfied: input.agentSchemaReady,
            reason: input.agentSchemaReady
              ? `agent schema decision=${input.agentSchemaDecision}`
              : `agent schema decision=${input.agentSchemaDecision}; not ready_for_schema_pr_plan`,
          };
        case "operator schema readiness ready":
          return {
            item,
            satisfied: input.operatorSchemaReady,
            reason: input.operatorSchemaReady
              ? `operator schema decision=${input.operatorSchemaDecision}`
              : `operator schema decision=${input.operatorSchemaDecision}; not ready_for_schema_pr_plan`,
          };
        case "agent model candidate available":
          return {
            item,
            satisfied: input.agentModelCandidateCount > 0,
            reason: `agent model candidate count=${input.agentModelCandidateCount}`,
          };
        case "operator model candidate available":
          return {
            item,
            satisfied: input.operatorModelCandidateCount > 0,
            reason: `operator model candidate count=${input.operatorModelCandidateCount}`,
          };
        case "agent required fields reviewed":
          return {
            item,
            satisfied: input.agentRequiredFieldCount > 0,
            reason: `agent required field count=${input.agentRequiredFieldCount}`,
          };
        case "operator required fields reviewed":
          return {
            item,
            satisfied: input.operatorRequiredFieldCount > 0,
            reason: `operator required field count=${input.operatorRequiredFieldCount}`,
          };
        case "agent forbidden fields reviewed":
          return {
            item,
            satisfied: input.agentForbiddenFieldChecklistCount > 0,
            reason: `agent forbidden field checklist count=${input.agentForbiddenFieldChecklistCount}`,
          };
        case "operator forbidden fields reviewed":
          return {
            item,
            satisfied: input.operatorForbiddenFieldChecklistCount > 0,
            reason: `operator forbidden field checklist count=${input.operatorForbiddenFieldChecklistCount}`,
          };
        case "write adapter integration reviewed":
          return {
            item,
            satisfied: input.writeAdapterIntegrationReviewed,
            reason: input.writeAdapterIntegrationReviewed
              ? `write adapter integration confirmed; source decision=${input.writeAdapterIntegrationDecision}`
              : `write adapter integration not confirmed; source decision=${input.writeAdapterIntegrationDecision}`,
          };
        default:
          return { item, satisfied: false, reason: `${item} not evaluated` };
      }
    }),
  );
}

function buildMigrationChecklist(input: {
  readonly agentMigrationChecklistCount: number;
  readonly operatorMigrationChecklistCount: number;
  readonly agentRequiresSeparatePr: boolean;
  readonly operatorRequiresSeparatePr: boolean;
}): SchemaMigrationPrReadinessIntegrationChecklistItem[] {
  return buildChecklistFromReasons(
    MIGRATION_CHECKLIST_ITEMS.map((item) => {
      switch (item) {
        case "agent migration checklist available":
          return {
            item,
            satisfied: input.agentMigrationChecklistCount > 0,
            reason: `agent migration checklist count=${input.agentMigrationChecklistCount}`,
          };
        case "operator migration checklist available":
          return {
            item,
            satisfied: input.operatorMigrationChecklistCount > 0,
            reason: `operator migration checklist count=${input.operatorMigrationChecklistCount}`,
          };
        case "schema change requires separate PR":
          return {
            item,
            satisfied: input.agentRequiresSeparatePr && input.operatorRequiresSeparatePr,
            reason: `agent separate PR=${input.agentRequiresSeparatePr}; operator separate PR=${input.operatorRequiresSeparatePr}`,
          };
        case "migration generation requires explicit approval":
          return {
            item,
            satisfied: true,
            reason: "migration generation requires explicit operator approval before apply",
          };
        case "no migration in this step":
          return {
            item,
            satisfied: true,
            reason: "read-only readiness report only; migration is not created in this step",
          };
        default:
          return { item, satisfied: false, reason: `${item} not evaluated` };
      }
    }),
  );
}

function buildRollbackChecklist(input: {
  readonly agentRollbackChecklistCount: number;
  readonly operatorRollbackChecklistCount: number;
  readonly agentRetentionChecklistCount: number;
  readonly operatorPermissionChecklistCount: number;
  readonly operatorAuditIntegrityChecklistCount: number;
}): SchemaMigrationPrReadinessIntegrationChecklistItem[] {
  return buildChecklistFromReasons(
    ROLLBACK_CHECKLIST_ITEMS.map((item) => {
      switch (item) {
        case "agent rollback checklist available":
          return {
            item,
            satisfied: input.agentRollbackChecklistCount > 0,
            reason: `agent rollback checklist count=${input.agentRollbackChecklistCount}`,
          };
        case "operator rollback checklist available":
          return {
            item,
            satisfied: input.operatorRollbackChecklistCount > 0,
            reason: `operator rollback checklist count=${input.operatorRollbackChecklistCount}`,
          };
        case "agent retention policy reviewed":
          return {
            item,
            satisfied: input.agentRetentionChecklistCount > 0,
            reason: `agent retention checklist count=${input.agentRetentionChecklistCount}`,
          };
        case "operator retention policy reviewed":
          return {
            item,
            satisfied: false,
            reason: `no operator retention checklist; permission count=${input.operatorPermissionChecklistCount}; audit count=${input.operatorAuditIntegrityChecklistCount}`,
          };
        case "rollback requires explicit approval":
          return {
            item,
            satisfied: true,
            reason: "rollback requires explicit approval before schema/migration apply",
          };
        default:
          return { item, satisfied: false, reason: `${item} not evaluated` };
      }
    }),
  );
}

function buildSafetyChecklist(): SchemaMigrationPrReadinessIntegrationChecklistItem[] {
  return buildChecklistFromReasons(
    SAFETY_CHECKLIST_ITEMS.map((item) => {
      const satisfied = true;
      let reason = "read-only readiness report only";
      if (item === "no schema change in this step") {
        reason = "read-only readiness report only; schema.prisma is not modified";
      } else if (item === "no migration in this step") {
        reason = "read-only readiness report only; migration is not created";
      } else if (item === "no DB write in this step") {
        reason = "read-only readiness report only; DB write is not performed";
      } else if (item === "no Prisma call in this step") {
        reason = "read-only readiness report only; Prisma client is not called";
      } else if (item === "no pull request creation in this step") {
        reason = "read-only readiness report only; pull request is not created";
      } else if (item === "no adapter wire in this step") {
        reason = "read-only readiness report only; write adapter is not wired";
      } else if (item === "schema PR readiness only") {
        reason = "schema/migration PR readiness planning only; no runtime wire";
      } else if (item === "existing runtime path preserved") {
        reason = "existing Stage1/runtime execution path is preserved";
      }
      return { item, satisfied, reason };
    }),
  );
}

function appendIntegrationFindings(input: {
  readonly findings: SchemaMigrationPrReadinessIntegrationFinding[];
  readonly decision: SchemaMigrationPrReadinessIntegrationDecision;
  readonly normalizedAgentTarget: string;
  readonly normalizedOperatorTarget: string;
  readonly agentSchemaDecision: string;
  readonly operatorSchemaDecision: string;
  readonly writeAdapterIntegrationDecision: string;
  readonly writeAdapterIntegrationConfirmed: boolean;
}): void {
  const {
    findings,
    decision,
    normalizedAgentTarget,
    normalizedOperatorTarget,
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

  if (normalizedAgentTarget === "unknown") {
    findings.push(
      finding("blocking", "unknown_agent_schema_migration_target", "unknown agent schema migration target is blocked"),
    );
  }
  if (normalizedOperatorTarget === "unknown") {
    findings.push(
      finding(
        "blocking",
        "unknown_operator_schema_migration_target",
        "unknown operator schema migration target is blocked",
      ),
    );
  }

  if (writeAdapterIntegrationDecision === "blocked") {
    findings.push(finding("blocking", "write_adapter_integration_blocked", "write adapter design integration is blocked"));
  } else if (writeAdapterIntegrationDecision === "defer" && writeAdapterIntegrationConfirmed) {
    findings.push(
      finding(
        "warning",
        "write_adapter_integration_deferred_but_confirmed",
        "write adapter integration is deferred but operator confirmed schema/migration PR readiness review",
      ),
    );
  } else if (
    writeAdapterIntegrationDecision === "ready_for_adapter_design" &&
    writeAdapterIntegrationConfirmed
  ) {
    findings.push(
      finding(
        "info",
        "write_adapter_integration_ready_and_confirmed",
        "write adapter integration is ready and operator confirmed schema/migration PR readiness review",
      ),
    );
  }

  if (decision === "blocked") {
    if (agentSchemaDecision === "blocked") {
      findings.push(finding("blocking", "agent_schema_pr_readiness_blocked", "agent schema PR readiness is blocked"));
    }
    if (operatorSchemaDecision === "blocked") {
      findings.push(
        finding("blocking", "operator_schema_pr_readiness_blocked", "operator schema PR readiness is blocked"),
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
  const requestedAgentTarget = input?.agentTarget ?? "agent_execution_record";
  const requestedOperatorTarget = input?.operatorTarget ?? "operator_approval";
  const normalizedAgentTarget = normalizeAgentExecutionRecordSchemaTarget(requestedAgentTarget);
  const normalizedOperatorTarget = normalizeOperatorApprovalAuditSchemaTarget(requestedOperatorTarget);
  const writeAdapterIntegrationConfirmed = input?.writeAdapterIntegrationConfirmed === true;

  const agentSchemaReadiness = evaluateAgentExecutionRecordSchemaPrReadiness({
    target: normalizedAgentTarget,
  });
  const operatorSchemaReadiness = evaluateOperatorApprovalAuditSchemaPrReadiness({
    target: normalizedOperatorTarget,
  });

  const writeAdapterIntegration = evaluateWriteAdapterDesignIntegration({
    agentTarget: normalizedAgentTarget,
    operatorTarget: normalizedOperatorTarget,
    agentExplicitUserApproval: input?.agentExplicitUserApproval,
    operatorExplicitUserApproval: input?.operatorExplicitUserApproval,
  });

  const decision = resolveIntegrationDecision({
    normalizedAgentTarget,
    normalizedOperatorTarget,
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

  const operatorPermissionChecklistCount = operatorSchemaReadiness.permissionAccessChecklist.length;
  const operatorAuditIntegrityChecklistCount = operatorSchemaReadiness.auditIntegrityChecklist.length;

  const schemaChecklist = buildSchemaChecklist({
    agentSchemaReady,
    operatorSchemaReady,
    agentSchemaDecision: agentSchemaReadiness.decision,
    operatorSchemaDecision: operatorSchemaReadiness.decision,
    agentModelCandidateCount: agentSchemaReadiness.modelCandidates.length,
    operatorModelCandidateCount: operatorSchemaReadiness.modelCandidates.length,
    agentRequiredFieldCount: agentSchemaReadiness.sourceFieldProposalCount,
    operatorRequiredFieldCount: operatorSchemaReadiness.sourceFieldProposalCount,
    agentForbiddenFieldChecklistCount: agentSchemaReadiness.forbiddenFieldChecklist.length,
    operatorForbiddenFieldChecklistCount: operatorSchemaReadiness.forbiddenFieldChecklist.length,
    writeAdapterIntegrationReviewed: writeAdapterIntegrationConfirmed,
    writeAdapterIntegrationDecision: writeAdapterIntegration.decision,
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
    operatorPermissionChecklistCount,
    operatorAuditIntegrityChecklistCount,
  });

  const safetyChecklist = buildSafetyChecklist();

  const findings: SchemaMigrationPrReadinessIntegrationFinding[] = [];
  appendIntegrationFindings({
    findings,
    decision,
    normalizedAgentTarget,
    normalizedOperatorTarget,
    agentSchemaDecision: agentSchemaReadiness.decision,
    operatorSchemaDecision: operatorSchemaReadiness.decision,
    writeAdapterIntegrationDecision: writeAdapterIntegration.decision,
    writeAdapterIntegrationConfirmed,
  });

  return {
    mode: "read_only_schema_migration_pr_readiness_integration",
    decision,
    requestedAgentTarget,
    requestedOperatorTarget,
    normalizedAgentTarget,
    normalizedOperatorTarget,
    sourceAgentSchemaPrReadinessDecision: agentSchemaReadiness.decision,
    sourceOperatorSchemaPrReadinessDecision: operatorSchemaReadiness.decision,
    sourceWriteAdapterIntegrationDecision: writeAdapterIntegration.decision,
    sourceAgentSchemaTarget: agentSchemaReadiness.target,
    sourceOperatorSchemaTarget: operatorSchemaReadiness.target,
    sourceAgentRequiresSchemaChange: agentSchemaReadiness.sourceRequiresPrismaSchemaChange,
    sourceOperatorRequiresSchemaChange: operatorSchemaReadiness.sourceRequiresPrismaSchemaChange,
    sourceAgentRequiresMigration: agentSchemaReadiness.sourceRequiresMigration,
    sourceOperatorRequiresMigration: operatorSchemaReadiness.sourceRequiresMigration,
    sourceAgentRequiresSeparatePr: agentSchemaReadiness.requiresSeparatePr,
    sourceOperatorRequiresSeparatePr: operatorSchemaReadiness.requiresSeparatePr,
    sourceWriteAdapterRequestedAgentTarget: writeAdapterIntegration.requestedAgentTarget,
    sourceWriteAdapterRequestedOperatorTarget: writeAdapterIntegration.requestedOperatorTarget,
    sourceWriteAdapterNormalizedAgentTarget: writeAdapterIntegration.normalizedAgentTarget,
    sourceWriteAdapterNormalizedOperatorTarget: writeAdapterIntegration.normalizedOperatorTarget,
    sourceWriteAdapterAgentWireGateDecision: writeAdapterIntegration.sourceAgentWireGateDecision,
    sourceWriteAdapterOperatorWireGateDecision: writeAdapterIntegration.sourceOperatorWireGateDecision,
    sourceWriteAdapterAgentWritePathDecision: writeAdapterIntegration.sourceAgentWritePathDecision,
    sourceWriteAdapterOperatorWritePathDecision: writeAdapterIntegration.sourceOperatorWritePathDecision,
    sourceWriteAdapterAgentBlockingFindingCodes: [...writeAdapterIntegration.sourceAgentBlockingFindingCodes],
    sourceWriteAdapterOperatorBlockingFindingCodes: [
      ...writeAdapterIntegration.sourceOperatorBlockingFindingCodes,
    ],
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
    operatorRetentionChecklistCount: 0,
    operatorPermissionChecklistCount,
    operatorAuditIntegrityChecklistCount,
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

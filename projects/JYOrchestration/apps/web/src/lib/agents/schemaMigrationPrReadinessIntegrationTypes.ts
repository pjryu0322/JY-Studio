/**
 * Read-only Agent / Operator schema-migration PR readiness integration (no schema/migration/DB/PR wire).
 */

export type SchemaMigrationPrReadinessIntegrationDecision =
  | "ready_for_schema_migration_pr_readiness"
  | "defer"
  | "blocked";

export interface SchemaMigrationPrReadinessIntegrationChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface SchemaMigrationPrReadinessIntegrationFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface SchemaMigrationPrReadinessIntegrationReport {
  readonly mode: "read_only_schema_migration_pr_readiness_integration";
  readonly decision: SchemaMigrationPrReadinessIntegrationDecision;

  readonly requestedAgentTarget: string;
  readonly requestedOperatorTarget: string;
  readonly normalizedAgentTarget: string;
  readonly normalizedOperatorTarget: string;

  readonly sourceAgentSchemaPrReadinessDecision: string;
  readonly sourceOperatorSchemaPrReadinessDecision: string;
  readonly sourceWriteAdapterIntegrationDecision: string;

  readonly sourceAgentSchemaTarget: string;
  readonly sourceOperatorSchemaTarget: string;
  readonly sourceAgentRequiresSchemaChange: boolean;
  readonly sourceOperatorRequiresSchemaChange: boolean;
  readonly sourceAgentRequiresMigration: boolean;
  readonly sourceOperatorRequiresMigration: boolean;
  readonly sourceAgentRequiresSeparatePr: boolean;
  readonly sourceOperatorRequiresSeparatePr: boolean;

  readonly sourceWriteAdapterRequestedAgentTarget: string;
  readonly sourceWriteAdapterRequestedOperatorTarget: string;
  readonly sourceWriteAdapterNormalizedAgentTarget: string;
  readonly sourceWriteAdapterNormalizedOperatorTarget: string;
  readonly sourceWriteAdapterAgentWireGateDecision: string;
  readonly sourceWriteAdapterOperatorWireGateDecision: string;
  readonly sourceWriteAdapterAgentWritePathDecision: string;
  readonly sourceWriteAdapterOperatorWritePathDecision: string;
  readonly sourceWriteAdapterAgentBlockingFindingCodes: readonly string[];
  readonly sourceWriteAdapterOperatorBlockingFindingCodes: readonly string[];

  readonly agentProposedTableName: string;
  readonly operatorProposedTableNames: readonly string[];

  readonly agentModelCandidateCount: number;
  readonly operatorModelCandidateCount: number;

  readonly agentRequiredFieldCount: number;
  readonly operatorRequiredFieldCount: number;

  readonly agentForbiddenFieldChecklistCount: number;
  readonly operatorForbiddenFieldChecklistCount: number;

  readonly agentMigrationChecklistCount: number;
  readonly operatorMigrationChecklistCount: number;
  readonly agentRollbackChecklistCount: number;
  readonly operatorRollbackChecklistCount: number;
  readonly agentRetentionChecklistCount: number;
  readonly operatorRetentionChecklistCount: number;
  readonly operatorPermissionChecklistCount: number;
  readonly operatorAuditIntegrityChecklistCount: number;

  readonly schemaChecklist: readonly SchemaMigrationPrReadinessIntegrationChecklistItem[];
  readonly migrationChecklist: readonly SchemaMigrationPrReadinessIntegrationChecklistItem[];
  readonly rollbackChecklist: readonly SchemaMigrationPrReadinessIntegrationChecklistItem[];
  readonly safetyChecklist: readonly SchemaMigrationPrReadinessIntegrationChecklistItem[];

  readonly plansSchemaPrOnly: true;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;
  readonly writesDataInThisStep: false;
  readonly callsPrismaInThisStep: false;
  readonly createsPullRequestInThisStep: false;
  readonly wiresAdapterInThisStep: false;

  readonly findings: readonly SchemaMigrationPrReadinessIntegrationFinding[];
}

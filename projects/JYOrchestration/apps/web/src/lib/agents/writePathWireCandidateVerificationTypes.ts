/**
 * Read-only Agent / Operator write path wire candidate verification (no wire/adapter/DB/Prisma/schema/migration).
 */

export type WritePathWireCandidateVerificationDecision =
  | "ready_for_wire_candidate_verification"
  | "defer"
  | "blocked";

export interface WritePathWireCandidateVerificationChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface WritePathWireCandidateVerificationFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface WritePathWireCandidateVerificationReport {
  readonly mode: "read_only_write_path_wire_candidate_verification";
  readonly decision: WritePathWireCandidateVerificationDecision;

  readonly requestedAgentTarget: string;
  readonly requestedOperatorTarget: string;
  readonly normalizedAgentTarget: string;
  readonly normalizedOperatorTarget: string;

  readonly sourceAgentWireGateDecision: string;
  readonly sourceOperatorWireGateDecision: string;
  readonly sourceSchemaMigrationReadinessDecision: string;

  readonly sourceSchemaMigrationRequestedAgentTarget: string;
  readonly sourceSchemaMigrationRequestedOperatorTarget: string;
  readonly sourceSchemaMigrationNormalizedAgentTarget: string;
  readonly sourceSchemaMigrationNormalizedOperatorTarget: string;
  readonly sourceSchemaMigrationAgentSchemaDecision: string;
  readonly sourceSchemaMigrationOperatorSchemaDecision: string;
  readonly sourceSchemaMigrationWriteAdapterDecision: string;
  readonly sourceSchemaMigrationAgentRequiresSchemaChange: boolean;
  readonly sourceSchemaMigrationOperatorRequiresSchemaChange: boolean;
  readonly sourceSchemaMigrationAgentRequiresMigration: boolean;
  readonly sourceSchemaMigrationOperatorRequiresMigration: boolean;

  readonly sourceAgentWritePathTarget: string;
  readonly sourceOperatorWritePathTarget: string;
  readonly sourceAgentFeatureFlagName: string;
  readonly sourceOperatorFeatureFlagName: string;

  readonly sourceAgentSchemaApprovalDecision: string;
  readonly sourceOperatorSchemaApprovalDecision: string;
  readonly sourceAgentSchemaApprovalReferenceOnly: boolean;
  readonly sourceOperatorSchemaApprovalReferenceOnly: boolean;

  readonly sourceAgentBlockingFindingCodes: readonly string[];
  readonly sourceOperatorBlockingFindingCodes: readonly string[];
  readonly sourceAgentWireGateBlockingFindingCodes: readonly string[];
  readonly sourceOperatorWireGateBlockingFindingCodes: readonly string[];

  readonly sourceAgentWireGateApprovalChecklistCount: number;
  readonly sourceOperatorWireGateApprovalChecklistCount: number;
  readonly sourceAgentWireGateRuntimeChecklistCount: number;
  readonly sourceOperatorWireGateRuntimeChecklistCount: number;
  readonly sourceOperatorWireGatePermissionChecklistCount: number;
  readonly sourceOperatorWireGateAuditChecklistCount: number;

  readonly agentExplicitUserApprovalProvided: boolean;
  readonly operatorExplicitUserApprovalProvided: boolean;
  readonly schemaMigrationReadinessConfirmed: boolean;
  readonly schemaMigrationReadinessReviewConfirmed: boolean;
  readonly schemaAppliedInRuntime: false;
  readonly migrationAppliedInRuntime: false;
  readonly agentWriteAdapterImplementedConfirmed: boolean;
  readonly operatorWriteAdapterImplementedConfirmed: boolean;
  readonly operatorPermissionModelConfirmed: boolean;
  readonly operatorAuditTrailConfirmed: boolean;

  readonly candidateChecklist: readonly WritePathWireCandidateVerificationChecklistItem[];
  readonly safetyChecklist: readonly WritePathWireCandidateVerificationChecklistItem[];
  readonly rollbackChecklist: readonly WritePathWireCandidateVerificationChecklistItem[];

  readonly verifiesCandidateOnly: true;
  readonly wiresWritePathInThisStep: false;
  readonly wiresAdapterInThisStep: false;
  readonly writesDataInThisStep: false;
  readonly callsPrismaInThisStep: false;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;
  readonly wiresFeatureFlagInThisStep: false;
  readonly changesRuntimeRouteInThisStep: false;

  readonly findings: readonly WritePathWireCandidateVerificationFinding[];
}

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

  readonly sourceAgentWireGateDecision: string;
  readonly sourceOperatorWireGateDecision: string;
  readonly sourceSchemaMigrationReadinessDecision: string;

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

  readonly agentExplicitUserApprovalProvided: boolean;
  readonly operatorExplicitUserApprovalProvided: boolean;
  readonly schemaMigrationReadinessConfirmed: boolean;
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

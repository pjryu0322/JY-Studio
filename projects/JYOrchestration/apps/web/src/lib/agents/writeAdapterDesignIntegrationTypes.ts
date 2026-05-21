/**
 * Read-only Agent / Operator write adapter design integration (no adapter wire, Prisma, or DB write).
 */

export type WriteAdapterDesignIntegrationDecision =
  | "ready_for_adapter_design"
  | "defer"
  | "blocked";

export interface WriteAdapterDesignIntegrationChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface WriteAdapterDesignIntegrationFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface WriteAdapterDesignIntegrationReport {
  readonly mode: "read_only_write_adapter_design_integration";
  readonly decision: WriteAdapterDesignIntegrationDecision;

  readonly requestedAgentTarget: string;
  readonly requestedOperatorTarget: string;
  readonly normalizedAgentTarget: string;
  readonly normalizedOperatorTarget: string;

  readonly sourceAgentWireGateDecision: string;
  readonly sourceOperatorWireGateDecision: string;
  readonly sourceAgentWritePathDecision: string;
  readonly sourceOperatorWritePathDecision: string;

  readonly sourceAgentSchemaApprovalDecision: string;
  readonly sourceOperatorSchemaApprovalDecision: string;
  readonly sourceAgentSchemaApprovalTarget: string;
  readonly sourceOperatorSchemaApprovalTarget: string;
  readonly sourceAgentSchemaApprovalReferenceOnly: boolean;
  readonly sourceOperatorSchemaApprovalReferenceOnly: boolean;

  readonly sourceAgentBlockingFindingCodes: readonly string[];
  readonly sourceOperatorBlockingFindingCodes: readonly string[];

  readonly sourceAgentApprovalChecklistItemCount: number;
  readonly sourceOperatorApprovalChecklistItemCount: number;
  readonly sourceAgentRuntimeChecklistItemCount: number;
  readonly sourceOperatorRuntimeChecklistItemCount: number;
  readonly sourceOperatorPermissionChecklistItemCount: number;
  readonly sourceOperatorAuditChecklistItemCount: number;

  readonly agentAdapterTarget: string;
  readonly operatorAdapterTarget: string;

  readonly agentAdapterBoundaryName: string;
  readonly operatorAdapterBoundaryName: string;

  readonly agentFeatureFlagName: string;
  readonly operatorFeatureFlagName: string;

  readonly agentSanitizerCount: number;
  readonly operatorSanitizerCount: number;
  readonly agentForbiddenGuardCount: number;
  readonly operatorForbiddenGuardCount: number;
  readonly operatorPermissionGuardCount: number;
  readonly operatorAuditGuardCount: number;

  readonly adapterChecklist: readonly WriteAdapterDesignIntegrationChecklistItem[];
  readonly safetyChecklist: readonly WriteAdapterDesignIntegrationChecklistItem[];
  readonly rollbackChecklist: readonly WriteAdapterDesignIntegrationChecklistItem[];

  readonly designsAdapterOnly: true;
  readonly wiresAdapterInThisStep: false;
  readonly writesDataInThisStep: false;
  readonly callsPrismaInThisStep: false;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;
  readonly wiresFeatureFlagInThisStep: false;

  readonly findings: readonly WriteAdapterDesignIntegrationFinding[];
}

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

  readonly sourceAgentWireGateDecision: string;
  readonly sourceOperatorWireGateDecision: string;
  readonly sourceAgentWritePathDecision: string;
  readonly sourceOperatorWritePathDecision: string;

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

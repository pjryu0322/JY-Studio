/**
 * Read-only Agent execution record write path wire approval gate (no Prisma/DB/write wire).
 */

export type AgentExecutionRecordWritePathWireApprovalDecision =
  | "ready_for_write_path_wire_approval"
  | "defer"
  | "blocked";

export interface AgentExecutionRecordWritePathWireApprovalChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface AgentExecutionRecordWritePathWireApprovalFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface AgentExecutionRecordWritePathWireApprovalGateReport {
  readonly mode: "read_only_agent_execution_record_write_path_wire_approval_gate";
  readonly decision: AgentExecutionRecordWritePathWireApprovalDecision;

  readonly sourceWritePathDecision: string;
  readonly sourceSchemaApprovalDecision: string;
  readonly target: string;

  readonly explicitUserApprovalProvided: boolean;
  readonly schemaAppliedConfirmed: boolean;
  readonly migrationAppliedConfirmed: boolean;
  readonly featureFlagWireApproved: boolean;
  readonly writeAdapterImplementedConfirmed: boolean;

  readonly approvalChecklist: readonly AgentExecutionRecordWritePathWireApprovalChecklistItem[];
  readonly runtimeChecklist: readonly AgentExecutionRecordWritePathWireApprovalChecklistItem[];
  readonly rollbackChecklist: readonly AgentExecutionRecordWritePathWireApprovalChecklistItem[];

  readonly requiresExplicitUserApproval: true;
  readonly requiresSchemaApplied: true;
  readonly requiresMigrationApplied: true;
  readonly requiresFeatureFlagWireApproval: true;
  readonly requiresWriteAdapterImplemented: true;

  readonly wiresWritePathInThisStep: false;
  readonly writesDataInThisStep: false;
  readonly callsPrismaInThisStep: false;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;

  readonly findings: readonly AgentExecutionRecordWritePathWireApprovalFinding[];
}

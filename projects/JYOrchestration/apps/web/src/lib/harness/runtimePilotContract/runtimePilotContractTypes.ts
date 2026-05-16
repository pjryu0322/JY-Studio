/**
 * H24.5 — Controlled pilot **contract** & runtime adapter **boundary** metadata(read-only; adapter 호출 없음).
 */

export type RuntimePilotContractReadiness =
  | "not_ready"
  | "contract_metadata_ready"
  | "watch"
  | "blocked";

export type RuntimeAdapterBoundaryMode = "no_op_only" | "contract_metadata_only" | "handoff_blocked";

export type RuntimePilotContractSummary = Readonly<{
  mode: "runtime_pilot_contract_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  contractReadiness: RuntimePilotContractReadiness;
  adapterBoundaryMode: RuntimeAdapterBoundaryMode;
  contractInputRequirements: readonly string[];
  contractOutputExpectations: readonly string[];
  handoffBlockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotContractInputSchema = Readonly<{
  mode: "runtime_pilot_contract_input_schema";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  requiredFields: readonly string[];
  optionalReferences: readonly string[];
  notesKo: string;
}>;

export type RuntimePilotContractOutputSchema = Readonly<{
  mode: "runtime_pilot_contract_output_schema";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  expectedFields: readonly string[];
  noOpResultMetadata: readonly string[];
  notesKo: string;
}>;

export type RuntimeAdapterBoundarySummary = Readonly<{
  mode: "runtime_adapter_boundary_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  boundaryMode: RuntimeAdapterBoundaryMode;
  rationaleKo: string;
  noOpGuarantees: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeAdapterForbiddenOperationReport = Readonly<{
  mode: "runtime_adapter_forbidden_operation_report";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  forbiddenOperations: readonly string[];
  wordingRiskFindings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotHandoffReadiness = Readonly<{
  mode: "runtime_pilot_handoff_readiness";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  handoffReadiness: "not_ready" | "metadata_watch" | "metadata_ready" | "blocked";
  contractReadiness: RuntimePilotContractReadiness;
  adapterBoundaryMode: RuntimeAdapterBoundaryMode;
  controlledPilotReadiness: string;
  operatorApprovalReadiness: string;
  rollbackReadiness: string;
  auditReadiness: string;
  handoffBlockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotContractPlanningReports = Readonly<{
  runtimePilotContractSummary: RuntimePilotContractSummary;
  runtimePilotContractInputSchema: RuntimePilotContractInputSchema;
  runtimePilotContractOutputSchema: RuntimePilotContractOutputSchema;
  runtimeAdapterBoundarySummary: RuntimeAdapterBoundarySummary;
  runtimeAdapterForbiddenOperationReport: RuntimeAdapterForbiddenOperationReport;
  runtimePilotHandoffReadiness: RuntimePilotHandoffReadiness;
}>;

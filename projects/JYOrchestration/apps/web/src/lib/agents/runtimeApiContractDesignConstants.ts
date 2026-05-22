/**
 * Stage 7-B runtime API contract design constants (read-only).
 */

import type { RuntimeApiEndpointContract } from "@/lib/agents/runtimeApiContractDesignTypes";

export const RUNTIME_API_CONTRACT_DESIGN_VERSION = "runtime_api_contract_design_v1" as const;

export const RUNTIME_API_CONTRACT_DESIGN_TITLE = "Runtime API Contract Design" as const;

export const REQUIRED_STAGE7_B_RUNTIME_API_CONFIRMATIONS = [
  "runtimeApiContractReviewed",
  "runtimeApiNoEndpointImplementationConfirmed",
  "runtimeApiNoPersistenceConfirmed",
  "runtimeApiSecurityBoundaryReviewed",
  "runtimeApiApprovalBoundaryReviewed",
] as const;

export const STAGE7_B_REQUIRED_ENDPOINT_CONTRACT_IDS = [
  "create-runtime-execution-request",
  "get-runtime-execution-status",
  "list-runtime-execution-events",
  "request-runtime-execution-cancel",
  "submit-runtime-execution-approval",
  "request-runtime-execution-rollback",
] as const;

export const STAGE7_B_RECOMMENDED_NEXT_PHASES = ["stage_7_c_execution_runner_contract_design"] as const;

export const STAGE7_B_SEPARATED_WORK_ITEMS = [
  "actual_api_route_handlers",
  "actual_runtime_execution_api",
  "actual_execution_runner",
  "actual_dry_run_runner",
  "actual_db_write",
  "actual_persistence_implementation",
  "actual_schema_migration",
  "actual_cursor_execution_wire",
  "actual_github_operation_wire",
  "actual_connector_gateway_routing_change",
  "actual_runtime_execution_ui",
] as const;

type EndpointSpec = {
  readonly method: RuntimeApiEndpointContract["method"];
  readonly pathPattern: string;
  readonly purpose: string;
  readonly requestContract: string;
  readonly responseContract: string;
  readonly statusTransitions: readonly string[];
  readonly requiredApprovals: readonly string[];
  readonly errorCodes: readonly string[];
  readonly auditEvents: readonly string[];
};

export const STAGE7_B_ENDPOINT_SPECS: Record<(typeof STAGE7_B_REQUIRED_ENDPOINT_CONTRACT_IDS)[number], EndpointSpec> = {
  "create-runtime-execution-request": {
    method: "POST",
    pathPattern: "/api/runtime/executions",
    purpose: "Design contract for creating a runtime execution request without implementing the route.",
    requestContract: "RuntimeExecutionCreateRequest",
    responseContract: "RuntimeExecutionCreateResponse",
    statusTransitions: ["pending", "awaiting_approval"],
    requiredApprovals: ["runtime_operator"],
    errorCodes: [
      "RUNTIME_EXECUTION_INVALID_REQUEST",
      "RUNTIME_EXECUTION_UNAUTHORIZED",
      "RUNTIME_EXECUTION_NOT_ALLOWED",
      "RUNTIME_EXECUTION_APPROVAL_REQUIRED",
    ],
    auditEvents: ["runtime_execution_create_requested"],
  },
  "get-runtime-execution-status": {
    method: "GET",
    pathPattern: "/api/runtime/executions/:executionId",
    purpose: "Design contract for reading runtime execution status without implementing the route.",
    requestContract: "RuntimeExecutionStatusRequest",
    responseContract: "RuntimeExecutionStatusResponse",
    statusTransitions: ["pending", "running", "completed", "failed", "cancelled"],
    requiredApprovals: ["runtime_operator"],
    errorCodes: [
      "RUNTIME_EXECUTION_NOT_FOUND",
      "RUNTIME_EXECUTION_UNAUTHORIZED",
      "RUNTIME_EXECUTION_FORBIDDEN",
      "RUNTIME_EXECUTION_APPROVAL_REQUIRED",
    ],
    auditEvents: ["runtime_execution_status_read"],
  },
  "list-runtime-execution-events": {
    method: "GET",
    pathPattern: "/api/runtime/executions/:executionId/events",
    purpose: "Design contract for listing runtime execution events without implementing the route.",
    requestContract: "RuntimeExecutionEventsRequest",
    responseContract: "RuntimeExecutionEventsResponse",
    statusTransitions: ["event_recorded", "event_filtered"],
    requiredApprovals: ["runtime_operator"],
    errorCodes: [
      "RUNTIME_EXECUTION_NOT_FOUND",
      "RUNTIME_EXECUTION_UNAUTHORIZED",
      "RUNTIME_EXECUTION_EVENTS_FORBIDDEN",
      "RUNTIME_EXECUTION_APPROVAL_REQUIRED",
    ],
    auditEvents: ["runtime_execution_events_listed"],
  },
  "request-runtime-execution-cancel": {
    method: "POST",
    pathPattern: "/api/runtime/executions/:executionId/cancel",
    purpose: "Design contract for cancelling a runtime execution without implementing the route.",
    requestContract: "RuntimeExecutionCancelRequest",
    responseContract: "RuntimeExecutionCancelResponse",
    statusTransitions: ["running", "cancelling", "cancelled"],
    requiredApprovals: ["runtime_operator"],
    errorCodes: [
      "RUNTIME_EXECUTION_CANCEL_NOT_ALLOWED",
      "RUNTIME_EXECUTION_NOT_FOUND",
      "RUNTIME_EXECUTION_FORBIDDEN",
      "RUNTIME_EXECUTION_APPROVAL_REQUIRED",
    ],
    auditEvents: ["runtime_execution_cancel_requested"],
  },
  "submit-runtime-execution-approval": {
    method: "POST",
    pathPattern: "/api/runtime/executions/:executionId/approval",
    purpose: "Design contract for submitting runtime execution approval without implementing the route.",
    requestContract: "RuntimeExecutionApprovalRequest",
    responseContract: "RuntimeExecutionApprovalResponse",
    statusTransitions: ["awaiting_approval", "approved", "rejected"],
    requiredApprovals: ["runtime_operator", "security_operator"],
    errorCodes: [
      "RUNTIME_EXECUTION_APPROVAL_INVALID",
      "RUNTIME_EXECUTION_APPROVAL_DENIED",
      "RUNTIME_EXECUTION_UNAUTHORIZED",
      "RUNTIME_EXECUTION_FORBIDDEN",
    ],
    auditEvents: ["runtime_execution_approval_submitted"],
  },
  "request-runtime-execution-rollback": {
    method: "POST",
    pathPattern: "/api/runtime/executions/:executionId/rollback",
    purpose: "Design contract for requesting runtime execution rollback without implementing the route.",
    requestContract: "RuntimeExecutionRollbackRequest",
    responseContract: "RuntimeExecutionRollbackResponse",
    statusTransitions: ["failed", "rolling_back", "rolled_back"],
    requiredApprovals: ["runtime_operator", "security_operator"],
    errorCodes: [
      "RUNTIME_EXECUTION_ROLLBACK_NOT_ALLOWED",
      "RUNTIME_EXECUTION_ROLLBACK_FAILED",
      "RUNTIME_EXECUTION_UNAUTHORIZED",
      "RUNTIME_EXECUTION_FORBIDDEN",
      "RUNTIME_EXECUTION_APPROVAL_REQUIRED",
    ],
    auditEvents: ["runtime_execution_rollback_requested"],
  },
};

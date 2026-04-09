/**
 * Executor-facing handoff and launch artifacts (Business Execution domain extension).
 *
 * These types describe structured envelopes toward an executor or integration boundary. They are not
 * Stage1/Stage2 test-run state and must not be conflated with environment/procedure test execution.
 */

export type { ExecutionAssignmentHandoffPayload } from "@/lib/workflow/executionAssignmentHandoffPayload";
export type { ExecutorIntakeContract } from "@/lib/workflow/executorIntakeContract";
export type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";
export type { BusinessLaunchIntent } from "@/lib/workflow/businessLaunchIntent";
export type { BusinessLaunchHandoffRecord } from "@/lib/workflow/businessLaunchHandoffRecord";
export type { ExecutionBridgePayload } from "@/lib/workflow/executionBridgePayload";
export type { ExecutorLaunchContract } from "@/lib/workflow/executorLaunchContract";
export type { ExecutionTriggerIntent } from "@/lib/workflow/executionTriggerIntent";
export type { ActualExecutionAdapterRequest } from "@/lib/workflow/actualExecutionAdapter";
export type { ActualLaunchCommand } from "@/lib/workflow/actualLaunchCommand";
export type {
  ExecutorIntegrationAdapter,
  ExecutorIntegrationAdapterPayload,
  ExecutorIntegrationAdapterStatus,
} from "@/lib/workflow/executorIntegrationAdapter";
export type { ExecutorConnectorResult, ExecutorConnectorResultStatus } from "@/lib/workflow/executorConnector";

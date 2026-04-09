/**
 * Session-scoped persistence for Business Execution pipeline artifacts (in-memory).
 *
 * Implementation lives in businessExecutionRequestStore / preExecutionStateStore; this module documents
 * the domain boundary and offers a single import surface for store primitives when adding persistence later.
 *
 * TODO: Map these record/resolve pairs to durable storage without changing domain types.
 */

export {
  /** Core persistence-ready entities (latest-only; repository boundary). */
  recordSessionBusinessExecutionRequest,
  resolveSessionBusinessExecutionRequest,
  recordSessionBusinessExecutionApproval,
  resolveSessionBusinessExecutionApproval,
  recordSessionBusinessExecutionPackage,
  resolveSessionBusinessExecutionPackage,
  recordSessionExecutionAssignment,
  resolveSessionExecutionAssignment,
  recordSessionExecutionAssignmentHandoffPayload,
  resolveSessionExecutionAssignmentHandoffPayload,
  recordSessionExecutorIntakeContract,
  resolveSessionExecutorIntakeContract,
  recordSessionExecutorWorkOrder,
  resolveSessionExecutorWorkOrder,
  recordSessionBusinessLaunchIntent,
  resolveSessionBusinessLaunchIntent,
  recordSessionBusinessLaunchHandoffRecord,
  resolveSessionBusinessLaunchHandoffRecord,
  recordSessionExecutionBridgePayload,
  resolveSessionExecutionBridgePayload,
  recordSessionExecutorLaunchContract,
  resolveSessionExecutorLaunchContract,
  recordSessionExecutionTriggerIntent,
  resolveSessionExecutionTriggerIntent,
  recordSessionActualExecutionAdapterRequest,
  resolveSessionActualExecutionAdapterRequest,
  recordSessionActualLaunchCommand,
  resolveSessionActualLaunchCommand,
  recordSessionBusinessExecutionRun,
  resolveSessionBusinessExecutionRun,
  recordSessionExecutorIntegrationAdapter,
  resolveSessionExecutorIntegrationAdapter,
  recordSessionExecutorConnectorResult,
  resolveSessionExecutorConnectorResult,
} from "@/lib/workflow/businessExecutionRequestStore";

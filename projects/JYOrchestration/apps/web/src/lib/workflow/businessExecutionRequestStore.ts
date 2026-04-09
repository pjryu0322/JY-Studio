/**
 * Business execution request artifact (NOT Stage1/Stage2):
 * - explicit request to execute work based on prepared business pre-execution state
 *
 * In-memory only. No environment test flow. No actual launch.
 */

import type { BusinessExecutionApproval } from "@/lib/workflow/businessExecutionApproval";
import type { BusinessExecutionPackage } from "@/lib/workflow/businessExecutionPackage";
import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import type { ExecutionAssignment } from "@/lib/workflow/executionAssignment";
import type { ExecutionAssignmentHandoffPayload } from "@/lib/workflow/executionAssignmentHandoffPayload";
import type { ExecutorIntakeContract } from "@/lib/workflow/executorIntakeContract";
import type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";
import type { BusinessLaunchIntent } from "@/lib/workflow/businessLaunchIntent";
import type { BusinessLaunchHandoffRecord } from "@/lib/workflow/businessLaunchHandoffRecord";
import type { ExecutionBridgePayload } from "@/lib/workflow/executionBridgePayload";
import type { ExecutorLaunchContract } from "@/lib/workflow/executorLaunchContract";
import type { ExecutionTriggerIntent } from "@/lib/workflow/executionTriggerIntent";
import type { ActualExecutionAdapterRequest } from "@/lib/workflow/actualExecutionAdapter";
import { getSessionEntry, updateSessionEntry } from "@/lib/workflow/sessionResultStoreCore";

type BusinessExecutionRequestEntry = {
  latestBusinessExecutionRequest?: BusinessExecutionRequest;
  latestBusinessExecutionApproval?: BusinessExecutionApproval;
  latestBusinessExecutionPackage?: BusinessExecutionPackage;
  latestExecutionAssignment?: ExecutionAssignment;
  latestExecutionAssignmentHandoffPayload?: ExecutionAssignmentHandoffPayload;
  latestExecutorIntakeContract?: ExecutorIntakeContract;
  latestExecutorWorkOrder?: ExecutorWorkOrder;
  latestBusinessLaunchIntent?: BusinessLaunchIntent;
  latestBusinessLaunchHandoffRecord?: BusinessLaunchHandoffRecord;
  latestExecutionBridgePayload?: ExecutionBridgePayload;
  latestExecutorLaunchContract?: ExecutorLaunchContract;
  latestExecutionTriggerIntent?: ExecutionTriggerIntent;
  latestActualExecutionAdapterRequest?: ActualExecutionAdapterRequest;
  updatedAtIso?: string;
};

export function recordSessionBusinessExecutionRequest(sessionId: string, request: BusinessExecutionRequest): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestBusinessExecutionRequest: request,
    updatedAtIso: at,
  }));
}

export function resolveSessionBusinessExecutionRequest(sessionId: string | null | undefined): BusinessExecutionRequest | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestBusinessExecutionRequest;
}

export function sessionHasBusinessExecutionRequest(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestBusinessExecutionRequest !== undefined;
}

export function isBusinessExecutionRequestForSnapshot(
  request: BusinessExecutionRequest | undefined,
  snapshotId: string | null | undefined
): boolean {
  if (!request || !snapshotId) return false;
  return request.snapshotId === snapshotId;
}

export function recordSessionBusinessExecutionApproval(sessionId: string, approval: BusinessExecutionApproval): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestBusinessExecutionApproval: approval,
    updatedAtIso: at,
  }));
}

export function resolveSessionBusinessExecutionApproval(sessionId: string | null | undefined): BusinessExecutionApproval | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestBusinessExecutionApproval;
}

export function sessionHasBusinessExecutionApproval(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestBusinessExecutionApproval !== undefined;
}

export function recordSessionBusinessExecutionPackage(sessionId: string, pkg: BusinessExecutionPackage): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestBusinessExecutionPackage: pkg,
    updatedAtIso: at,
  }));
}

export function resolveSessionBusinessExecutionPackage(sessionId: string | null | undefined): BusinessExecutionPackage | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestBusinessExecutionPackage;
}

export function sessionHasBusinessExecutionPackage(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestBusinessExecutionPackage !== undefined;
}

export function recordSessionExecutionAssignment(sessionId: string, assignment: ExecutionAssignment): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestExecutionAssignment: assignment,
    updatedAtIso: at,
  }));
}

export function resolveSessionExecutionAssignment(sessionId: string | null | undefined): ExecutionAssignment | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutionAssignment;
}

export function sessionHasExecutionAssignment(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutionAssignment !== undefined;
}

export function recordSessionExecutionAssignmentHandoffPayload(
  sessionId: string,
  payload: ExecutionAssignmentHandoffPayload
): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestExecutionAssignmentHandoffPayload: payload,
    updatedAtIso: at,
  }));
}

export function resolveSessionExecutionAssignmentHandoffPayload(
  sessionId: string | null | undefined
): ExecutionAssignmentHandoffPayload | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutionAssignmentHandoffPayload;
}

export function sessionHasExecutionAssignmentHandoffPayload(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutionAssignmentHandoffPayload !== undefined;
}

export function recordSessionExecutorIntakeContract(sessionId: string, contract: ExecutorIntakeContract): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestExecutorIntakeContract: contract,
    updatedAtIso: at,
  }));
}

export function resolveSessionExecutorIntakeContract(sessionId: string | null | undefined): ExecutorIntakeContract | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutorIntakeContract;
}

export function sessionHasExecutorIntakeContract(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutorIntakeContract !== undefined;
}

export function recordSessionExecutorWorkOrder(sessionId: string, workOrder: ExecutorWorkOrder): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestExecutorWorkOrder: workOrder,
    updatedAtIso: at,
  }));
}

export function resolveSessionExecutorWorkOrder(sessionId: string | null | undefined): ExecutorWorkOrder | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutorWorkOrder;
}

export function sessionHasExecutorWorkOrder(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutorWorkOrder !== undefined;
}

export function recordSessionBusinessLaunchIntent(sessionId: string, intent: BusinessLaunchIntent): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestBusinessLaunchIntent: intent,
    updatedAtIso: at,
  }));
}

export function resolveSessionBusinessLaunchIntent(sessionId: string | null | undefined): BusinessLaunchIntent | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestBusinessLaunchIntent;
}

export function sessionHasBusinessLaunchIntent(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestBusinessLaunchIntent !== undefined;
}

export function recordSessionBusinessLaunchHandoffRecord(sessionId: string, record: BusinessLaunchHandoffRecord): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestBusinessLaunchHandoffRecord: record,
    updatedAtIso: at,
  }));
}

export function resolveSessionBusinessLaunchHandoffRecord(
  sessionId: string | null | undefined
): BusinessLaunchHandoffRecord | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestBusinessLaunchHandoffRecord;
}

export function sessionHasBusinessLaunchHandoffRecord(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestBusinessLaunchHandoffRecord !== undefined;
}

export function recordSessionExecutionBridgePayload(sessionId: string, payload: ExecutionBridgePayload): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestExecutionBridgePayload: payload,
    updatedAtIso: at,
  }));
}

export function resolveSessionExecutionBridgePayload(
  sessionId: string | null | undefined
): ExecutionBridgePayload | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutionBridgePayload;
}

export function sessionHasExecutionBridgePayload(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutionBridgePayload !== undefined;
}

export function recordSessionExecutorLaunchContract(sessionId: string, contract: ExecutorLaunchContract): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestExecutorLaunchContract: contract,
    updatedAtIso: at,
  }));
}

export function resolveSessionExecutorLaunchContract(
  sessionId: string | null | undefined
): ExecutorLaunchContract | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutorLaunchContract;
}

export function sessionHasExecutorLaunchContract(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutorLaunchContract !== undefined;
}

export function recordSessionExecutionTriggerIntent(sessionId: string, intent: ExecutionTriggerIntent): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestExecutionTriggerIntent: intent,
    updatedAtIso: at,
  }));
}

export function resolveSessionExecutionTriggerIntent(
  sessionId: string | null | undefined
): ExecutionTriggerIntent | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutionTriggerIntent;
}

export function sessionHasExecutionTriggerIntent(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutionTriggerIntent !== undefined;
}

export function recordSessionActualExecutionAdapterRequest(
  sessionId: string,
  request: ActualExecutionAdapterRequest
): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestActualExecutionAdapterRequest: request,
    updatedAtIso: at,
  }));
}

export function resolveSessionActualExecutionAdapterRequest(
  sessionId: string | null | undefined
): ActualExecutionAdapterRequest | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestActualExecutionAdapterRequest;
}

export function sessionHasActualExecutionAdapterRequest(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestActualExecutionAdapterRequest !== undefined;
}

export {
  evaluateExecutionRequestValidity,
  resolveExecutionRequestValidity,
  type ExecutionRequestLifecycleStatus,
  type ExecutionRequestValidityResult,
} from "@/lib/workflow/businessExecutionRequestValidity";


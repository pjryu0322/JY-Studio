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
import type { ActualLaunchCommand } from "@/lib/workflow/actualLaunchCommand";
import type { BusinessExecutionRun } from "@/lib/workflow/businessExecutionRun";
import type { ExecutorIntegrationAdapter } from "@/lib/workflow/executorIntegrationAdapter";
import type { ExecutorConnectorResult } from "@/lib/workflow/executorConnector";
import {
  recordSessionBusinessExecutionApproval as recordCoreBusinessExecutionApproval,
  recordSessionBusinessExecutionPackage as recordCoreBusinessExecutionPackage,
  recordSessionBusinessExecutionRequest as recordCoreBusinessExecutionRequest,
  recordSessionBusinessExecutionRun as recordCoreBusinessExecutionRun,
  recordSessionExecutionAssignment as recordCoreExecutionAssignment,
  resolveSessionBusinessExecutionApproval as resolveCoreBusinessExecutionApproval,
  resolveSessionBusinessExecutionPackage as resolveCoreBusinessExecutionPackage,
  resolveSessionBusinessExecutionRequest as resolveCoreBusinessExecutionRequest,
  resolveSessionBusinessExecutionRun as resolveCoreBusinessExecutionRun,
  resolveSessionExecutionAssignment as resolveCoreExecutionAssignment,
  sessionHasBusinessExecutionApproval as hasCoreBusinessExecutionApproval,
  sessionHasBusinessExecutionPackage as hasCoreBusinessExecutionPackage,
  sessionHasBusinessExecutionRequest as hasCoreBusinessExecutionRequest,
  sessionHasBusinessExecutionRun as hasCoreBusinessExecutionRun,
  sessionHasExecutionAssignment as hasCoreExecutionAssignment,
} from "@/lib/workflow/businessExecutionEntityRepository";
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
  latestActualLaunchCommand?: ActualLaunchCommand;
  latestBusinessExecutionRun?: BusinessExecutionRun;
  latestExecutorIntegrationAdapter?: ExecutorIntegrationAdapter;
  latestExecutorConnectorResult?: ExecutorConnectorResult;
  updatedAtIso?: string;
};

/**
 * Core entity persistence boundary (latest-only, in-memory for now).
 * These functions intentionally delegate to the core entity repository to prepare for later DB adoption.
 */
export const recordSessionBusinessExecutionRequest = recordCoreBusinessExecutionRequest;
export const resolveSessionBusinessExecutionRequest = resolveCoreBusinessExecutionRequest;
export const sessionHasBusinessExecutionRequest = hasCoreBusinessExecutionRequest;

export function isBusinessExecutionRequestForSnapshot(
  request: BusinessExecutionRequest | undefined,
  snapshotId: string | null | undefined
): boolean {
  if (!request || !snapshotId) return false;
  return request.snapshotId === snapshotId;
}

export const recordSessionBusinessExecutionApproval = recordCoreBusinessExecutionApproval;
export const resolveSessionBusinessExecutionApproval = resolveCoreBusinessExecutionApproval;
export const sessionHasBusinessExecutionApproval = hasCoreBusinessExecutionApproval;

export const recordSessionBusinessExecutionPackage = recordCoreBusinessExecutionPackage;
export const resolveSessionBusinessExecutionPackage = resolveCoreBusinessExecutionPackage;
export const sessionHasBusinessExecutionPackage = hasCoreBusinessExecutionPackage;

export const recordSessionExecutionAssignment = recordCoreExecutionAssignment;
export const resolveSessionExecutionAssignment = resolveCoreExecutionAssignment;
export const sessionHasExecutionAssignment = hasCoreExecutionAssignment;

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

export function recordSessionActualLaunchCommand(sessionId: string, command: ActualLaunchCommand): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestActualLaunchCommand: command,
    updatedAtIso: at,
  }));
}

export function resolveSessionActualLaunchCommand(
  sessionId: string | null | undefined
): ActualLaunchCommand | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestActualLaunchCommand;
}

export function sessionHasActualLaunchCommand(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestActualLaunchCommand !== undefined;
}

export const recordSessionBusinessExecutionRun = recordCoreBusinessExecutionRun;
export const resolveSessionBusinessExecutionRun = resolveCoreBusinessExecutionRun;
export const sessionHasBusinessExecutionRun = hasCoreBusinessExecutionRun;

export function recordSessionExecutorIntegrationAdapter(sessionId: string, adapter: ExecutorIntegrationAdapter): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestExecutorIntegrationAdapter: adapter,
    updatedAtIso: at,
  }));
}

export function resolveSessionExecutorIntegrationAdapter(
  sessionId: string | null | undefined
): ExecutorIntegrationAdapter | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutorIntegrationAdapter;
}

export function sessionHasExecutorIntegrationAdapter(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutorIntegrationAdapter !== undefined;
}

export function recordSessionExecutorConnectorResult(sessionId: string, result: ExecutorConnectorResult): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionRequestEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestExecutorConnectorResult: result,
    updatedAtIso: at,
  }));
}

export function resolveSessionExecutorConnectorResult(
  sessionId: string | null | undefined
): ExecutorConnectorResult | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutorConnectorResult;
}

export function sessionHasExecutorConnectorResult(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<BusinessExecutionRequestEntry>(sessionId)?.latestExecutorConnectorResult !== undefined;
}

export {
  evaluateExecutionRequestValidity,
  resolveExecutionRequestValidity,
  type ExecutionRequestLifecycleStatus,
  type ExecutionRequestValidityResult,
} from "@/lib/workflow/businessExecutionRequestValidity";


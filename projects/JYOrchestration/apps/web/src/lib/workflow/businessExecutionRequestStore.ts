/**
 * Business execution request artifact (NOT Stage1/Stage2):
 * - explicit request to execute work based on prepared business pre-execution state
 *
 * In-memory only. No environment test flow. No actual launch.
 */

import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import { getSessionEntry, updateSessionEntry } from "@/lib/workflow/sessionResultStoreCore";

type BusinessExecutionRequestEntry = {
  latestBusinessExecutionRequest?: BusinessExecutionRequest;
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


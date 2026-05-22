/**
 * Stage 8-A in-memory runtime execution store (pure functions).
 */

import type {
  RuntimeExecutionRecord,
  RuntimeExecutionRequest,
  RuntimeExecutionStatus,
  RuntimeExecutionVerticalSliceStore,
} from "@/lib/agents/runtimeExecutionVerticalSliceTypes";
import { STAGE8_A_DEFAULT_NOW_ISO } from "@/lib/agents/runtimeExecutionVerticalSliceConstants";

export function createInitialRuntimeExecutionStore(): RuntimeExecutionVerticalSliceStore {
  return {
    records: [],
    auditEvents: [],
  };
}

export function createRuntimeExecutionRecord(input: {
  readonly request: RuntimeExecutionRequest;
  readonly nowIso?: string;
}): RuntimeExecutionRecord {
  const nowIso = input.nowIso ?? STAGE8_A_DEFAULT_NOW_ISO;
  const status: RuntimeExecutionStatus = "requested";
  return {
    executionId: `exec-${input.request.requestId}`,
    requestId: input.request.requestId,
    projectId: input.request.projectId,
    status,
    statusHistory: [status],
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
    inMemoryOnly: true,
    persisted: false,
    actualRunnerInvoked: false,
    cursorGithubInvoked: false,
    connectorGatewayInvoked: false,
    dbWritten: false,
  };
}

export function appendRuntimeExecutionRecord(
  store: RuntimeExecutionVerticalSliceStore,
  record: RuntimeExecutionRecord,
): RuntimeExecutionVerticalSliceStore {
  return {
    records: [...store.records, record],
    auditEvents: [...store.auditEvents],
  };
}

export function transitionRuntimeExecutionRecord(
  record: RuntimeExecutionRecord,
  nextStatus: RuntimeExecutionStatus,
  nowIso?: string,
): RuntimeExecutionRecord {
  const updatedAtIso = nowIso ?? STAGE8_A_DEFAULT_NOW_ISO;
  return {
    ...record,
    status: nextStatus,
    statusHistory: [...record.statusHistory, nextStatus],
    updatedAtIso,
  };
}

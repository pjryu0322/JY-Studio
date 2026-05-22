/**
 * Stage 8-A runtime execution audit events (in-memory only).
 */

import { STAGE8_A_DEFAULT_NOW_ISO } from "@/lib/agents/runtimeExecutionVerticalSliceConstants";
import type {
  RuntimeExecutionAuditEvent,
  RuntimeExecutionStatus,
  RuntimeExecutionVerticalSliceStore,
} from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

export function buildRuntimeExecutionAuditEvent(input: {
  readonly executionId: string;
  readonly requestId: string;
  readonly eventType: RuntimeExecutionAuditEvent["eventType"];
  readonly statusBefore?: RuntimeExecutionStatus;
  readonly statusAfter?: RuntimeExecutionStatus;
  readonly message: string;
  readonly nowIso?: string;
  readonly sequence?: number;
}): RuntimeExecutionAuditEvent {
  const nowIso = input.nowIso ?? STAGE8_A_DEFAULT_NOW_ISO;
  const sequence = input.sequence ?? 0;
  return {
    auditEventId: `audit-${input.executionId}-${input.eventType}-${sequence}`,
    executionId: input.executionId,
    requestId: input.requestId,
    eventType: input.eventType,
    statusBefore: input.statusBefore,
    statusAfter: input.statusAfter,
    message: input.message,
    createdAtIso: nowIso,
    inMemoryOnly: true,
  };
}

export function appendRuntimeExecutionAuditEvent(
  store: RuntimeExecutionVerticalSliceStore,
  event: RuntimeExecutionAuditEvent,
): RuntimeExecutionVerticalSliceStore {
  return {
    records: [...store.records],
    auditEvents: [...store.auditEvents, event],
  };
}

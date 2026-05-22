/**
 * Stage 9-A in-memory runtime execution store (Map-based; no persistence).
 */

import { buildRuntimeExecutionAuditEvent } from "@/lib/agents/runtimeExecutionVerticalSliceAudit";
import { STAGE9_A_DEFAULT_NOW_ISO } from "@/lib/agents/runtimeExecutionApiMvpConstants";
import type {
  RuntimeExecutionApiCreateRequest,
  RuntimeExecutionApiMvpStoreSnapshot,
} from "@/lib/agents/runtimeExecutionApiMvpTypes";
import {
  createRuntimeExecutionRecord,
  transitionRuntimeExecutionRecord,
} from "@/lib/agents/runtimeExecutionVerticalSliceStore";
import type {
  RuntimeExecutionAuditEvent,
  RuntimeExecutionRecord,
  RuntimeExecutionRequest,
} from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

export interface RuntimeExecutionApiMvpStore {
  create(input: RuntimeExecutionApiCreateRequest): RuntimeExecutionRecord;
  get(executionId: string): RuntimeExecutionRecord | undefined;
  list(): readonly RuntimeExecutionRecord[];
  update(record: RuntimeExecutionRecord): RuntimeExecutionRecord;
  appendAudit(event: RuntimeExecutionAuditEvent): RuntimeExecutionAuditEvent;
  getAuditEvents(executionId: string): readonly RuntimeExecutionAuditEvent[];
  getRequest(executionId: string): RuntimeExecutionRequest | undefined;
  setRequest(executionId: string, request: RuntimeExecutionRequest): void;
  snapshot(): RuntimeExecutionApiMvpStoreSnapshot;
  resetForTest(): void;
}

export function createRuntimeExecutionApiMvpStore(): RuntimeExecutionApiMvpStore {
  let requestSeq = 0;
  const records = new Map<string, RuntimeExecutionRecord>();
  const requests = new Map<string, RuntimeExecutionRequest>();
  const auditEvents: RuntimeExecutionAuditEvent[] = [];

  const nextRequestId = (): string => {
    requestSeq += 1;
    return `stage9a-req-${requestSeq}`;
  };

  return {
    create(input: RuntimeExecutionApiCreateRequest): RuntimeExecutionRecord {
      const nowIso = STAGE9_A_DEFAULT_NOW_ISO;
      const requestId = nextRequestId();
      const request: RuntimeExecutionRequest = {
        requestId,
        projectId: input.projectId.trim(),
        sourceStage: "stage_8_a",
        requestedBy: input.requestedBy,
        unitKind: "mock_runner",
        commandPreview: input.commandPreview.trim(),
        payloadPreview: input.payloadPreview,
        createdAtIso: nowIso,
        approvedForMockRun: false,
        actualExecutionRequested: false,
      };
      const record = createRuntimeExecutionRecord({ request, nowIso });
      records.set(record.executionId, record);
      requests.set(record.executionId, request);
      const event = buildRuntimeExecutionAuditEvent({
        executionId: record.executionId,
        requestId: request.requestId,
        eventType: "runtime_request_created",
        statusAfter: "requested",
        message: "Runtime execution created via Stage 9-A API.",
        nowIso,
        sequence: 0,
      });
      auditEvents.push(event);
      return record;
    },

    get(executionId: string): RuntimeExecutionRecord | undefined {
      return records.get(executionId);
    },

    list(): readonly RuntimeExecutionRecord[] {
      return [...records.values()];
    },

    update(record: RuntimeExecutionRecord): RuntimeExecutionRecord {
      records.set(record.executionId, record);
      return record;
    },

    appendAudit(event: RuntimeExecutionAuditEvent): RuntimeExecutionAuditEvent {
      auditEvents.push(event);
      return event;
    },

    getAuditEvents(executionId: string): readonly RuntimeExecutionAuditEvent[] {
      return auditEvents.filter((event) => event.executionId === executionId);
    },

    getRequest(executionId: string): RuntimeExecutionRequest | undefined {
      return requests.get(executionId);
    },

    setRequest(executionId: string, request: RuntimeExecutionRequest): void {
      requests.set(executionId, request);
    },

    snapshot(): RuntimeExecutionApiMvpStoreSnapshot {
      return {
        records: [...records.values()],
        auditEvents: [...auditEvents],
      };
    },

    resetForTest(): void {
      requestSeq = 0;
      records.clear();
      requests.clear();
      auditEvents.length = 0;
    },
  };
}

export const runtimeExecutionApiMvpStore = createRuntimeExecutionApiMvpStore();

export { transitionRuntimeExecutionRecord };

/**
 * Stage 9-A in-memory runtime execution store (Map-based; no persistence).
 */

import { buildRuntimeExecutionAuditEvent } from "@/lib/agents/runtimeExecutionVerticalSliceAudit";
import { normalizeRuntimeExecutionApiCreateRequest } from "@/lib/agents/runtimeExecutionApiMvpResponse";
import { STAGE9_A_DEFAULT_NOW_ISO } from "@/lib/agents/runtimeExecutionApiMvpConstants";
import type {
  RuntimeExecutionApiCreateRequest,
  RuntimeExecutionApiMvpStoreSnapshot,
} from "@/lib/agents/runtimeExecutionApiMvpTypes";
import {
  createRuntimeExecutionRecord,
} from "@/lib/agents/runtimeExecutionVerticalSliceStore";
import type {
  RuntimeExecutionAuditEvent,
  RuntimeExecutionRecord,
  RuntimeExecutionRequest,
} from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

export interface RuntimeExecutionApiMvpStore {
  create(input: RuntimeExecutionApiCreateRequest): RuntimeExecutionRecord;
  get(executionId: string): RuntimeExecutionRecord | undefined;
  has(executionId: string): boolean;
  list(): readonly RuntimeExecutionRecord[];
  update(record: RuntimeExecutionRecord): RuntimeExecutionRecord;
  appendAudit(event: RuntimeExecutionAuditEvent): RuntimeExecutionAuditEvent;
  getAuditEvents(executionId: string): readonly RuntimeExecutionAuditEvent[];
  getRequest(executionId: string): RuntimeExecutionRequest | undefined;
  setRequest(executionId: string, request: RuntimeExecutionRequest): void;
  getRequestCount(): number;
  getRecordCount(): number;
  getAuditEventCount(): number;
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
      const normalized = normalizeRuntimeExecutionApiCreateRequest(input);
      const nowIso = STAGE9_A_DEFAULT_NOW_ISO;
      const requestId = nextRequestId();
      const request: RuntimeExecutionRequest = {
        requestId,
        projectId: normalized.projectId,
        sourceStage: "stage_8_a",
        requestedBy: normalized.requestedBy,
        unitKind: "mock_runner",
        commandPreview: normalized.commandPreview,
        payloadPreview: normalized.payloadPreview,
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
        message: `Runtime execution created via Stage 9-A API (request #${requestSeq}).`,
        nowIso,
        sequence: 0,
      });
      auditEvents.push(event);
      return record;
    },

    get(executionId: string): RuntimeExecutionRecord | undefined {
      return records.get(executionId);
    },

    has(executionId: string): boolean {
      return records.has(executionId);
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

    getRequestCount(): number {
      return requests.size;
    },

    getRecordCount(): number {
      return records.size;
    },

    getAuditEventCount(): number {
      return auditEvents.length;
    },

    snapshot(): RuntimeExecutionApiMvpStoreSnapshot {
      return {
        records: [...records.values()],
        auditEvents: [...auditEvents],
        requestCount: requests.size,
        recordCount: records.size,
        auditEventCount: auditEvents.length,
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

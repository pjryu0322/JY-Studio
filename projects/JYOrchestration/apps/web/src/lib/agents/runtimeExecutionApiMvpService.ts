/**
 * Stage 9-A runtime execution API MVP service (in-memory only).
 */

import { approveRuntimeExecutionInMemory } from "@/lib/agents/runtimeExecutionApiMvpApproval";
import { buildRuntimeExecutionApiBoundaryReport } from "@/lib/agents/runtimeExecutionApiMvpBoundary";
import { STAGE9_A_DEFAULT_NOW_ISO } from "@/lib/agents/runtimeExecutionApiMvpConstants";
import { runRuntimeExecutionMockAdapter } from "@/lib/agents/runtimeExecutionApiMvpMockAdapter";
import {
  createRuntimeExecutionApiMvpStore,
  runtimeExecutionApiMvpStore,
  type RuntimeExecutionApiMvpStore,
} from "@/lib/agents/runtimeExecutionApiMvpStore";
import type {
  RuntimeExecutionApiAction,
  RuntimeExecutionApiCreateRequest,
  RuntimeExecutionApiMvpApprovalResult,
  RuntimeExecutionApiMvpMockRunResult,
  RuntimeExecutionApiResponse,
} from "@/lib/agents/runtimeExecutionApiMvpTypes";

export { buildRuntimeExecutionApiBoundaryReport } from "@/lib/agents/runtimeExecutionApiMvpBoundary";
import type {
  RuntimeExecutionAuditEvent,
  RuntimeExecutionRecord,
} from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

function boundary() {
  return buildRuntimeExecutionApiBoundaryReport();
}

function okResponse<T>(
  action: RuntimeExecutionApiAction,
  status: number,
  data: T,
): RuntimeExecutionApiResponse<T> {
  return { ok: true, status, action, data, boundary: boundary() };
}

function errResponse(
  action: RuntimeExecutionApiAction,
  status: number,
  code: string,
  message: string,
): RuntimeExecutionApiResponse {
  return { ok: false, status, action, error: { code, message }, boundary: boundary() };
}

function validateCreateRequest(
  request: RuntimeExecutionApiCreateRequest | undefined,
): string | null {
  if (!request?.projectId?.trim()) {
    return "projectId is required";
  }
  if (!request.commandPreview?.trim()) {
    return "commandPreview is required";
  }
  if (request.payloadPreview === undefined || request.payloadPreview === null) {
    return "payloadPreview is required";
  }
  if (request.requestedBy !== "operator" && request.requestedBy !== "system") {
    return "requestedBy must be operator or system";
  }
  return null;
}

export function createRuntimeExecutionApiMvp(input: {
  readonly store?: RuntimeExecutionApiMvpStore;
} = {}) {
  const store = input.store ?? runtimeExecutionApiMvpStore;

  return {
    createExecution(request: RuntimeExecutionApiCreateRequest): RuntimeExecutionApiResponse<RuntimeExecutionRecord> {
      const validationError = validateCreateRequest(request);
      if (validationError) {
        return errResponse("create", 400, "invalid_request", validationError);
      }
      const record = store.create(request);
      return okResponse("create", 201, record);
    },

    getExecution(executionId: string): RuntimeExecutionApiResponse<RuntimeExecutionRecord> {
      const id = executionId.trim();
      if (!id) {
        return errResponse("get", 400, "invalid_execution_id", "executionId is required");
      }
      const record = store.get(id);
      if (!record) {
        return errResponse("get", 404, "execution_not_found", `Execution not found: ${id}`);
      }
      return okResponse("get", 200, record);
    },

    listExecutions(): RuntimeExecutionApiResponse<readonly RuntimeExecutionRecord[]> {
      return okResponse("list", 200, store.list());
    },

    approveExecution(executionId: string): RuntimeExecutionApiResponse<RuntimeExecutionApiMvpApprovalResult> {
      return approveRuntimeExecutionInMemory({
        store,
        executionId,
        approvedBy: "operator",
        nowIso: STAGE9_A_DEFAULT_NOW_ISO,
      });
    },

    runMockExecution(executionId: string): RuntimeExecutionApiResponse<RuntimeExecutionApiMvpMockRunResult> {
      return runRuntimeExecutionMockAdapter({
        store,
        executionId,
        nowIso: STAGE9_A_DEFAULT_NOW_ISO,
      });
    },

    getAuditEvents(executionId: string): RuntimeExecutionApiResponse<readonly RuntimeExecutionAuditEvent[]> {
      const id = executionId.trim();
      if (!id) {
        return errResponse("audit", 400, "invalid_execution_id", "executionId is required");
      }
      if (!store.get(id)) {
        return errResponse("audit", 404, "execution_not_found", `Execution not found: ${id}`);
      }
      return okResponse("audit", 200, store.getAuditEvents(id));
    },
  };
}

export { createRuntimeExecutionApiMvpStore, runtimeExecutionApiMvpStore };

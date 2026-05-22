/**
 * Stage 9-A runtime execution API MVP service (in-memory only).
 */

import { approveRuntimeExecutionInMemory } from "@/lib/agents/runtimeExecutionApiMvpApproval";
import { buildRuntimeExecutionApiBoundaryReport } from "@/lib/agents/runtimeExecutionApiMvpBoundary";
import { STAGE9_A_DEFAULT_NOW_ISO } from "@/lib/agents/runtimeExecutionApiMvpConstants";
import { runRuntimeExecutionMockAdapter } from "@/lib/agents/runtimeExecutionApiMvpMockAdapter";
import {
  buildRuntimeExecutionApiErrorResponse,
  buildRuntimeExecutionApiOkResponse,
  normalizeRuntimeExecutionApiCreateRequest,
  validateRuntimeExecutionApiCreateRequestDetails,
} from "@/lib/agents/runtimeExecutionApiMvpResponse";
import {
  createRuntimeExecutionApiMvpStore,
  runtimeExecutionApiMvpStore,
  type RuntimeExecutionApiMvpStore,
} from "@/lib/agents/runtimeExecutionApiMvpStore";
import type {
  RuntimeExecutionApiCreateRequest,
  RuntimeExecutionApiMvpApprovalResult,
  RuntimeExecutionApiMvpMockRunResult,
  RuntimeExecutionApiResponse,
} from "@/lib/agents/runtimeExecutionApiMvpTypes";
import type {
  RuntimeExecutionAuditEvent,
  RuntimeExecutionRecord,
} from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

export { buildRuntimeExecutionApiBoundaryReport } from "@/lib/agents/runtimeExecutionApiMvpBoundary";
export {
  buildRuntimeExecutionApiOkResponse,
  buildRuntimeExecutionApiErrorResponse,
  normalizeRuntimeExecutionApiCreateRequest,
  validateRuntimeExecutionApiCreateRequest,
  validateRuntimeExecutionApiCreateRequestDetails,
} from "@/lib/agents/runtimeExecutionApiMvpResponse";

export function createRuntimeExecutionApiMvp(input: {
  readonly store?: RuntimeExecutionApiMvpStore;
} = {}) {
  const store = input.store ?? runtimeExecutionApiMvpStore;

  return {
    createExecution(request: RuntimeExecutionApiCreateRequest): RuntimeExecutionApiResponse<RuntimeExecutionRecord> {
      const validation = validateRuntimeExecutionApiCreateRequestDetails(request);
      if (!validation.valid) {
        return buildRuntimeExecutionApiErrorResponse("create", 400, "invalid_request", validation.reason);
      }
      const record = store.create(normalizeRuntimeExecutionApiCreateRequest(request));
      return buildRuntimeExecutionApiOkResponse("create", 201, record);
    },

    getExecution(executionId: string): RuntimeExecutionApiResponse<RuntimeExecutionRecord> {
      const id = executionId.trim();
      if (!id) {
        return buildRuntimeExecutionApiErrorResponse("get", 400, "invalid_execution_id", "executionId is required");
      }
      const record = store.get(id);
      if (!record) {
        return buildRuntimeExecutionApiErrorResponse("get", 404, "execution_not_found", `Execution not found: ${id}`);
      }
      return buildRuntimeExecutionApiOkResponse("get", 200, record);
    },

    listExecutions(): RuntimeExecutionApiResponse<readonly RuntimeExecutionRecord[]> {
      return buildRuntimeExecutionApiOkResponse("list", 200, store.list());
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
        return buildRuntimeExecutionApiErrorResponse("audit", 400, "invalid_execution_id", "executionId is required");
      }
      if (!store.get(id)) {
        return buildRuntimeExecutionApiErrorResponse("audit", 404, "execution_not_found", `Execution not found: ${id}`);
      }
      return buildRuntimeExecutionApiOkResponse("audit", 200, store.getAuditEvents(id));
    },
  };
}

export { createRuntimeExecutionApiMvpStore, runtimeExecutionApiMvpStore };

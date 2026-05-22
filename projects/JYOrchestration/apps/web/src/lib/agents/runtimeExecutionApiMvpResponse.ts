/**
 * Stage 9-A API response builders and request validation.
 */

import { buildRuntimeExecutionApiBoundaryReport } from "@/lib/agents/runtimeExecutionApiMvpBoundary";
import type {
  RuntimeExecutionApiAction,
  RuntimeExecutionApiCreateRequest,
  RuntimeExecutionApiResponse,
} from "@/lib/agents/runtimeExecutionApiMvpTypes";

export function validateRuntimeExecutionApiCreateRequest(
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

export function buildRuntimeExecutionApiOkResponse<T>(
  action: RuntimeExecutionApiAction,
  status: number,
  data: T,
): RuntimeExecutionApiResponse<T> {
  return {
    ok: true,
    status,
    action,
    data,
    boundary: buildRuntimeExecutionApiBoundaryReport(),
  };
}

export function buildRuntimeExecutionApiErrorResponse(
  action: RuntimeExecutionApiAction,
  status: number,
  code: string,
  message: string,
): RuntimeExecutionApiResponse {
  return {
    ok: false,
    status,
    action,
    error: { code, message },
    boundary: buildRuntimeExecutionApiBoundaryReport(),
  };
}

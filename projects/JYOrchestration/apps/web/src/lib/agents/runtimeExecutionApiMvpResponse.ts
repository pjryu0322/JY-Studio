/**
 * Stage 9-A API response builders and request validation.
 */

import {
  RUNTIME_EXECUTION_API_CREATE_COMMAND_PREVIEW_MAX,
  RUNTIME_EXECUTION_API_CREATE_PAYLOAD_PREVIEW_MAX,
  RUNTIME_EXECUTION_API_CREATE_PROJECT_ID_MAX,
} from "@/lib/agents/runtimeExecutionApiMvpConstants";
import { buildRuntimeExecutionApiBoundaryReport } from "@/lib/agents/runtimeExecutionApiMvpBoundary";
import type {
  RuntimeExecutionApiAction,
  RuntimeExecutionApiCreateRequest,
  RuntimeExecutionApiCreateRequestValidationResult,
  RuntimeExecutionApiResponse,
} from "@/lib/agents/runtimeExecutionApiMvpTypes";

export function normalizeRuntimeExecutionApiCreateRequest(
  request: Partial<RuntimeExecutionApiCreateRequest> | undefined,
): RuntimeExecutionApiCreateRequest {
  return {
    projectId: String(request?.projectId ?? "").trim(),
    commandPreview: String(request?.commandPreview ?? "").trim(),
    payloadPreview: String(request?.payloadPreview ?? "").trim(),
    requestedBy: request?.requestedBy === "system" ? "system" : "operator",
  };
}

export function validateRuntimeExecutionApiCreateRequestDetails(
  request: Partial<RuntimeExecutionApiCreateRequest> | undefined,
): RuntimeExecutionApiCreateRequestValidationResult {
  const missingFields: string[] = [];
  const invalidFields: string[] = [];
  const rawProjectId = String(request?.projectId ?? "");
  const normalized = normalizeRuntimeExecutionApiCreateRequest(request);

  if (!normalized.projectId) {
    missingFields.push("projectId");
  } else if (/\s/.test(rawProjectId) || normalized.projectId.length > RUNTIME_EXECUTION_API_CREATE_PROJECT_ID_MAX) {
    invalidFields.push("projectId");
  }

  if (!normalized.commandPreview) {
    missingFields.push("commandPreview");
  } else if (normalized.commandPreview.length > RUNTIME_EXECUTION_API_CREATE_COMMAND_PREVIEW_MAX) {
    invalidFields.push("commandPreview");
  }

  if (request?.payloadPreview === undefined || request?.payloadPreview === null) {
    missingFields.push("payloadPreview");
  } else if (!normalized.payloadPreview) {
    invalidFields.push("payloadPreview");
  } else if (normalized.payloadPreview.length > RUNTIME_EXECUTION_API_CREATE_PAYLOAD_PREVIEW_MAX) {
    invalidFields.push("payloadPreview");
  }

  if (request?.requestedBy !== undefined && request.requestedBy !== "operator" && request.requestedBy !== "system") {
    invalidFields.push("requestedBy");
  }

  const valid = missingFields.length === 0 && invalidFields.length === 0;
  const reason = valid
    ? ""
    : missingFields.length > 0
      ? `Missing fields: ${missingFields.join(", ")}`
      : `Invalid fields: ${invalidFields.join(", ")}`;

  return { valid, missingFields, invalidFields, reason };
}

export function validateRuntimeExecutionApiCreateRequest(
  request: RuntimeExecutionApiCreateRequest | undefined,
): string | null {
  const result = validateRuntimeExecutionApiCreateRequestDetails(request);
  return result.valid ? null : result.reason;
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

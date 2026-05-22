/**
 * Shared helpers for Stage 9-A API route handlers.
 */

import { NextResponse } from "next/server";
import { buildRuntimeExecutionApiErrorResponse } from "@/lib/agents/runtimeExecutionApiMvpResponse";
import { createRuntimeExecutionApiMvp } from "@/lib/agents/runtimeExecutionApiMvpService";
import type {
  RuntimeExecutionApiAction,
  RuntimeExecutionApiResponse,
} from "@/lib/agents/runtimeExecutionApiMvpTypes";

const api = createRuntimeExecutionApiMvp();

export function getRuntimeExecutionApiMvp() {
  return api;
}

export function runtimeExecutionApiJsonResponse(response: RuntimeExecutionApiResponse): NextResponse {
  return NextResponse.json(response, { status: response.status });
}

export function runtimeExecutionApiErrorJsonResponse(input: {
  readonly action: RuntimeExecutionApiAction;
  readonly status: number;
  readonly code: string;
  readonly message: string;
}): NextResponse {
  return runtimeExecutionApiJsonResponse(
    buildRuntimeExecutionApiErrorResponse(input.action, input.status, input.code, input.message),
  );
}

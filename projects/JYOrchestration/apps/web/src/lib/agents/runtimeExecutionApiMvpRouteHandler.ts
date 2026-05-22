/**
 * Shared helpers for Stage 9-A API route handlers.
 */

import { NextResponse } from "next/server";
import { createRuntimeExecutionApiMvp } from "@/lib/agents/runtimeExecutionApiMvpService";
import type { RuntimeExecutionApiResponse } from "@/lib/agents/runtimeExecutionApiMvpTypes";

const api = createRuntimeExecutionApiMvp();

export function getRuntimeExecutionApiMvp() {
  return api;
}

export function runtimeExecutionApiJsonResponse(response: RuntimeExecutionApiResponse): NextResponse {
  return NextResponse.json(response, { status: response.status });
}

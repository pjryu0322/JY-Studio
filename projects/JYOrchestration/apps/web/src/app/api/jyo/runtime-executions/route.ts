import { NextRequest } from "next/server";
import { normalizeRuntimeExecutionApiCreateRequest } from "@/lib/agents/runtimeExecutionApiMvpResponse";
import {
  getRuntimeExecutionApiMvp,
  runtimeExecutionApiErrorJsonResponse,
  runtimeExecutionApiJsonResponse,
} from "@/lib/agents/runtimeExecutionApiMvpRouteHandler";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return runtimeExecutionApiErrorJsonResponse({
      action: "create",
      status: 400,
      code: "invalid_json",
      message: "Request body must be valid JSON",
    });
  }

  const response = getRuntimeExecutionApiMvp().createExecution(
    normalizeRuntimeExecutionApiCreateRequest(
      body as Parameters<typeof normalizeRuntimeExecutionApiCreateRequest>[0],
    ),
  );
  return runtimeExecutionApiJsonResponse(response);
}

export async function GET() {
  return runtimeExecutionApiJsonResponse(getRuntimeExecutionApiMvp().listExecutions());
}

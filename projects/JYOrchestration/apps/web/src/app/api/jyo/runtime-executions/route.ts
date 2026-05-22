import { NextRequest } from "next/server";
import type { RuntimeExecutionApiCreateRequest } from "@/lib/agents/runtimeExecutionApiMvpTypes";
import {
  getRuntimeExecutionApiMvp,
  runtimeExecutionApiJsonResponse,
} from "@/lib/agents/runtimeExecutionApiMvpRouteHandler";

export async function POST(request: NextRequest) {
  let body: Partial<RuntimeExecutionApiCreateRequest>;
  try {
    body = (await request.json()) as Partial<RuntimeExecutionApiCreateRequest>;
  } catch {
    return runtimeExecutionApiJsonResponse({
      ok: false,
      status: 400,
      action: "create",
      error: { code: "invalid_json", message: "Request body must be valid JSON" },
      boundary: {
        inMemoryOnly: true,
        actualExternalExecutionAllowed: false,
        actualCursorGithubCallAllowed: false,
        actualConnectorGatewayCallAllowed: false,
        actualDbWriteAllowed: false,
        actualSchemaMigrationAllowed: false,
        actualUiMutationAllowed: false,
      },
    });
  }

  const response = getRuntimeExecutionApiMvp().createExecution({
    projectId: String(body.projectId ?? ""),
    commandPreview: String(body.commandPreview ?? ""),
    payloadPreview: body.payloadPreview === undefined ? "" : String(body.payloadPreview),
    requestedBy: body.requestedBy === "system" ? "system" : "operator",
  });
  return runtimeExecutionApiJsonResponse(response);
}

export async function GET() {
  return runtimeExecutionApiJsonResponse(getRuntimeExecutionApiMvp().listExecutions());
}

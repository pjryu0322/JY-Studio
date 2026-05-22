import { runtimeExecutionApiJsonResponse, getRuntimeExecutionApiMvp } from "@/lib/agents/runtimeExecutionApiMvpRouteHandler";

export async function POST(
  _request: Request,
  segmentData: { params: Promise<{ executionId: string }> },
) {
  const { executionId } = await segmentData.params;
  return runtimeExecutionApiJsonResponse(getRuntimeExecutionApiMvp().approveExecution(String(executionId ?? "")));
}

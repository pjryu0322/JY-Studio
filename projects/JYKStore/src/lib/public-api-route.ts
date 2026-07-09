import { NextRequest, type NextResponse } from "next/server";
import {
  createPublicApiContext,
  internalServerErrorResponse,
  recordPublicApiUsage,
  requireContextReadApiKey,
  requireQuota,
  type PublicApiContext,
} from "@/lib/public-api-handler";
import { logSafeRouteError } from "@/lib/safe-logging";

export type PublicApiRouteScope = "retrieval" | "graph" | "context";

export async function withPublicApiGateway(input: {
  request: NextRequest;
  scope: PublicApiRouteScope;
  handler: (context: PublicApiContext) => Promise<Response | NextResponse>;
}): Promise<Response | NextResponse> {
  const context = createPublicApiContext(input.request);
  const { requestId } = context;

  try {
    const auth = await requireContextReadApiKey(context);
    if (!auth.ok) return auth.response;

    const quota = await requireQuota(context);
    if (!quota.ok) return quota.response;

    return await input.handler(context);
  } catch (error) {
    logSafeRouteError({
      scope: input.scope,
      method: context.method,
      path: context.endpoint,
      requestId,
      error,
    });

    await recordPublicApiUsage(context, {
      statusCode: 500,
      metadata: { error: "INTERNAL_SERVER_ERROR" },
    });

    return internalServerErrorResponse(requestId);
  }
}

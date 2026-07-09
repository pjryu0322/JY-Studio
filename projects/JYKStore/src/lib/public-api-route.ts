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

export type PublicApiGatewayOverrides = {
  requireContextReadApiKey?: typeof requireContextReadApiKey;
  requireQuota?: typeof requireQuota;
  recordPublicApiUsage?: typeof recordPublicApiUsage;
};

export async function withPublicApiGateway(input: {
  request: NextRequest;
  scope: PublicApiRouteScope;
  handler: (context: PublicApiContext) => Promise<Response | NextResponse>;
  overrides?: PublicApiGatewayOverrides;
}): Promise<Response | NextResponse> {
  const context = createPublicApiContext(input.request);
  const { requestId } = context;
  const recordUsage = input.overrides?.recordPublicApiUsage ?? recordPublicApiUsage;

  try {
    const auth = await (input.overrides?.requireContextReadApiKey ?? requireContextReadApiKey)(context);
    if (!auth.ok) return auth.response;

    const quota = await (input.overrides?.requireQuota ?? requireQuota)(context);
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

    await recordUsage(context, {
      statusCode: 500,
      metadata: { error: "INTERNAL_SERVER_ERROR" },
    });

    return internalServerErrorResponse(requestId);
  }
}

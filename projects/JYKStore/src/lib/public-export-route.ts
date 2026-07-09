import { NextRequest } from "next/server";
import { createRequestId } from "@/lib/api-usage-service";
import {
  publicExportNotFound,
  publicExportServerError,
  recordPublicExportUsage,
  resolvePublicExportRequest,
} from "@/lib/public-export-request";
import { logSafeRouteError } from "@/lib/safe-logging";

export function createPublicExportRoute<T>(input: {
  scope?: "export";
  build: (packId: string) => Promise<T | null>;
  metadata: (data: T) => Record<string, unknown>;
  response: (data: T, packId: string) => Response;
}) {
  return async function GET(request: NextRequest) {
    const startedAt = Date.now();
    const requestId = createRequestId();
    const endpoint = request.nextUrl.pathname;
    const method = request.method;

    try {
      const resolved = await resolvePublicExportRequest(request, requestId, startedAt);
      if (!resolved.ok) return resolved.response;

      const { apiKeyId, clientId, packId, quota } = resolved;
      const data = await input.build(packId);

      if (!data) {
        await recordPublicExportUsage({
          requestId,
          apiKeyId,
          clientId,
          packId,
          endpoint,
          method,
          statusCode: 404,
          latencyMs: Date.now() - startedAt,
          quota,
          metadata: { reason: "PACK_NOT_FOUND", packId },
        });
        return publicExportNotFound(requestId);
      }

      await recordPublicExportUsage({
        requestId,
        apiKeyId,
        clientId,
        packId,
        endpoint,
        method,
        statusCode: 200,
        latencyMs: Date.now() - startedAt,
        quota,
        metadata: input.metadata(data),
      });

      return input.response(data, packId);
    } catch (error) {
      logSafeRouteError({
        scope: input.scope ?? "export",
        method,
        path: endpoint,
        requestId,
        error,
      });
      return publicExportServerError(requestId);
    }
  };
}

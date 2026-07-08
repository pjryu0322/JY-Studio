import { NextRequest } from "next/server";
import { createRequestId, recordApiUsage } from "@/lib/api-usage-service";
import { buildPackageExport } from "@/lib/knowledge-export-service";
import {
  publicExportNotFound,
  publicExportServerError,
  resolvePublicExportRequest,
} from "@/lib/public-export-request";
import { logSafeRouteError } from "@/lib/safe-logging";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = createRequestId();
  const endpoint = request.nextUrl.pathname;
  const method = request.method;

  try {
    const resolved = await resolvePublicExportRequest(request, requestId, startedAt);
    if (!resolved.ok) return resolved.response;

    const { apiKeyId, packId } = resolved;
    const data = await buildPackageExport(packId);
    if (!data) {
      await recordApiUsage({
        requestId,
        apiKeyId,
        packId,
        endpoint,
        method,
        statusCode: 404,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: "PACK_NOT_FOUND", packId },
      });
      return publicExportNotFound(requestId);
    }

    await recordApiUsage({
      requestId,
      apiKeyId,
      packId,
      endpoint,
      method,
      statusCode: 200,
      latencyMs: Date.now() - startedAt,
      metadata: { exportType: data.exportType, chunkCount: data.chunks.length },
    });

    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="jykstore-${packId}-package.json"`,
      },
    });
  } catch (error) {
    logSafeRouteError({
      scope: "export",
      method,
      path: endpoint,
      requestId,
      error,
    });
    return publicExportServerError(requestId);
  }
}

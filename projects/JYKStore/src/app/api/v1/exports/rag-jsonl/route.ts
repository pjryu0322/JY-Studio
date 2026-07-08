import { NextRequest } from "next/server";
import { createRequestId } from "@/lib/api-usage-service";
import { buildRagJsonlExport } from "@/lib/knowledge-export-service";
import {
  publicExportNotFound,
  publicExportServerError,
  recordPublicExportUsage,
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

    const { apiKeyId, clientId, packId, quota } = resolved;
    const jsonl = await buildRagJsonlExport(packId);
    if (jsonl === null) {
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
      metadata: {
        exportType: "JYKSTORE_RAG_JSONL",
        lineCount: jsonl ? jsonl.split("\n").filter(Boolean).length : 0,
      },
    });

    return new Response(jsonl, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Content-Disposition": `attachment; filename="jykstore-${packId}-rag.jsonl"`,
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

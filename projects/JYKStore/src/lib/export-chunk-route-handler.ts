import { NextRequest, NextResponse } from "next/server";
import { createRequestId, recordApiUsage } from "@/lib/api-usage-service";
import {
  parseExportChunkRequestFromSearchParams,
  type ExportChunkKind,
} from "@/lib/export-chunk-dto";
import { buildExportChunk, ExportChunkRangeError } from "@/lib/export-chunk-service";
import { apiErrorResponse } from "@/lib/public-api-handler";
import {
  publicExportNotFound,
  publicExportServerError,
  resolvePublicExportRequest,
} from "@/lib/public-export-request";
import { logSafeRouteError } from "@/lib/safe-logging";

export async function handleExportChunkRequest(
  request: NextRequest,
  exportType: ExportChunkKind,
): Promise<NextResponse> {
  const startedAt = Date.now();
  const requestId = createRequestId();
  const endpoint = request.nextUrl.pathname;
  const method = request.method;

  try {
    const resolved = await resolvePublicExportRequest(request, requestId, startedAt);
    if (!resolved.ok) return resolved.response;

    const parsed = parseExportChunkRequestFromSearchParams(request.nextUrl.searchParams);
    if (!parsed.ok) {
      await recordApiUsage({
        requestId,
        apiKeyId: resolved.apiKeyId,
        packId: resolved.packId,
        endpoint,
        method,
        statusCode: 400,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: "INVALID_EXPORT_CHUNK_REQUEST", errors: parsed.errors },
      });
      return apiErrorResponse(
        requestId,
        "INVALID_EXPORT_CHUNK_REQUEST",
        parsed.errors.join(" "),
        400,
      );
    }

    // Prefer auth-resolved packId (same source as full export); keep parse for offset/limitBytes.
    const { offset, limitBytes } = parsed.request;
    const knowledgePackId = resolved.packId;

    let chunk;
    try {
      chunk = await buildExportChunk({
        knowledgePackId,
        exportType,
        offset,
        limitBytes,
        requestId,
      });
    } catch (error) {
      if (error instanceof ExportChunkRangeError) {
        await recordApiUsage({
          requestId,
          apiKeyId: resolved.apiKeyId,
          packId: knowledgePackId,
          endpoint,
          method,
          statusCode: 400,
          latencyMs: Date.now() - startedAt,
          metadata: { reason: "INVALID_EXPORT_CHUNK_REQUEST", code: error.code },
        });
        return apiErrorResponse(
          requestId,
          "INVALID_EXPORT_CHUNK_REQUEST",
          error.message,
          400,
        );
      }
      throw error;
    }

    if (chunk === null) {
      await recordApiUsage({
        requestId,
        apiKeyId: resolved.apiKeyId,
        packId: knowledgePackId,
        endpoint,
        method,
        statusCode: 404,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: "PACK_NOT_FOUND", packId: knowledgePackId },
      });
      return publicExportNotFound(requestId);
    }

    await recordApiUsage({
      requestId,
      apiKeyId: resolved.apiKeyId,
      packId: knowledgePackId,
      endpoint,
      method,
      statusCode: 200,
      latencyMs: Date.now() - startedAt,
      query: `export:${exportType}:chunk`,
      metadata: {
        exportType,
        chunked: true,
        offset: chunk.offset,
        limitBytes: chunk.limitBytes,
        byteLength: chunk.byteLength,
        hasMore: chunk.hasMore,
      },
    });

    return NextResponse.json(chunk, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-JYKStore-Export-Type": exportType,
        "X-JYKStore-Chunk-Offset": String(chunk.offset),
        "X-JYKStore-Chunk-Next-Offset": String(chunk.nextOffset),
        "X-JYKStore-Chunk-Has-More": String(chunk.hasMore),
        "X-JYKStore-Chunk-Total-Bytes": String(chunk.totalBytes),
      },
    });
  } catch (error) {
    logSafeRouteError({
      scope: "export-chunk",
      method,
      path: endpoint,
      requestId,
      error,
    });
    return publicExportServerError(requestId);
  }
}

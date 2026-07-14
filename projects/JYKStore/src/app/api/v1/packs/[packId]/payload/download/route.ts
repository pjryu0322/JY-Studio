import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { logSafeRouteError } from "@/lib/safe-logging";
import { createRequestId, recordApiUsage } from "@/lib/api-usage-service";
import { buildContentDisposition } from "@/lib/distribution/content-disposition";
import { enforcePublicPayloadDownloadQuota } from "@/lib/distribution/payload-download-quota";
import { isPayloadServiceError } from "@/lib/distribution/payload-errors";
import { openPublicCatalogSourceOriginalStream } from "@/lib/distribution/payload-service";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

function cacheControlForVisibility(visibility: string): string {
  if (visibility === "PUBLIC") return "private, max-age=60";
  return "private, no-store";
}

function toWebReadable(stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream) {
  if (typeof (stream as ReadableStream).getReader === "function") {
    return stream as ReadableStream<Uint8Array>;
  }
  return Readable.toWeb(stream as Readable) as ReadableStream<Uint8Array>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { packId } = await context.params;
  const startedAt = Date.now();
  const requestId = createRequestId();
  let tenantKey: string | null = null;

  try {
    const quota = await enforcePublicPayloadDownloadQuota(request);
    tenantKey = quota.tenantKey;

    const result = await openPublicCatalogSourceOriginalStream({
      packId: packId?.trim() ?? "",
    });

    await recordApiUsage({
      requestId,
      apiKeyId: null,
      clientId: tenantKey,
      packId: packId?.trim() ?? undefined,
      endpoint: "/api/v1/packs/:packId/payload/download",
      method: "GET",
      target: "PAYLOAD_DOWNLOAD",
      statusCode: 200,
      latencyMs: Date.now() - startedAt,
      metadata: {
        action: "PAYLOAD_DOWNLOAD",
        payloadId: result.payloadId,
        bytes: result.fileSize,
        checksumSha256: result.checksumSha256,
        artifactKind: result.artifactKind,
        mimeType: result.mimeType,
        result: "ok",
        actorType: "anonymous",
        streamed: true,
      },
    });

    return new NextResponse(toWebReadable(result.stream), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Length": String(result.fileSize),
        "Content-Disposition": buildContentDisposition(result.originalFileName),
        "X-JYKStore-SHA256": result.checksumSha256,
        "Cache-Control": cacheControlForVisibility(result.visibility),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (isPayloadServiceError(error)) {
      const retryAfterSeconds =
        error.code === "PAYLOAD_DOWNLOAD_QUOTA_EXCEEDED"
          ? (error as unknown as { retryAfterSeconds?: number }).retryAfterSeconds
          : undefined;
      const retryAfter =
        typeof retryAfterSeconds === "number" ? String(retryAfterSeconds) : undefined;

      await recordApiUsage({
        requestId,
        apiKeyId: null,
        clientId: tenantKey,
        packId: packId?.trim() ?? undefined,
        endpoint: "/api/v1/packs/:packId/payload/download",
        method: "GET",
        target: "PAYLOAD_DOWNLOAD",
        statusCode: error.httpStatus,
        latencyMs: Date.now() - startedAt,
        metadata: {
          action: "PAYLOAD_DOWNLOAD",
          result: "error",
          code: error.code,
          actorType: "anonymous",
        },
      }).catch(() => undefined);

      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        {
          status: error.httpStatus,
          headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
        },
      );
    }
    logSafeRouteError({
      scope: "public-route",
      method: "GET",
      path: "/api/v1/packs/[packId]/payload/download",
      error,
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 },
    );
  }
}

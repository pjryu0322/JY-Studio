import { NextRequest } from "next/server";
import { Readable } from "node:stream";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  prepareProviderDownloadTest,
  recordSuccessfulDownloadTestEvidence,
} from "@/lib/distribution/service-validation-confirmation-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string; runId: string }> };

function toWebReadable(stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream) {
  if (typeof (stream as ReadableStream).getReader === "function") {
    return stream as ReadableStream<Uint8Array>;
  }
  return Readable.toWeb(stream as Readable) as ReadableStream<Uint8Array>;
}

/**
 * Provider download-test: open object stream first, then record immutable evidence, then stream body.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, runId } = await context.params;
  const packIdTrim = packId?.trim() ?? "";
  const runIdTrim = runId?.trim() ?? "";
  let preparedStream: Readable | null = null;
  try {
    const prepared = await prepareProviderDownloadTest({
      userId,
      clientId,
      packId: packIdTrim,
      runId: runIdTrim,
    });
    preparedStream = prepared.stream;

    const headers = new Headers();
    headers.set("Content-Type", prepared.mimeType || "application/octet-stream");
    headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(prepared.fileName)}`,
    );
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-JYK-Download-Test", "1");
    if (prepared.contentLength > 0) {
      headers.set("Content-Length", String(prepared.contentLength));
    }

    const evidence = await recordSuccessfulDownloadTestEvidence({
      userId,
      runId: prepared.runId,
      fileId: prepared.fileId,
    });

    await recordProviderAudit({
      action: evidence.created
        ? "SERVICE_VALIDATION_DOWNLOAD_TEST_SUCCEEDED"
        : "SERVICE_VALIDATION_DOWNLOAD_TEST_RETRIED",
      entityType: "ServiceValidationRun",
      entityId: prepared.runId,
      actorUserId: userId,
      metadata: {
        packId: prepared.packId,
        versionId: prepared.versionId,
        runId: prepared.runId,
        channel: "DOWNLOAD",
        userId,
        fileId: prepared.fileId,
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(toWebReadable(prepared.stream), {
      status: 200,
      headers,
    });
  } catch (error) {
    preparedStream?.destroy?.();
    if (error instanceof PayloadServiceError) {
      await recordProviderAudit({
        action: "SERVICE_VALIDATION_DOWNLOAD_TEST_FAILED",
        entityType: "ServiceValidationRun",
        entityId: runIdTrim || "unknown",
        actorUserId: userId,
        metadata: {
          packId: packIdTrim,
          runId: runIdTrim,
          channel: "DOWNLOAD",
          userId,
          failureCode: error.code,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => undefined);
      return jsonWithClientIdCookie(
        { error: error.code, message: error.message },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "provider/service-validation/download-test",
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/service-validation/[runId]/download-test",
      error,
    });
    await recordProviderAudit({
      action: "SERVICE_VALIDATION_DOWNLOAD_TEST_FAILED",
      entityType: "ServiceValidationRun",
      entityId: runIdTrim || "unknown",
      actorUserId: userId,
      metadata: {
        packId: packIdTrim,
        runId: runIdTrim,
        channel: "DOWNLOAD",
        userId,
        failureCode: "INTERNAL",
        timestamp: new Date().toISOString(),
      },
    }).catch(() => undefined);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}

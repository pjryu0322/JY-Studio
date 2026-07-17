import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { recordDownloadTestEvidence } from "@/lib/distribution/service-validation-confirmation-service";
import { downloadDoclingImportFile } from "@/lib/docling-import/docling-import-service";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string; runId: string }> };

/**
 * Starts a provider download-test stream and records evidence for confirmation gate.
 * Reuses docling file download without exposing object keys.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, runId } = await context.params;
  try {
    const evidence = await recordDownloadTestEvidence({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      runId: runId?.trim() ?? "",
    });
    const downloaded = await downloadDoclingImportFile({
      packId: packId?.trim() ?? "",
      fileId: evidence.fileId,
      userId,
      clientId,
      asAdmin: false,
    });
    const headers = new Headers();
    headers.set("Content-Type", downloaded.mimeType || "application/octet-stream");
    headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(downloaded.fileName)}`,
    );
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-JYK-Download-Test", "1");
    if (typeof downloaded.contentLength === "number") {
      headers.set("Content-Length", String(downloaded.contentLength));
    }
    return new Response(Buffer.from(downloaded.bytes), {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof PayloadServiceError) {
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
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}

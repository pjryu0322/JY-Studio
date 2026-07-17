import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { requireOwnedRunForPreview } from "@/lib/distribution/service-validation-confirmation-service";
import {
  resolveSourceOriginalForValidationResult,
  streamInlinePdfResponse,
} from "@/lib/distribution/service-validation-source-preview";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = {
  params: Promise<{ packId: string; runId: string; rank: string }>;
};

/**
 * Inline PDF stream bound to a service-validation ResultItem (run + rank + version).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, runId, rank: rankRaw } = await context.params;
  try {
    const rank = Number.parseInt(rankRaw ?? "", 10);
    if (!Number.isInteger(rank) || rank < 1) {
      return jsonWithClientIdCookie(
        { error: "INVALID_RANK", message: "rank가 올바르지 않습니다." },
        clientId,
        { status: 400 },
      );
    }
    const packIdTrim = packId?.trim() ?? "";
    const runIdTrim = runId?.trim() ?? "";
    await requireOwnedRunForPreview({
      userId,
      clientId,
      packId: packIdTrim,
      runId: runIdTrim,
      rank,
    });
    const resolved = await resolveSourceOriginalForValidationResult({
      packId: packIdTrim,
      runId: runIdTrim,
      rank,
    });
    return await streamInlinePdfResponse({
      storageKey: resolved.storageKey,
      fileName: resolved.fileName,
      mimeType: resolved.mimeType,
      fileSize: resolved.fileSize,
      rangeHeader: request.headers.get("range"),
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
      scope: "provider/service-validation/source-file",
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/service-validation/[runId]/results/[rank]/source-file",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}

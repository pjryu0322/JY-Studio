import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { confirmServiceValidationRun } from "@/lib/distribution/service-validation-confirmation-service";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string; runId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, runId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await confirmServiceValidationRun({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      runId: runId?.trim() ?? "",
      retrieval: {
        relevanceConfirmed: body.relevanceConfirmed === true,
        contentConfirmed: body.contentConfirmed === true,
        sourceConfirmed: body.sourceConfirmed === true,
        isolationConfirmed: body.isolationConfirmed === true,
      },
      download: {
        fileNameConfirmed: body.fileNameConfirmed === true,
        downloadOkConfirmed: body.downloadOkConfirmed === true,
        fileMatchConfirmed: body.fileMatchConfirmed === true,
      },
    });
    return jsonWithClientIdCookie({ clientId, ...result }, clientId);
  } catch (error) {
    if (error instanceof PayloadServiceError) {
      return jsonWithClientIdCookie(
        { error: error.code, message: error.message },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "provider/service-validation/confirm",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/service-validation/[runId]/confirm",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}

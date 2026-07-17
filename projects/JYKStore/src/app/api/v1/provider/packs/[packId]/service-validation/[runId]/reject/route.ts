import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { rejectServiceValidationRun } from "@/lib/distribution/service-validation-confirmation-service";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string; runId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, runId } = await context.params;
  try {
    const body = (await request.json()) as { rejectionReason?: string; comment?: string };
    const result = await rejectServiceValidationRun({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      runId: runId?.trim() ?? "",
      rejectionReason: body.rejectionReason ?? "",
      comment: body.comment,
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
      scope: "provider/service-validation/reject",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/service-validation/[runId]/reject",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}

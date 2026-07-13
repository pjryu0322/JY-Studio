import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { upsertAdminPackDistribution } from "@/lib/distribution/distribution-metadata-service";
import { isPayloadServiceError } from "@/lib/distribution/payload-errors";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminAuth = await requireAdminSession(request, clientId);
  if (!adminAuth.ok) {
    return jsonWithClientIdCookie(
      { error: { code: adminAuth.code, message: adminAuth.message } },
      clientId,
      { status: adminAuth.status },
    );
  }
  const { packId } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await upsertAdminPackDistribution({
      packId: packId?.trim() ?? "",
      actorUserId: adminAuth.adminUserId,
      body: {
        sourceTitle: typeof body.sourceTitle === "string" ? body.sourceTitle : null,
        sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
        licenseName: typeof body.licenseName === "string" ? body.licenseName : "",
        licenseUrl: typeof body.licenseUrl === "string" ? body.licenseUrl : null,
        usageTerms: typeof body.usageTerms === "string" ? body.usageTerms : null,
        readmeText: typeof body.readmeText === "string" ? body.readmeText : null,
        visibility: typeof body.visibility === "string" ? body.visibility : "PRIVATE",
        allowDownload: body.allowDownload !== false,
      },
    });
    return jsonWithClientIdCookie({ clientId, distribution: result.distribution }, clientId);
  } catch (error) {
    if (isPayloadServiceError(error)) {
      return jsonWithClientIdCookie(
        { error: error.message, code: error.code },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "admin-route",
      method: "PATCH",
      path: "/api/v1/admin/reviews/[packId]/distribution-metadata",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

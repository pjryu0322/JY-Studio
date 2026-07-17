import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { listAdminServiceValidationHistory } from "@/lib/distribution/service-validation-service";
import { isPayloadServiceError } from "@/lib/distribution/payload-errors";
import { recordProviderAudit } from "@/lib/provider-audit";
import { logSafeRouteError } from "@/lib/safe-logging";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
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
  const packIdTrim = packId?.trim() ?? "";
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  const channelRaw = (url.searchParams.get("channel") ?? "").toUpperCase();
  const channel =
    channelRaw === "API" || channelRaw === "MCP" || channelRaw === "DOWNLOAD"
      ? (channelRaw as ServiceChannel)
      : null;
  try {
    const result = await listAdminServiceValidationHistory({
      packId: packIdTrim,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
      channel,
      systemStatus: url.searchParams.get("systemStatus"),
      providerConfirmationStatus: url.searchParams.get("providerConfirmationStatus"),
      dateFrom: url.searchParams.get("dateFrom"),
      dateTo: url.searchParams.get("dateTo"),
      versionId: url.searchParams.get("versionId"),
      versionScope: (() => {
        const raw = (url.searchParams.get("versionScope") ?? "").toUpperCase();
        return raw === "LATEST" || raw === "ALL" ? raw : null;
      })(),
    });
    await recordProviderAudit({
      action: "ADMIN_SERVICE_VALIDATION_HISTORY_VIEWED",
      entityType: "KnowledgePack",
      entityId: packIdTrim,
      actorUserId: adminAuth.adminUserId,
      metadata: {
        packId: packIdTrim,
        page: Number.isFinite(page) ? page : 1,
        channel,
        systemStatus: url.searchParams.get("systemStatus"),
        providerConfirmationStatus: url.searchParams.get("providerConfirmationStatus"),
        dateFrom: url.searchParams.get("dateFrom"),
        dateTo: url.searchParams.get("dateTo"),
        versionId: url.searchParams.get("versionId"),
        versionScope: url.searchParams.get("versionScope"),
        timestamp: new Date().toISOString(),
      },
    }).catch(() => undefined);
    return jsonWithClientIdCookie({ clientId, packId: packIdTrim, ...result }, clientId);
  } catch (error) {
    if (isPayloadServiceError(error)) {
      return jsonWithClientIdCookie(
        { error: error.code, message: error.message },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "admin/reviews/service-validation",
      method: "GET",
      path: "/api/v1/admin/reviews/[packId]/service-validation",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}

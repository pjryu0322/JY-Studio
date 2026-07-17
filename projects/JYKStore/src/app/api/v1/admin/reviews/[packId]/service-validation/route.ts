import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";
import { listAdminServiceValidationHistory } from "@/lib/distribution/service-validation-service";
import { isPayloadServiceError } from "@/lib/distribution/payload-errors";
import { logSafeRouteError } from "@/lib/safe-logging";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId } = await context.params;
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
      packId: packId?.trim() ?? "",
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
      channel,
      systemStatus: url.searchParams.get("systemStatus"),
      providerConfirmationStatus: url.searchParams.get("providerConfirmationStatus"),
      dateFrom: url.searchParams.get("dateFrom"),
      dateTo: url.searchParams.get("dateTo"),
    });
    return jsonWithClientIdCookie({ clientId, packId: packId?.trim() ?? "", ...result }, clientId);
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

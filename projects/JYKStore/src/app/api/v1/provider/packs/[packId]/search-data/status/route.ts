import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";
import { getSearchDataStatus } from "@/lib/search-data/search-data-generation-service";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const result = await getSearchDataStatus({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
    });
    if ("error" in result) {
      const status = result.error === "NOT_FOUND" ? 404 : 403;
      return jsonWithClientIdCookie({ error: result.error }, clientId, { status });
    }
    return jsonWithClientIdCookie({ clientId, ...result }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "provider/search-data/status",
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/search-data/status",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}

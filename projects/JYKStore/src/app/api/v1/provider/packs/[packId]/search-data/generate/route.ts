import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";
import { startSearchDataGeneration } from "@/lib/search-data/search-data-generation-service";

type RouteContext = { params: Promise<{ packId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  let forceRegenerate = false;
  try {
    const body = (await request.json()) as { forceRegenerate?: unknown };
    forceRegenerate = body?.forceRegenerate === true;
  } catch {
    forceRegenerate = false;
  }

  try {
    const result = await startSearchDataGeneration({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      forceRegenerate,
    });
    if ("error" in result) {
      const status =
        result.error === "NOT_FOUND"
          ? 404
          : result.error === "PROFILE_REQUIRED"
            ? 403
            : 400;
      return jsonWithClientIdCookie(
        {
          error: result.error,
          message: "message" in result ? result.message : undefined,
          code: "code" in result ? result.code : result.error,
        },
        clientId,
        { status },
      );
    }
    if ("accepted" in result && result.accepted) {
      return jsonWithClientIdCookie({ clientId, ...result }, clientId, { status: 202 });
    }
    return jsonWithClientIdCookie({ clientId, ...result }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "provider/search-data/generate",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/search-data/generate",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}

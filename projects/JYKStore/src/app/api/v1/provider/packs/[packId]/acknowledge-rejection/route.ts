/**
 * Provider: acknowledge Admin pack-review rejection (unlocks editing).
 */
import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { acknowledgeProviderPackRejection } from "@/lib/provider-pack/provider-pack-review-submit-service";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const result = await acknowledgeProviderPackRejection(userId, clientId, packId?.trim() ?? "");
    if ("error" in result) {
      const status =
        result.error === "NOT_FOUND" || result.error === "PROFILE_REQUIRED"
          ? 404
          : result.error === "NO_REJECTION"
            ? 404
            : 409;
      return jsonWithClientIdCookie({ error: result.error, code: result.error }, clientId, {
        status,
      });
    }
    return jsonWithClientIdCookie({ clientId, ...result }, clientId, { status: 200 });
  } catch (error) {
    logSafeRouteError({
      scope: "provider/acknowledge-rejection",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/acknowledge-rejection",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      clientId,
      { status: 500 },
    );
  }
}

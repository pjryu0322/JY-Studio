import { NextRequest } from "next/server";
import { isLoggedInResponse, requireLoggedInRequest } from "@/lib/auth-guard";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { removePackInstallationForClient } from "@/lib/my-packs-service";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = requireLoggedInRequest(request);
  if (!isLoggedInResponse(auth)) return auth;
  const { clientId } = auth;

  try {
    const { packId } = await context.params;
    const normalizedPackId = packId?.trim();

    if (!normalizedPackId) {
      return jsonWithClientIdCookie({ error: "packId가 필요합니다." }, clientId, { status: 400 });
    }

    await removePackInstallationForClient(clientId, normalizedPackId);

    return jsonWithClientIdCookie({ ok: true as const }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "my-packs-route", method: "DELETE", path: "/api/v1/my-packs/[packId]", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

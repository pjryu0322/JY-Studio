import { NextRequest } from "next/server";
import { revokeApiKeyForClient } from "@/lib/api-key-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = {
  params: Promise<{ keyId: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);

  try {
    const { keyId } = await context.params;
    const normalizedKeyId = keyId?.trim();

    if (!normalizedKeyId) {
      return jsonWithClientIdCookie({ error: "keyId가 필요합니다." }, clientId, { status: 400 });
    }

    const result = await revokeApiKeyForClient({ clientId, keyId: normalizedKeyId });

    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "API Key를 찾을 수 없습니다." }, clientId, { status: 404 });
    }

    return jsonWithClientIdCookie({ ok: true as const, apiKey: result.apiKey }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "api-key",
      method: "DELETE",
      path: "/api/v1/api-keys/[keyId]",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

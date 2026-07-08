import { NextRequest } from "next/server";
import { revokeApiKeyAdmin } from "@/lib/api-key-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";

type RouteContext = {
  params: Promise<{ apiKeyId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);

  try {
    const { apiKeyId } = await context.params;
    const normalized = apiKeyId?.trim();
    if (!normalized) {
      return jsonWithClientIdCookie({ error: "apiKeyId가 필요합니다." }, clientId, { status: 400 });
    }

    const result = await revokeApiKeyAdmin({
      apiKeyId: normalized,
      actor: clientId,
    });

    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "API Key를 찾을 수 없습니다." }, clientId, {
        status: 404,
      });
    }

    return jsonWithClientIdCookie({ apiKey: result.apiKey }, clientId);
  } catch (error) {
    console.error("POST /api/v1/admin/api-keys/[apiKeyId]/revoke failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

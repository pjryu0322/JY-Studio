import { NextRequest } from "next/server";
import { createApiKeyForClient, listApiKeysForClient } from "@/lib/api-key-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { logSafeRouteError } from "@/lib/safe-logging";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);

  try {
    const items = await listApiKeysForClient(clientId);
    return jsonWithClientIdCookie({ clientId, items }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "api-key",
      method: "GET",
      path: "/api/v1/api-keys",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const clientId = ensureClientId(request);

  try {
    const body = (await request.json()) as {
      name?: string;
      scopes?: string[];
      expiresAt?: string | null;
    };
    const name = body.name?.trim() ?? "";

    if (!name) {
      return jsonWithClientIdCookie({ error: "이름이 필요합니다." }, clientId, { status: 400 });
    }

    const result = await createApiKeyForClient({
      clientId,
      name,
      scopes: body.scopes,
      expiresAt: body.expiresAt,
    });

    if (result.error === "INVALID_NAME") {
      return jsonWithClientIdCookie({ error: "이름이 필요합니다." }, clientId, { status: 400 });
    }

    if (result.error === "NAME_TOO_LONG") {
      return jsonWithClientIdCookie({ error: "이름이 너무 깁니다." }, clientId, { status: 400 });
    }

    if (result.error === "INVALID_EXPIRES_AT") {
      return jsonWithClientIdCookie({ error: "만료일이 올바르지 않습니다." }, clientId, {
        status: 400,
      });
    }

    return jsonWithClientIdCookie(
      {
        clientId,
        rawKey: result.rawKey,
        apiKey: result.apiKey,
      },
      clientId,
    );
  } catch (error) {
    logSafeRouteError({
      scope: "api-key",
      method: "POST",
      path: "/api/v1/api-keys",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

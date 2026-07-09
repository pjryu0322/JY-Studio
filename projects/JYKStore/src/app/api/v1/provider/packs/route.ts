import { NextRequest } from "next/server";
import { isLoggedInResponse, requireLoggedInRequest } from "@/lib/auth-guard";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import {
  createProviderPackForClient,
  listProviderPacksForClient,
} from "@/lib/provider-pack-service";

export async function GET(request: NextRequest) {
  const auth = requireLoggedInRequest(request);
  if (!isLoggedInResponse(auth)) return auth;
  const { clientId, userId } = auth;

  try {
    const items = await listProviderPacksForClient(userId, clientId);
    return jsonWithClientIdCookie({ clientId, items }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "provider-route", method: "GET", path: "/api/v1/provider/packs", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireLoggedInRequest(request);
  if (!isLoggedInResponse(auth)) return auth;
  const { clientId, userId } = auth;

  try {
    const body = (await request.json()) as {
      packId?: string;
      name?: string;
      categoryId?: string;
      shortDescription?: string;
      description?: string;
      tags?: string[];
      version?: string;
    };

    const result = await createProviderPackForClient(userId, clientId, {
      packId: body.packId ?? "",
      name: body.name ?? "",
      categoryId: body.categoryId ?? "",
      shortDescription: body.shortDescription ?? "",
      description: body.description ?? "",
      tags: body.tags,
      version: body.version,
    });

    if (result.error === "PROFILE_REQUIRED") {
      return jsonWithClientIdCookie(
        { error: "제공자 프로필을 먼저 등록해 주세요." },
        clientId,
        { status: 403 },
      );
    }
    if (result.error === "PACK_ID_EXISTS") {
      return jsonWithClientIdCookie({ error: "이미 사용 중인 packId입니다." }, clientId, {
        status: 409,
      });
    }
    if (result.error === "CATEGORY_NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "카테고리를 찾을 수 없습니다." }, clientId, {
        status: 400,
      });
    }
    if (result.error === "VALIDATION") {
      return jsonWithClientIdCookie({ error: result.message }, clientId, { status: 400 });
    }

    return jsonWithClientIdCookie({ clientId, pack: result.pack }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "provider-route", method: "POST", path: "/api/v1/provider/packs", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

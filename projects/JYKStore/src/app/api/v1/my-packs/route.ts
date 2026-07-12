import { NextRequest } from "next/server";
import { isLoggedInResponse, requireLoggedInRequest } from "@/lib/auth-guard";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { addPackInstallationForClient, listActiveMyPacksForClient } from "@/lib/my-packs-service";

export async function GET(request: NextRequest) {
  const auth = requireLoggedInRequest(request);
  if (!isLoggedInResponse(auth)) return auth;
  const { clientId } = auth;

  try {
    const items = await listActiveMyPacksForClient(clientId);
    return jsonWithClientIdCookie({ clientId, items }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "my-packs-route", method: "GET", path: "/api/v1/my-packs", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireLoggedInRequest(request);
  if (!isLoggedInResponse(auth)) return auth;
  const { clientId } = auth;

  try {
    const body = (await request.json()) as { packId?: string };
    const packId = body.packId?.trim();

    if (!packId) {
      return jsonWithClientIdCookie({ error: "packId가 필요합니다." }, clientId, { status: 400 });
    }

    const result = await addPackInstallationForClient(clientId, packId);

    if (result.error === "NOT_FOUND" || result.error === "NOT_INSTALLABLE") {
      return jsonWithClientIdCookie(
        { error: "설치 가능한 지식팩을 찾을 수 없습니다." },
        clientId,
        { status: 404 },
      );
    }

    if (result.error === "NOT_PUBLISHED") {
      return jsonWithClientIdCookie(
        { error: "공개 또는 검증된 지식팩만 내 지식팩에 추가할 수 있습니다." },
        clientId,
        { status: 409 },
      );
    }

    return jsonWithClientIdCookie({ clientId, item: result.pack }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "my-packs-route", method: "POST", path: "/api/v1/my-packs", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

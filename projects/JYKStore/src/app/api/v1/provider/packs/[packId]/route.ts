import { PackPricing } from "@prisma/client";
import { logSafeRouteError } from "@/lib/safe-logging";
import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import {
  getProviderPackForClient,
  updateProviderPackForClient,
} from "@/lib/provider-pack-service";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const pack = await getProviderPackForClient(userId, clientId, packId?.trim() ?? "");
    if (!pack) {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    return jsonWithClientIdCookie({ clientId, pack }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "provider-route", method: "GET", path: "/api/v1/provider/packs/[packId]", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const body = (await request.json()) as {
      name?: string;
      categoryId?: string;
      shortDescription?: string;
      description?: string;
      tags?: string[];
      icon?: string;
      pricing?: PackPricing;
      versionOverview?: string;
      versionFeatures?: string[];
      versionIncludedKnowledge?: string[];
      versionSupportedEnvironments?: string[];
      versionTargetUsers?: string[];
      versionUseCases?: string[];
      versionSummary?: string;
      language?: "ko" | "en" | null;
    };

    const result = await updateProviderPackForClient(userId, clientId, packId?.trim() ?? "", body);

    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    if (result.error === "NOT_EDITABLE") {
      return jsonWithClientIdCookie(
        { error: "초안(DRAFT) 상태에서만 수정할 수 있습니다." },
        clientId,
        { status: 409 },
      );
    }
    if (result.error === "CATEGORY_NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "카테고리를 찾을 수 없습니다." }, clientId, { status: 400 });
    }
    if (result.error === "PACK_LANGUAGE_INVALID") {
      return jsonWithClientIdCookie(
        { error: "문서 언어는 ko 또는 en만 선택할 수 있습니다.", code: "PACK_LANGUAGE_INVALID" },
        clientId,
        { status: 400 },
      );
    }

    return jsonWithClientIdCookie({ clientId, pack: result.pack }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "provider-route", method: "PATCH", path: "/api/v1/provider/packs/[packId]", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

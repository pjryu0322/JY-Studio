import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import {
  getDoclingUploadPolicy,
  toUploadPolicyDto,
} from "@/lib/docling-import/docling-upload-policy";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId } = auth;
  await context.params;

  try {
    const policy = getDoclingUploadPolicy();
    return jsonWithClientIdCookie(
      { clientId, policy: toUploadPolicyDto(policy) },
      clientId,
    );
  } catch (error) {
    logSafeRouteError({
      scope: "provider-route",
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/docling-import/upload-policy",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}

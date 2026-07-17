import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";

type RouteContext = { params: Promise<{ packId: string; fileId: string }> };

/**
 * Legacy fileId preview is retired. Use run/rank source-file route instead.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  await context.params;
  return jsonWithClientIdCookie(
    {
      error: "GONE",
      message:
        "이 미리보기 URL은 더 이상 지원되지 않습니다. 검증 결과의 원문 위치 확인을 사용해 주세요.",
    },
    auth.clientId,
    { status: 410 },
  );
}

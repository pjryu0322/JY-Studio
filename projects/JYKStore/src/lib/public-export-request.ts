import { NextRequest, NextResponse } from "next/server";
import {
  apiErrorResponse,
  internalServerErrorResponse,
  packNotFoundResponse,
  recordPublicApiUsage,
  requireContextReadApiKey,
  requireQuota,
  toPublicApiContext,
} from "@/lib/public-api-handler";

type ResolveSuccess = {
  ok: true;
  apiKeyId: string;
  clientId: string | null;
  packId: string;
};
type ResolveFailure = { ok: false; response: NextResponse };

/**
 * 외부 AI/Agent/플랫폼이 호출하는 public export API의 공통 인증/검증 처리.
 * - Bearer API Key(context:read scope) 인증
 * - clientId 기준 quota gate
 * - knowledgePackId query parameter 검증 (없거나 빈 문자열이면 400)
 * 인증/검증 실패 시 usage log를 남기고 error response를 반환한다.
 *
 * R1: 공통 로직은 public-api-handler로 위임한다(동작/응답 동일).
 */
export async function resolvePublicExportRequest(
  request: NextRequest,
  requestId: string,
  startedAt: number,
): Promise<ResolveSuccess | ResolveFailure> {
  const context = toPublicApiContext(request, requestId, startedAt);

  const auth = await requireContextReadApiKey(context);
  if (!auth.ok) {
    return { ok: false, response: auth.response };
  }

  const quota = await requireQuota(context);
  if (!quota.ok) {
    return { ok: false, response: quota.response };
  }

  const rawPackId = request.nextUrl.searchParams.get("knowledgePackId");
  const packId = rawPackId?.trim() ?? "";
  if (!packId) {
    await recordPublicApiUsage(context, {
      statusCode: 400,
      metadata: { reason: "INVALID_EXPORT_REQUEST" },
    });
    return {
      ok: false,
      response: apiErrorResponse(
        requestId,
        "INVALID_EXPORT_REQUEST",
        "knowledgePackId query parameter is required.",
        400,
      ),
    };
  }

  return {
    ok: true,
    apiKeyId: auth.apiKeyId,
    clientId: auth.clientId,
    packId,
  };
}

export function publicExportNotFound(requestId: string) {
  return packNotFoundResponse(requestId);
}

export function publicExportServerError(requestId: string) {
  return internalServerErrorResponse(requestId);
}

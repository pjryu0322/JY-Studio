import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, requireApiKeyScope } from "@/lib/api-key-auth";
import { recordApiUsage } from "@/lib/api-usage-service";

type ResolveSuccess = { ok: true; apiKeyId: string; packId: string };
type ResolveFailure = { ok: false; response: NextResponse };

function simpleError(requestId: string, code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message }, usage: { requestId } }, { status });
}

/**
 * 외부 AI/Agent/플랫폼이 호출하는 public export API의 공통 인증/검증 처리.
 * - Bearer API Key(context:read scope) 인증
 * - knowledgePackId query parameter 검증 (없거나 빈 문자열이면 400)
 * 인증/검증 실패 시 usage log를 남기고 error response를 반환한다.
 */
export async function resolvePublicExportRequest(
  request: NextRequest,
  requestId: string,
  startedAt: number,
): Promise<ResolveSuccess | ResolveFailure> {
  const endpoint = request.nextUrl.pathname;
  const method = request.method;

  const auth = requireApiKeyScope(await authenticateApiKey(request), "context:read");
  if (!auth.ok) {
    const code = auth.status === 403 ? "FORBIDDEN" : "UNAUTHORIZED";
    await recordApiUsage({
      requestId,
      apiKeyId: null,
      endpoint,
      method,
      statusCode: auth.status,
      latencyMs: Date.now() - startedAt,
      metadata: { reason: code },
    });
    return { ok: false, response: simpleError(requestId, code, auth.error, auth.status) };
  }

  const rawPackId = request.nextUrl.searchParams.get("knowledgePackId");
  const packId = rawPackId?.trim() ?? "";
  if (!packId) {
    await recordApiUsage({
      requestId,
      apiKeyId: auth.apiKeyId,
      endpoint,
      method,
      statusCode: 400,
      latencyMs: Date.now() - startedAt,
      metadata: { reason: "INVALID_EXPORT_REQUEST" },
    });
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "INVALID_EXPORT_REQUEST",
            message: "knowledgePackId query parameter is required.",
          },
          usage: { requestId },
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, apiKeyId: auth.apiKeyId, packId };
}

export function publicExportNotFound(requestId: string) {
  return NextResponse.json(
    {
      error: { code: "PACK_NOT_FOUND", message: "지식팩을 찾을 수 없습니다." },
      usage: { requestId },
    },
    { status: 404 },
  );
}

export function publicExportServerError(requestId: string) {
  return NextResponse.json(
    {
      error: { code: "INTERNAL_SERVER_ERROR", message: "서버 오류가 발생했습니다." },
      usage: { requestId },
    },
    { status: 500 },
  );
}

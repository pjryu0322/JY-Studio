import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, requireApiKeyScope } from "@/lib/api-key-auth";
import { createRequestId, recordApiUsage } from "@/lib/api-usage-service";

// 외부 AI/Agent/플랫폼이 호출하는 Public API route의 공통 처리 helper.
// 동작/응답/인증 정책은 기존 route와 동일하게 유지한다.

export type PublicApiContext = {
  request: NextRequest;
  requestId: string;
  startedAt: number;
  endpoint: string;
  method: string;
  apiKeyId: string | null;
  packId?: string;
};

export type PublicApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_JSON"
  | "INVALID_RETRIEVAL_REQUEST"
  | "INVALID_GRAPH_QUERY_REQUEST"
  | "INVALID_EXPORT_REQUEST"
  | "PACK_NOT_FOUND"
  | "INTERNAL_SERVER_ERROR";

export function createPublicApiContext(request: NextRequest): PublicApiContext {
  return {
    request,
    requestId: createRequestId(),
    startedAt: Date.now(),
    endpoint: request.nextUrl.pathname,
    method: request.method,
    apiKeyId: null,
  };
}

/**
 * 명시적 requestId/startedAt로 context를 구성한다.
 * (기존 route가 자체적으로 requestId/startedAt를 관리하는 경우 호환용)
 */
export function toPublicApiContext(
  request: NextRequest,
  requestId: string,
  startedAt: number,
): PublicApiContext {
  return {
    request,
    requestId,
    startedAt,
    endpoint: request.nextUrl.pathname,
    method: request.method,
    apiKeyId: null,
  };
}

export function apiErrorResponse(
  requestId: string,
  code: PublicApiErrorCode | string,
  message: string,
  status: number,
  details?: string[],
): NextResponse {
  const error: Record<string, unknown> = { code, message };
  if (details) error.details = details;
  return NextResponse.json({ error, usage: { requestId } }, { status });
}

export function validationErrorResponse(
  requestId: string,
  code: PublicApiErrorCode | string,
  message: string,
  details: string[],
): NextResponse {
  return apiErrorResponse(requestId, code, message, 400, details);
}

export function packNotFoundResponse(requestId: string): NextResponse {
  return apiErrorResponse(requestId, "PACK_NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
}

export function internalServerErrorResponse(requestId: string): NextResponse {
  return apiErrorResponse(requestId, "INTERNAL_SERVER_ERROR", "서버 오류가 발생했습니다.", 500);
}

export async function recordPublicApiUsage(
  context: PublicApiContext,
  input: {
    statusCode: number;
    query?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await recordApiUsage({
    requestId: context.requestId,
    apiKeyId: context.apiKeyId,
    packId: context.packId,
    endpoint: context.endpoint,
    method: context.method,
    query: input.query,
    statusCode: input.statusCode,
    latencyMs: Date.now() - context.startedAt,
    metadata: input.metadata,
  });
}

/**
 * Bearer API Key + context:read scope 인증.
 * 실패 시 usage log를 남기고 error response를 반환한다.
 * 성공 시 context.apiKeyId를 세팅한다.
 */
export async function requireContextReadApiKey(
  context: PublicApiContext,
): Promise<{ ok: true; apiKeyId: string } | { ok: false; response: NextResponse }> {
  const auth = requireApiKeyScope(await authenticateApiKey(context.request), "context:read");
  if (!auth.ok) {
    const code: PublicApiErrorCode = auth.status === 403 ? "FORBIDDEN" : "UNAUTHORIZED";
    await recordPublicApiUsage(context, { statusCode: auth.status, metadata: { reason: code } });
    return { ok: false, response: apiErrorResponse(context.requestId, code, auth.error, auth.status) };
  }
  context.apiKeyId = auth.apiKeyId;
  return { ok: true, apiKeyId: auth.apiKeyId };
}

export async function parseJsonBodySafe<T>(
  request: NextRequest,
): Promise<{ ok: true; body: T } | { ok: false }> {
  try {
    return { ok: true, body: (await request.json()) as T };
  } catch {
    return { ok: false };
  }
}

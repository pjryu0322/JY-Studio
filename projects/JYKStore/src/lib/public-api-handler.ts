import { NextRequest, NextResponse } from "next/server";
import {
  authenticateApiKey,
  type PublicApiKeyErrorCode,
} from "@/lib/api-key-auth";
import { PUBLIC_API_REQUIRED_SCOPE } from "@/lib/api-key-service";
import { createRequestId, recordApiUsage } from "@/lib/api-usage-service";
import {
  checkQuota,
  type QuotaCheckResult,
} from "@/lib/quota-service";
import { buildQuotaUsageMetadata } from "@/lib/quota-metadata";

export { buildQuotaUsageMetadata } from "@/lib/quota-metadata";

// 외부 AI/Agent/플랫폼이 호출하는 Public API route의 공통 처리 helper.

export type PublicApiContext = {
  request: NextRequest;
  requestId: string;
  startedAt: number;
  endpoint: string;
  method: string;
  apiKeyId: string | null;
  clientId: string | null;
  packId?: string;
  quota?: QuotaCheckResult;
};

export type PublicApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "API_KEY_REVOKED"
  | "API_KEY_EXPIRED"
  | "INSUFFICIENT_SCOPE"
  | "QUOTA_EXCEEDED"
  | "INVALID_JSON"
  | "INVALID_RETRIEVAL_REQUEST"
  | "INVALID_GRAPH_QUERY_REQUEST"
  | "INVALID_EXPORT_REQUEST"
  | "PACK_NOT_FOUND"
  | "PACK_CONTEXT_NOT_READY"
  | "PACK_RETRIEVAL_NOT_READY"
  | "PACK_MCP_NOT_READY"
  | "INTERNAL_SERVER_ERROR";

export function mapAuthFailureToPublicCode(
  code: PublicApiKeyErrorCode,
): Extract<
  PublicApiErrorCode,
  "UNAUTHORIZED" | "FORBIDDEN" | "API_KEY_REVOKED" | "API_KEY_EXPIRED" | "INSUFFICIENT_SCOPE"
> {
  return code;
}

export function createPublicApiContext(request: NextRequest): PublicApiContext {
  return {
    request,
    requestId: createRequestId(),
    startedAt: Date.now(),
    endpoint: request.nextUrl.pathname,
    method: request.method,
    apiKeyId: null,
    clientId: null,
  };
}

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
    clientId: null,
  };
}

export function apiErrorResponse(
  requestId: string,
  code: PublicApiErrorCode | string,
  message: string,
  status: number,
  details?: string[],
  extra?: {
    reason?: string;
    hint?: string;
    retryAfterSeconds?: number;
    quota?: Record<string, unknown>;
  },
): NextResponse {
  const error: Record<string, unknown> = { code, message };
  if (details) error.details = details;
  if (extra?.reason) error.reason = extra.reason;
  if (extra?.hint) error.hint = extra.hint;
  if (typeof extra?.retryAfterSeconds === "number") {
    error.retryAfterSeconds = extra.retryAfterSeconds;
  }
  const usage: Record<string, unknown> = { requestId };
  if (extra?.quota) usage.quota = extra.quota;
  const headers: Record<string, string> = {};
  if (typeof extra?.retryAfterSeconds === "number") {
    headers["Retry-After"] = String(extra.retryAfterSeconds);
  }
  return NextResponse.json({ error, usage }, { status, headers });
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
  const quotaMeta =
    context.quota && context.quota.ok
      ? buildQuotaUsageMetadata(context.quota)
      : context.quota && !context.quota.ok
        ? {
            reason: "QUOTA_EXCEEDED",
            quotaReason: context.quota.reason,
            quotaMinuteCount: context.quota.usage.minuteCount,
            quotaDayCount: context.quota.usage.dayCount,
            quotaPerMinuteLimit: context.quota.usage.perMinuteLimit,
            quotaPerDayLimit: context.quota.usage.perDayLimit,
          }
        : {};

  await recordApiUsage({
    requestId: context.requestId,
    apiKeyId: context.apiKeyId,
    clientId: context.clientId,
    packId: context.packId,
    endpoint: context.endpoint,
    method: context.method,
    query: input.query,
    statusCode: input.statusCode,
    latencyMs: Date.now() - context.startedAt,
    metadata: { ...quotaMeta, ...input.metadata },
  });
}

export async function requireContextReadApiKey(
  context: PublicApiContext,
): Promise<{ ok: true; apiKeyId: string; clientId: string | null } | { ok: false; response: NextResponse }> {
  const auth = await authenticateApiKey(context.request, {
    requiredScope: PUBLIC_API_REQUIRED_SCOPE,
    requestId: context.requestId,
  });
  if (!auth.ok) {
    const code = mapAuthFailureToPublicCode(auth.code);
    await recordPublicApiUsage(context, {
      statusCode: auth.status,
      metadata: { reason: code },
    });
    return {
      ok: false,
      response: apiErrorResponse(context.requestId, code, auth.error, auth.status),
    };
  }
  context.apiKeyId = auth.apiKeyId;
  context.clientId = auth.clientId;
  return { ok: true, apiKeyId: auth.apiKeyId, clientId: auth.clientId };
}

/**
 * Quota gate after successful API key auth.
 * Does not run when apiKeyId is missing.
 */
export async function requireQuota(
  context: PublicApiContext,
): Promise<{ ok: true; quota: QuotaCheckResult } | { ok: false; response: NextResponse }> {
  if (!context.apiKeyId) {
    await recordPublicApiUsage(context, {
      statusCode: 500,
      metadata: { reason: "INTERNAL_SERVER_ERROR", detail: "missing_api_key_for_quota" },
    });
    return {
      ok: false,
      response: internalServerErrorResponse(context.requestId),
    };
  }

  const quota = await checkQuota({
    clientId: context.clientId,
    apiKeyId: context.apiKeyId,
    endpoint: context.endpoint,
    method: context.method,
  });
  context.quota = quota;

  if (!quota.ok) {
    await recordPublicApiUsage(context, {
      statusCode: 429,
      metadata: {
        reason: "QUOTA_EXCEEDED",
        quotaReason: quota.reason,
      },
    });
    return {
      ok: false,
      response: apiErrorResponse(
        context.requestId,
        "QUOTA_EXCEEDED",
        quota.message,
        429,
        undefined,
        {
          reason: quota.reason,
          retryAfterSeconds: quota.retryAfterSeconds,
          quota: {
            minuteCount: quota.usage.minuteCount,
            perMinuteLimit: quota.usage.perMinuteLimit,
            dayCount: quota.usage.dayCount,
            perDayLimit: quota.usage.perDayLimit,
          },
        },
      ),
    };
  }

  return { ok: true, quota };
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

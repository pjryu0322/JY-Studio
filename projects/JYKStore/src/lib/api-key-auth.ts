import { ApiKeyStatus, type AuditAction, Prisma } from "@prisma/client";
import { getApiKeyPrefix, hashApiKey, safeCompareHash } from "@/lib/api-key-crypto";
import { prisma } from "@/lib/prisma";

export type PublicApiKeyErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "API_KEY_REVOKED"
  | "API_KEY_EXPIRED"
  | "INSUFFICIENT_SCOPE";

export type ApiKeyAuthResult =
  | { ok: true; apiKeyId: string; clientId: string | null; scopes: string[] }
  | {
      ok: false;
      status: 401 | 403;
      code: PublicApiKeyErrorCode;
      error: string;
    };

export function hasRequiredScope(scopes: readonly string[], requiredScope: string) {
  return scopes.includes("*") || scopes.includes(requiredScope);
}

export function requireApiKeyScope(
  auth: ApiKeyAuthResult,
  requiredScope: string,
): ApiKeyAuthResult {
  if (!auth.ok) {
    return auth;
  }
  if (!hasRequiredScope(auth.scopes, requiredScope)) {
    return {
      ok: false,
      status: 403,
      code: "INSUFFICIENT_SCOPE",
      error: `'${requiredScope}' scope가 필요합니다.`,
    };
  }
  return auth;
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match?.[1]) return null;
  return match[1].trim();
}

async function writeAuthAudit(input: {
  action: AuditAction;
  entityId: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}): Promise<void> {
  try {
    const metadata: Prisma.InputJsonValue | undefined = input.metadata
      ? Object.fromEntries(
          Object.entries(input.metadata).filter(([, value]) => value !== undefined),
        )
      : undefined;
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: "ApiKey",
        entityId: input.entityId,
        metadata,
      },
    });
  } catch {
    // Auth path must not fail if audit write fails.
  }
}

/**
 * Verify a raw API key string (Bearer token value).
 * Does not accept Authorization headers — use authenticateApiKey for Request.
 */
export async function verifyApiKey(input: {
  rawKey: string | null | undefined;
  requiredScope?: string;
  requestId?: string;
}): Promise<ApiKeyAuthResult> {
  const token = input.rawKey?.trim() ?? "";
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      error: "API Key가 필요합니다.",
    };
  }

  if (!token.startsWith("jyk_live_")) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      error: "유효하지 않은 API Key 형식입니다.",
    };
  }

  const keyPrefix = getApiKeyPrefix(token);
  const tokenHash = hashApiKey(token);

  const candidates = await prisma.apiKey.findMany({
    where: { keyPrefix },
  });

  const matched = candidates.find((row) => safeCompareHash(tokenHash, row.keyHash));
  if (!matched) {
    await writeAuthAudit({
      action: "API_KEY_VERIFY_FAILED",
      entityId: keyPrefix,
      metadata: {
        reason: "UNKNOWN_KEY",
        keyPrefix,
        requestId: input.requestId,
      },
    });
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      error: "API Key를 확인할 수 없습니다.",
    };
  }

  const now = new Date();

  if (matched.status === ApiKeyStatus.REVOKED || matched.revokedAt) {
    await writeAuthAudit({
      action: "API_KEY_VERIFY_FAILED",
      entityId: matched.id,
      metadata: {
        reason: "REVOKED",
        keyPrefix: matched.keyPrefix,
        requestId: input.requestId,
      },
    });
    return {
      ok: false,
      status: 403,
      code: "API_KEY_REVOKED",
      error: "폐기된 API Key입니다.",
    };
  }

  const isExpired =
    matched.status === ApiKeyStatus.EXPIRED ||
    (matched.expiresAt != null && matched.expiresAt.getTime() <= now.getTime());

  if (isExpired) {
    if (matched.status !== ApiKeyStatus.EXPIRED) {
      await prisma.apiKey
        .update({
          where: { id: matched.id },
          data: { status: ApiKeyStatus.EXPIRED },
        })
        .catch(() => undefined);
    }
    await writeAuthAudit({
      action: "API_KEY_EXPIRED",
      entityId: matched.id,
      metadata: {
        reason: "EXPIRED",
        keyPrefix: matched.keyPrefix,
        requestId: input.requestId,
      },
    });
    return {
      ok: false,
      status: 403,
      code: "API_KEY_EXPIRED",
      error: "만료된 API Key입니다.",
    };
  }

  if (input.requiredScope && !hasRequiredScope(matched.scopes, input.requiredScope)) {
    await writeAuthAudit({
      action: "API_KEY_SCOPE_DENIED",
      entityId: matched.id,
      metadata: {
        reason: "INSUFFICIENT_SCOPE",
        requiredScope: input.requiredScope,
        keyPrefix: matched.keyPrefix,
        requestId: input.requestId,
      },
    });
    return {
      ok: false,
      status: 403,
      code: "INSUFFICIENT_SCOPE",
      error: `'${input.requiredScope}' scope가 필요합니다.`,
    };
  }

  await prisma.apiKey.update({
    where: { id: matched.id },
    data: { lastUsedAt: now },
  });

  return {
    ok: true,
    apiKeyId: matched.id,
    clientId: matched.clientId,
    scopes: [...matched.scopes],
  };
}

export async function authenticateApiKey(
  request: Request,
  options?: { requiredScope?: string; requestId?: string },
): Promise<ApiKeyAuthResult> {
  return verifyApiKey({
    rawKey: extractBearerToken(request),
    requiredScope: options?.requiredScope,
    requestId: options?.requestId,
  });
}

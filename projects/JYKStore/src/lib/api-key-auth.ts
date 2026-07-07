import { ApiKeyStatus } from "@prisma/client";
import { getApiKeyPrefix, hashApiKey, safeCompareHash } from "@/lib/api-key-crypto";
import { prisma } from "@/lib/prisma";

export type ApiKeyAuthResult =
  | { ok: true; apiKeyId: string; clientId: string | null; scopes: string[] }
  | { ok: false; status: 401 | 403; error: string };

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match?.[1]) return null;
  return match[1].trim();
}

export async function authenticateApiKey(request: Request): Promise<ApiKeyAuthResult> {
  const token = extractBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, error: "API Key가 필요합니다." };
  }

  if (!token.startsWith("jyk_live_")) {
    return { ok: false, status: 401, error: "유효하지 않은 API Key 형식입니다." };
  }

  const keyPrefix = getApiKeyPrefix(token);
  const tokenHash = hashApiKey(token);

  const candidates = await prisma.apiKey.findMany({
    where: {
      keyPrefix,
      status: ApiKeyStatus.ACTIVE,
    },
  });

  const matched = candidates.find((row) => safeCompareHash(tokenHash, row.keyHash));
  if (!matched) {
    return { ok: false, status: 401, error: "API Key를 확인할 수 없습니다." };
  }

  await prisma.apiKey.update({
    where: { id: matched.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    ok: true,
    apiKeyId: matched.id,
    clientId: matched.clientId,
    scopes: [...matched.scopes],
  };
}

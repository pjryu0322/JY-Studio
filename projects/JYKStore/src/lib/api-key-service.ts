import { ApiKeyStatus } from "@prisma/client";
import { createPlainApiKey, getApiKeyPrefix, hashApiKey } from "@/lib/api-key-crypto";
import { toApiKeyDto } from "@/lib/api-key-dto";
import { prisma } from "@/lib/prisma";

export const DEFAULT_API_KEY_SCOPES = ["packs:read", "context:read", "usage:write"] as const;

const MAX_API_KEY_NAME_LENGTH = 80;

export async function listApiKeysForClient(clientId: string) {
  const rows = await prisma.apiKey.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toApiKeyDto);
}

export async function createApiKeyForClient(input: {
  clientId: string;
  name: string;
  scopes?: string[];
}) {
  const name = input.name.trim();
  if (!name) {
    return { error: "INVALID_NAME" as const };
  }
  if (name.length > MAX_API_KEY_NAME_LENGTH) {
    return { error: "NAME_TOO_LONG" as const };
  }

  const scopes =
    input.scopes && input.scopes.length > 0 ? [...input.scopes] : [...DEFAULT_API_KEY_SCOPES];

  const plainKey = createPlainApiKey();
  const keyPrefix = getApiKeyPrefix(plainKey);
  const keyHash = hashApiKey(plainKey);

  const apiKey = await prisma.apiKey.create({
    data: {
      clientId: input.clientId,
      name,
      keyPrefix,
      keyHash,
      scopes,
      status: ApiKeyStatus.ACTIVE,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "API_KEY_CREATE",
      entityType: "ApiKey",
      entityId: apiKey.id,
      metadata: { clientId: input.clientId, keyPrefix, scopes },
    },
  });

  return {
    plainKey,
    apiKey: toApiKeyDto(apiKey),
  };
}

export async function revokeApiKeyForClient(input: { clientId: string; keyId: string }) {
  const existing = await prisma.apiKey.findFirst({
    where: {
      id: input.keyId,
      clientId: input.clientId,
    },
  });

  if (!existing) {
    return { error: "NOT_FOUND" as const };
  }

  if (existing.status === ApiKeyStatus.REVOKED) {
    return { apiKey: toApiKeyDto(existing) };
  }

  const apiKey = await prisma.apiKey.update({
    where: { id: existing.id },
    data: {
      status: ApiKeyStatus.REVOKED,
      revokedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "API_KEY_REVOKE",
      entityType: "ApiKey",
      entityId: apiKey.id,
      metadata: { clientId: input.clientId, keyPrefix: apiKey.keyPrefix },
    },
  });

  return { apiKey: toApiKeyDto(apiKey) };
}

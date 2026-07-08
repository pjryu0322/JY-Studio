import { ApiKeyStatus } from "@prisma/client";
import { createPlainApiKey, getApiKeyPrefix, hashApiKey } from "@/lib/api-key-crypto";
import { toApiKeyDto, type ApiKeyDto } from "@/lib/api-key-dto";
import { prisma } from "@/lib/prisma";

export const DEFAULT_API_KEY_SCOPES = ["packs:read", "context:read", "usage:write"] as const;

/** Primary Public API / MCP scope (A안: context:read covers retrieval/graph/exports). */
export const PUBLIC_API_REQUIRED_SCOPE = "context:read" as const;

const MAX_API_KEY_NAME_LENGTH = 80;

export type ApiKeySafeRecord = ApiKeyDto;

function parseOptionalExpiresAt(value: unknown): Date | null | { error: "INVALID_EXPIRES_AT" } {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" && !(value instanceof Date)) {
    return { error: "INVALID_EXPIRES_AT" };
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { error: "INVALID_EXPIRES_AT" };
  }
  return date;
}

export async function listApiKeysForClient(
  clientId: string,
  options?: { includeRevoked?: boolean },
) {
  const rows = await prisma.apiKey.findMany({
    where: {
      clientId,
      ...(options?.includeRevoked === false
        ? { status: ApiKeyStatus.ACTIVE, revokedAt: null }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toApiKeyDto(row));
}

export async function listApiKeysAdmin(input?: {
  status?: "ACTIVE" | "REVOKED" | "EXPIRED";
  clientId?: string;
  take?: number;
}): Promise<ApiKeySafeRecord[]> {
  const take = Math.min(Math.max(input?.take ?? 100, 1), 500);
  const rows = await prisma.apiKey.findMany({
    where: {
      ...(input?.clientId ? { clientId: input.clientId } : {}),
      ...(input?.status === "REVOKED"
        ? { OR: [{ status: ApiKeyStatus.REVOKED }, { revokedAt: { not: null } }] }
        : input?.status === "EXPIRED"
          ? {
              OR: [
                { status: ApiKeyStatus.EXPIRED },
                { expiresAt: { lte: new Date() }, status: { not: ApiKeyStatus.REVOKED } },
              ],
            }
          : input?.status === "ACTIVE"
            ? {
                status: ApiKeyStatus.ACTIVE,
                revokedAt: null,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              }
            : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((row) => toApiKeyDto(row));
}

export async function createApiKeyForClient(input: {
  clientId: string;
  name: string;
  scopes?: string[];
  expiresAt?: string | Date | null;
}) {
  const name = input.name.trim();
  if (!name) {
    return { error: "INVALID_NAME" as const };
  }
  if (name.length > MAX_API_KEY_NAME_LENGTH) {
    return { error: "NAME_TOO_LONG" as const };
  }

  const expiresParsed = parseOptionalExpiresAt(input.expiresAt);
  if (expiresParsed && "error" in expiresParsed) {
    return { error: "INVALID_EXPIRES_AT" as const };
  }

  const scopes =
    input.scopes && input.scopes.length > 0 ? [...input.scopes] : [...DEFAULT_API_KEY_SCOPES];

  if (!scopes.includes(PUBLIC_API_REQUIRED_SCOPE) && !scopes.includes("*")) {
    scopes.push(PUBLIC_API_REQUIRED_SCOPE);
  }

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
      expiresAt: expiresParsed,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "API_KEY_CREATE",
      entityType: "ApiKey",
      entityId: apiKey.id,
      metadata: {
        clientId: input.clientId,
        keyPrefix,
        scopes,
        expiresAt: apiKey.expiresAt?.toISOString() ?? null,
      },
    },
  });

  return {
    plainKey,
    rawKey: plainKey,
    apiKey: toApiKeyDto(apiKey),
  };
}

export async function revokeApiKeyForClient(input: {
  clientId: string;
  keyId: string;
  actor?: string;
}) {
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
      metadata: {
        clientId: input.clientId,
        keyPrefix: apiKey.keyPrefix,
        actor: input.actor,
      },
    },
  });

  return { apiKey: toApiKeyDto(apiKey) };
}

export async function revokeApiKeyAdmin(input: { apiKeyId: string; actor?: string }) {
  const existing = await prisma.apiKey.findUnique({
    where: { id: input.apiKeyId },
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
      metadata: {
        clientId: apiKey.clientId,
        keyPrefix: apiKey.keyPrefix,
        actor: input.actor ?? "admin",
        via: "admin",
      },
    },
  });

  return { apiKey: toApiKeyDto(apiKey) };
}

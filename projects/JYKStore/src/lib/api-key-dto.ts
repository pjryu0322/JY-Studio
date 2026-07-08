import type { ApiKey, ApiKeyStatus } from "@prisma/client";
import { maskApiKey } from "@/lib/api-key-crypto";

export type ApiKeyDtoStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

export type ApiKeyDto = {
  id: string;
  name: string;
  keyPrefix: string;
  maskedKey: string;
  scopes: string[];
  status: ApiKeyDtoStatus;
  clientId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
};

function formatDateTime(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateTimeFull(date: Date): string {
  return date.toISOString();
}

export function resolveApiKeyDisplayStatus(
  row: Pick<ApiKey, "status" | "expiresAt" | "revokedAt">,
  now: Date = new Date(),
): ApiKeyDtoStatus {
  if (row.status === "REVOKED" || row.revokedAt) {
    return "REVOKED";
  }
  if (row.status === "EXPIRED") {
    return "EXPIRED";
  }
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) {
    return "EXPIRED";
  }
  return "ACTIVE";
}

export function toApiKeyDto(row: ApiKey, now: Date = new Date()): ApiKeyDto {
  const status = resolveApiKeyDisplayStatus(row, now);
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    maskedKey: maskApiKey(row.keyPrefix),
    scopes: [...row.scopes],
    status,
    clientId: row.clientId,
    createdAt: formatDateTime(row.createdAt),
    lastUsedAt: row.lastUsedAt ? formatDateTimeFull(row.lastUsedAt) : null,
    revokedAt: row.revokedAt ? formatDateTimeFull(row.revokedAt) : null,
    expiresAt: row.expiresAt ? formatDateTimeFull(row.expiresAt) : null,
  };
}

export function apiKeyStatusLabel(status: ApiKeyDtoStatus): string {
  switch (status) {
    case "REVOKED":
      return "폐기됨";
    case "EXPIRED":
      return "만료됨";
    default:
      return "사용 중";
  }
}

export function toApiKeyStatus(status: ApiKeyStatus): ApiKeyDtoStatus {
  if (status === "REVOKED") return "REVOKED";
  if (status === "EXPIRED") return "EXPIRED";
  return "ACTIVE";
}

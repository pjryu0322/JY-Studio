import type { ApiKey, ApiKeyStatus } from "@prisma/client";

export type ApiKeyDto = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: "ACTIVE" | "REVOKED";
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

function formatDateTime(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDtoStatus(status: ApiKeyStatus): ApiKeyDto["status"] {
  return status === "REVOKED" ? "REVOKED" : "ACTIVE";
}

export function toApiKeyDto(row: ApiKey): ApiKeyDto {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: [...row.scopes],
    status: toDtoStatus(row.status),
    createdAt: formatDateTime(row.createdAt),
    lastUsedAt: row.lastUsedAt ? formatDateTime(row.lastUsedAt) : null,
    revokedAt: row.revokedAt ? formatDateTime(row.revokedAt) : null,
  };
}

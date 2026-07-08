import type { ApiKeyDto } from "@/lib/api-key-dto";
import { ADMIN_OPS_TOKEN_HEADER } from "@/lib/admin-auth";

export type AdminApiKeysListResponse = {
  clientId: string;
  apiKeys: ApiKeyDto[];
};

export type AdminApiKeyRevokeResponse = {
  apiKey: ApiKeyDto;
};

export function buildAdminOpsHeaders(adminToken: string): HeadersInit {
  const trimmed = adminToken.trim();
  if (!trimmed) return {};
  return { [ADMIN_OPS_TOKEN_HEADER]: trimmed };
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: string | { code?: string; message?: string };
    };
    if (typeof data.error === "string") {
      return data.error;
    }
    if (data.error && typeof data.error === "object" && data.error.message) {
      return data.error.message;
    }
    return `요청에 실패했습니다. (${response.status})`;
  } catch {
    return `요청에 실패했습니다. (${response.status})`;
  }
}

export async function fetchAdminApiKeys(input: {
  status?: "ACTIVE" | "REVOKED" | "EXPIRED";
  clientId?: string;
  adminToken: string;
}): Promise<AdminApiKeysListResponse> {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (input.clientId?.trim()) params.set("clientId", input.clientId.trim());
  const qs = params.toString();
  const response = await fetch(`/api/v1/admin/api-keys${qs ? `?${qs}` : ""}`, {
    method: "GET",
    credentials: "include",
    headers: buildAdminOpsHeaders(input.adminToken),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminApiKeysListResponse;
}

export async function revokeAdminApiKey(
  apiKeyId: string,
  adminToken: string,
): Promise<AdminApiKeyRevokeResponse> {
  const response = await fetch(`/api/v1/admin/api-keys/${encodeURIComponent(apiKeyId)}/revoke`, {
    method: "POST",
    credentials: "include",
    headers: buildAdminOpsHeaders(adminToken),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminApiKeyRevokeResponse;
}

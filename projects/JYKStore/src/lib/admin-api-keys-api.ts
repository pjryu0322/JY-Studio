import type { ApiKeyDto } from "@/lib/api-key-dto";

export type AdminApiKeysListResponse = {
  clientId: string;
  apiKeys: ApiKeyDto[];
};

export type AdminApiKeyRevokeResponse = {
  apiKey: ApiKeyDto;
};

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

export async function fetchAdminApiKeys(input?: {
  status?: "ACTIVE" | "REVOKED" | "EXPIRED";
  clientId?: string;
}): Promise<AdminApiKeysListResponse> {
  const params = new URLSearchParams();
  if (input?.status) params.set("status", input.status);
  if (input?.clientId?.trim()) params.set("clientId", input.clientId.trim());
  const qs = params.toString();
  const response = await fetch(`/api/v1/admin/api-keys${qs ? `?${qs}` : ""}`, {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminApiKeysListResponse;
}

export async function revokeAdminApiKey(apiKeyId: string): Promise<AdminApiKeyRevokeResponse> {
  const response = await fetch(`/api/v1/admin/api-keys/${encodeURIComponent(apiKeyId)}/revoke`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminApiKeyRevokeResponse;
}

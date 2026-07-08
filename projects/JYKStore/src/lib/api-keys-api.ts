import type { ApiKeyDto } from "@/lib/api-key-dto";

export type ApiKeysListResponse = {
  clientId: string;
  items: ApiKeyDto[];
};

export type ApiKeyCreateResponse = {
  clientId: string;
  rawKey: string;
  apiKey: ApiKeyDto;
};

export type ApiKeyRevokeResponse = {
  ok: true;
  apiKey?: ApiKeyDto;
};

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? `요청에 실패했습니다. (${response.status})`;
  } catch {
    return `요청에 실패했습니다. (${response.status})`;
  }
}

export async function fetchApiKeys(): Promise<ApiKeysListResponse> {
  const response = await fetch("/api/v1/api-keys", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ApiKeysListResponse;
}

export async function createApiKeyApi(input: {
  name: string;
  scopes?: string[];
  expiresAt?: string | null;
}): Promise<ApiKeyCreateResponse> {
  const response = await fetch("/api/v1/api-keys", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ApiKeyCreateResponse;
}

export async function revokeApiKeyApi(keyId: string): Promise<ApiKeyRevokeResponse> {
  const response = await fetch(`/api/v1/api-keys/${encodeURIComponent(keyId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ApiKeyRevokeResponse;
}

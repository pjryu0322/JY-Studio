import type { ApiKeyDto } from "@/lib/api-key-dto";
import type { ApiKeyCreateResponse } from "@/lib/api-keys-api";

export type IssueSelectedPackApiKeyInput = {
  packId: string;
  packName: string;
};

export type IssueSelectedPackApiKeyResult = {
  clientId: string;
  plainKey: string;
  item: ApiKeyDto;
};

const SELECTED_PACK_API_KEY_SCOPES = ["packs:read", "context:read", "usage:write"] as const;

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? `요청에 실패했습니다. (${response.status})`;
  } catch {
    return `요청에 실패했습니다. (${response.status})`;
  }
}

export async function issueSelectedPackApiKey(
  input: IssueSelectedPackApiKeyInput,
): Promise<IssueSelectedPackApiKeyResult> {
  const name = `${input.packName.trim()} 연동 테스트`.slice(0, 80);

  const response = await fetch("/api/v1/api-keys", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      scopes: [...SELECTED_PACK_API_KEY_SCOPES],
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = (await response.json()) as ApiKeyCreateResponse;

  return {
    clientId: data.clientId,
    plainKey: data.plainKey,
    item: data.item,
  };
}

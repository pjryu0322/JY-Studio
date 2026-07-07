import type { KnowledgePack } from "@/types/pack";

export type MyPacksApiResponse = {
  clientId: string;
  items: KnowledgePack[];
};

export type MyPackAddApiResponse = {
  clientId: string;
  item: KnowledgePack;
};

export type MyPackRemoveApiResponse = {
  ok: true;
};

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.error ?? data.message ?? `요청에 실패했습니다. (${response.status})`;
  } catch {
    return `요청에 실패했습니다. (${response.status})`;
  }
}

export async function fetchMyPacks(): Promise<MyPacksApiResponse> {
  const response = await fetch("/api/v1/my-packs", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as MyPacksApiResponse;
}

export async function addMyPackApi(packId: string): Promise<MyPackAddApiResponse> {
  const response = await fetch("/api/v1/my-packs", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packId }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as MyPackAddApiResponse;
}

export async function removeMyPackApi(packId: string): Promise<MyPackRemoveApiResponse> {
  const response = await fetch(`/api/v1/my-packs/${encodeURIComponent(packId)}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as MyPackRemoveApiResponse;
}

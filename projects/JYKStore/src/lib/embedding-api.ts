import type { EmbeddingRebuildResultDto, PackEmbeddingSummaryDto } from "@/lib/embedding-dto";

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.message ?? data.error ?? `요청에 실패했습니다. (${response.status})`;
  } catch {
    return `요청에 실패했습니다. (${response.status})`;
  }
}

export async function fetchPackEmbeddingSummary(
  packId: string,
): Promise<PackEmbeddingSummaryDto> {
  const response = await fetch(`/api/v1/admin/packs/${encodeURIComponent(packId)}/embeddings`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as PackEmbeddingSummaryDto;
}

export async function rebuildPackEmbeddingsApi(
  packId: string,
  body: { force?: boolean },
): Promise<EmbeddingRebuildResultDto> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/embeddings/rebuild`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as EmbeddingRebuildResultDto;
}

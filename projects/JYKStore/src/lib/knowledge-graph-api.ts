import type {
  KnowledgeGraphRebuildResultDto,
  KnowledgeGraphSummaryDto,
} from "@/lib/knowledge-graph-dto";

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.message ?? data.error ?? `요청에 실패했습니다. (${response.status})`;
  } catch {
    return `요청에 실패했습니다. (${response.status})`;
  }
}

export async function fetchKnowledgeGraphSummary(
  packId: string,
): Promise<KnowledgeGraphSummaryDto> {
  const response = await fetch(`/api/v1/admin/packs/${encodeURIComponent(packId)}/graph`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as KnowledgeGraphSummaryDto;
}

export async function rebuildKnowledgeGraphApi(
  packId: string,
): Promise<KnowledgeGraphRebuildResultDto> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/graph/rebuild`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as KnowledgeGraphRebuildResultDto;
}

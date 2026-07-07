import type { ChunkPipelineSummaryDto, KnowledgeChunkDto, PackChunksListResponse } from "@/lib/chunk-pipeline-dto";

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.message ?? data.error ?? `요청에 실패했습니다. (${response.status})`;
  } catch {
    return `요청에 실패했습니다. (${response.status})`;
  }
}

export async function fetchPackChunks(packId: string): Promise<PackChunksListResponse & { clientId: string }> {
  const response = await fetch(`/api/v1/admin/packs/${encodeURIComponent(packId)}/chunks`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as PackChunksListResponse & { clientId: string };
}

export async function createPackChunkApi(
  packId: string,
  body: {
    versionId: string;
    sourceDocumentId?: string | null;
    chunkType?: string;
    title: string;
    content: string;
    section?: string | null;
    tags?: string[];
    sortOrder?: number;
  },
): Promise<{ chunk: KnowledgeChunkDto; summary: ChunkPipelineSummaryDto }> {
  const response = await fetch(`/api/v1/admin/packs/${encodeURIComponent(packId)}/chunks`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as { chunk: KnowledgeChunkDto; summary: ChunkPipelineSummaryDto };
}

export async function generateChunksFromDocumentApi(
  packId: string,
  sourceDocumentId: string,
  body: { maxChunkChars?: number; overwriteExisting?: boolean },
): Promise<{ generatedCount: number; summary: ChunkPipelineSummaryDto }> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/source-documents/${encodeURIComponent(sourceDocumentId)}/chunks/generate`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as { generatedCount: number; summary: ChunkPipelineSummaryDto };
}

export async function updatePackChunkApi(
  packId: string,
  chunkId: string,
  body: {
    title?: string;
    content?: string;
    section?: string | null;
    tags?: string[];
    sortOrder?: number;
    isActive?: boolean;
  },
): Promise<{ chunk: KnowledgeChunkDto; summary: ChunkPipelineSummaryDto }> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/chunks/${encodeURIComponent(chunkId)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as { chunk: KnowledgeChunkDto; summary: ChunkPipelineSummaryDto };
}

export async function deactivatePackChunkApi(
  packId: string,
  chunkId: string,
): Promise<{ chunk: KnowledgeChunkDto; summary: ChunkPipelineSummaryDto }> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/chunks/${encodeURIComponent(chunkId)}/deactivate`,
    { method: "POST", credentials: "include" },
  );
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as { chunk: KnowledgeChunkDto; summary: ChunkPipelineSummaryDto };
}

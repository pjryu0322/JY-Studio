import type { KnowledgeChunk } from "@prisma/client";

export type KnowledgeChunkDto = {
  id: string;
  versionId: string;
  sourceDocumentId: string | null;
  chunkType: string;
  title: string;
  content: string;
  section: string | null;
  tags: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChunkPipelineSummaryDto = {
  packId: string;
  versionCount: number;
  sourceDocumentCount: number;
  chunkCount: number;
  activeChunkCount: number;
  inactiveChunkCount: number;
};

export type CreateKnowledgeChunkInput = {
  versionId: string;
  sourceDocumentId?: string | null;
  chunkType?: string;
  title: string;
  content: string;
  section?: string | null;
  tags?: string[];
  sortOrder?: number;
};

export type UpdateKnowledgeChunkInput = {
  title?: string;
  content?: string;
  section?: string | null;
  tags?: string[];
  sortOrder?: number;
  isActive?: boolean;
};

export type PackChunksListResponse = {
  summary: ChunkPipelineSummaryDto;
  chunks: KnowledgeChunkDto[];
  versions: { id: string; version: string; createdAt: string }[];
  sourceDocuments: {
    id: string;
    versionId: string;
    title: string;
    sourceType: string;
    contentPreview: string | null;
    chunkCount: number;
  }[];
};

export function toKnowledgeChunkDto(chunk: KnowledgeChunk): KnowledgeChunkDto {
  return {
    id: chunk.id,
    versionId: chunk.versionId,
    sourceDocumentId: chunk.sourceDocumentId,
    chunkType: chunk.chunkType,
    title: chunk.title,
    content: chunk.content,
    section: chunk.section,
    tags: [...chunk.tags],
    sortOrder: chunk.sortOrder,
    isActive: chunk.isActive,
    createdAt: chunk.createdAt.toISOString(),
    updatedAt: chunk.updatedAt.toISOString(),
  };
}

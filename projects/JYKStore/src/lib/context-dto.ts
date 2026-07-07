import type { KnowledgeChunk, KnowledgePack, PackCategory, SourceDocument } from "@prisma/client";
import type { SearchScoreReason } from "@/lib/search-utils";

export type ContextChunkDto = {
  chunkId: string;
  title: string;
  content: string;
  chunkType: string;
  section?: string | null;
  tags?: string[];
  source?: {
    documentId: string;
    title: string;
    sourceType: string;
  } | null;
  metadata?: {
    sortOrder?: number;
    score?: number;
    matchReasons?: SearchScoreReason[];
  };
};

export type PackContextResponseDto = {
  pack: {
    packId: string;
    name: string;
    version: string;
    status: string;
    provider: string;
    category: string;
  };
  context: {
    summary: string;
    instructions: string[];
    chunks: ContextChunkDto[];
  };
  usage: {
    requestId: string;
    chunkCount: number;
  };
};

type ChunkWithSource = KnowledgeChunk & {
  sourceDocument: SourceDocument | null;
};

export type RankedContextChunk = {
  chunk: ChunkWithSource;
  score?: number;
  matchReasons?: SearchScoreReason[];
};

export function buildPackContextResponse(input: {
  pack: KnowledgePack & { category: PackCategory };
  versionLabel: string;
  summary: string;
  instructions: string[];
  chunks: RankedContextChunk[];
  includeMetadata: boolean;
  requestId: string;
}): PackContextResponseDto {
  return {
    pack: {
      packId: input.pack.packId,
      name: input.pack.name,
      version: input.versionLabel,
      status: input.pack.status,
      provider: input.pack.providerName,
      category: input.pack.category.name,
    },
    context: {
      summary: input.summary,
      instructions: input.instructions,
      chunks: input.chunks.map((ranked) => toContextChunkDto(ranked, input.includeMetadata)),
    },
    usage: {
      requestId: input.requestId,
      chunkCount: input.chunks.length,
    },
  };
}

function toContextChunkDto(ranked: RankedContextChunk, includeMetadata: boolean): ContextChunkDto {
  const { chunk } = ranked;
  const dto: ContextChunkDto = {
    chunkId: chunk.id,
    title: chunk.title,
    content: chunk.content,
    chunkType: chunk.chunkType,
  };

  if (!includeMetadata) {
    return dto;
  }

  dto.section = chunk.section;
  dto.tags = [...chunk.tags];
  dto.source = chunk.sourceDocument
    ? {
        documentId: chunk.sourceDocument.id,
        title: chunk.sourceDocument.title,
        sourceType: chunk.sourceDocument.sourceType,
      }
    : null;
  dto.metadata = {
    sortOrder: chunk.sortOrder,
    ...(ranked.score !== undefined ? { score: ranked.score } : {}),
    ...(ranked.matchReasons && ranked.matchReasons.length > 0
      ? { matchReasons: ranked.matchReasons }
      : {}),
  };

  return dto;
}

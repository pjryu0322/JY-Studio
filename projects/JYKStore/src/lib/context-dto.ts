import type { KnowledgeChunk, KnowledgePack, PackCategory, SourceDocument } from "@prisma/client";

export type ContextChunkDto = {
  chunkId: string;
  title: string;
  content: string;
  chunkType: string;
  source: {
    documentId: string;
    title: string;
    sourceType: string;
  } | null;
  metadata?: Record<string, unknown>;
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

export function buildPackContextResponse(input: {
  pack: KnowledgePack & { category: PackCategory };
  versionLabel: string;
  summary: string;
  instructions: string[];
  chunks: ChunkWithSource[];
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
      chunks: input.chunks.map((chunk) => toContextChunkDto(chunk, input.includeMetadata)),
    },
    usage: {
      requestId: input.requestId,
      chunkCount: input.chunks.length,
    },
  };
}

function toContextChunkDto(chunk: ChunkWithSource, includeMetadata: boolean): ContextChunkDto {
  const dto: ContextChunkDto = {
    chunkId: chunk.id,
    title: chunk.title,
    content: chunk.content,
    chunkType: chunk.chunkType,
    source: chunk.sourceDocument
      ? {
          documentId: chunk.sourceDocument.id,
          title: chunk.sourceDocument.title,
          sourceType: chunk.sourceDocument.sourceType,
        }
      : null,
  };

  if (includeMetadata) {
    dto.metadata = {
      section: chunk.section,
      tags: chunk.tags,
      sortOrder: chunk.sortOrder,
    };
  }

  return dto;
}

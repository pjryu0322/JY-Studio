import type { KnowledgeChunk } from "@prisma/client";
import type { AdminKnowledgeUnitDraftDto } from "@/lib/admin-knowledge-unit-draft-dto";

export const AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE = "AUTO_KNOWLEDGE_UNIT";

export type ActivatedKnowledgeUnitChunkDto = {
  id: string;
  versionId: string;
  sourceDocumentId: string | null;
  chunkType: string;
  title: string;
  content: string;
  section: string | null;
  tags: string[];
  sortOrder: number;
  isActive: true;
  metadata: {
    activatedFromDraftId: string;
    activatedBy: string;
    activatedAt: string;
    activationStatus: "active";
  };
  createdAt: string;
  updatedAt: string;
};

export type AdminKnowledgeUnitDraftActivationResponse = {
  clientId: string;
  draft: AdminKnowledgeUnitDraftDto;
  activatedChunk: ActivatedKnowledgeUnitChunkDto;
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readActivatedChunkMetadata(metadata: KnowledgeChunk["metadata"]): {
  activatedFromDraftId: string | null;
  activatedBy: string | null;
  activatedAt: string | null;
  activationStatus: string | null;
} {
  if (metadata === null || metadata === undefined || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {
      activatedFromDraftId: null,
      activatedBy: null,
      activatedAt: null,
      activationStatus: null,
    };
  }
  const obj = metadata as Record<string, unknown>;
  return {
    activatedFromDraftId: readString(obj.activatedFromDraftId),
    activatedBy: readString(obj.activatedBy),
    activatedAt: readString(obj.activatedAt),
    activationStatus: readString(obj.activationStatus),
  };
}

export function toActivatedKnowledgeUnitChunkDto(chunk: KnowledgeChunk): ActivatedKnowledgeUnitChunkDto {
  const meta = readActivatedChunkMetadata(chunk.metadata);
  return {
    id: chunk.id,
    versionId: chunk.versionId,
    sourceDocumentId: chunk.sourceDocumentId,
    chunkType: chunk.chunkType,
    title: chunk.title,
    content: chunk.content,
    section: chunk.section,
    tags: chunk.tags,
    sortOrder: chunk.sortOrder,
    isActive: true,
    metadata: {
      activatedFromDraftId: meta.activatedFromDraftId ?? "",
      activatedBy: meta.activatedBy ?? "",
      activatedAt: meta.activatedAt ?? chunk.createdAt.toISOString(),
      activationStatus: "active",
    },
    createdAt: chunk.createdAt.toISOString(),
    updatedAt: chunk.updatedAt.toISOString(),
  };
}

import { AuditAction, Prisma } from "@prisma/client";
import { truncateContentPreview } from "@/lib/admin-review-dto";
import {
  toKnowledgeChunkDto,
  type BulkMetadataMode,
  type ChunkPipelineSummaryDto,
  type KnowledgeChunkMetadata,
  type PackChunksListResponse,
} from "@/lib/chunk-pipeline-dto";
import { prisma } from "@/lib/prisma";
import { recordProviderAudit } from "@/lib/provider-audit";
import { validateAndNormalizeChunkMetadata } from "@/lib/retrieval-metadata";
import { fixLoneSurrogates, sliceUtf16Safe } from "@/lib/text-encoding-safe";

const TITLE_MIN = 2;
const TITLE_MAX = 120;
const CONTENT_MIN = 20;
const CONTENT_MAX = 4000;
const MAX_TAGS = 10;

function validateTitle(title: string): string | null {
  const t = title.trim();
  if (t.length < TITLE_MIN || t.length > TITLE_MAX) {
    return `제목은 ${TITLE_MIN}~${TITLE_MAX}자로 입력해 주세요.`;
  }
  return null;
}

function validateContent(content: string): string | null {
  const c = content.trim();
  if (c.length < CONTENT_MIN || c.length > CONTENT_MAX) {
    return `내용은 ${CONTENT_MIN}~${CONTENT_MAX}자로 입력해 주세요.`;
  }
  return null;
}

export function splitContentToChunks(content: string, maxChunkChars: number): string[] {
  const paragraphs = content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const result: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) result.push(trimmed);
    current = "";
  };

  const pushLongText = (text: string) => {
    let remaining = text;
    while (remaining.length > maxChunkChars) {
      const piece = sliceUtf16Safe(remaining, maxChunkChars).trim();
      if (piece) result.push(fixLoneSurrogates(piece));
      remaining = remaining.slice(piece.length || maxChunkChars).trim();
    }
    if (remaining) current = remaining;
  };

  for (const para of paragraphs) {
    if (para.length > maxChunkChars) {
      pushCurrent();
      pushLongText(para);
      continue;
    }

    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > maxChunkChars) {
      pushCurrent();
      current = para;
    } else {
      current = candidate;
    }
  }

  pushCurrent();
  return result;
}

async function getPackWithVersions(packId: string) {
  return prisma.knowledgePack.findUnique({
    where: { packId },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        include: {
          sourceDocuments: { orderBy: { createdAt: "desc" } },
          chunks: true,
        },
      },
    },
  });
}

function buildSummary(packId: string, pack: NonNullable<Awaited<ReturnType<typeof getPackWithVersions>>>): ChunkPipelineSummaryDto {
  const allChunks = pack.versions.flatMap((v) => v.chunks);
  const sourceDocumentCount = pack.versions.reduce((n, v) => n + v.sourceDocuments.length, 0);

  return {
    packId,
    versionCount: pack.versions.length,
    sourceDocumentCount,
    chunkCount: allChunks.length,
    activeChunkCount: allChunks.filter((c) => c.isActive).length,
    inactiveChunkCount: allChunks.filter((c) => !c.isActive).length,
  };
}

export async function listPackChunks(packId: string): Promise<PackChunksListResponse | null> {
  const pack = await getPackWithVersions(packId);
  if (!pack) return null;

  const chunks = pack.versions
    .flatMap((v) => v.chunks)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime())
    .map(toKnowledgeChunkDto);

  const sourceDocuments = pack.versions.flatMap((v) =>
    v.sourceDocuments.map((doc) => ({
      id: doc.id,
      versionId: doc.versionId,
      title: doc.title,
      sourceType: doc.sourceType,
      contentPreview: truncateContentPreview(doc.content),
      chunkCount: v.chunks.filter((c) => c.sourceDocumentId === doc.id).length,
    })),
  );

  return {
    summary: buildSummary(packId, pack),
    chunks,
    versions: pack.versions.map((v) => ({
      id: v.id,
      version: v.version,
      createdAt: v.createdAt.toISOString(),
    })),
    sourceDocuments,
  };
}

async function resolveVersionForPack(packId: string, versionId: string) {
  return prisma.knowledgePackVersion.findFirst({
    where: { id: versionId, packId },
  });
}

async function nextSortOrder(versionId: string) {
  const max = await prisma.knowledgeChunk.aggregate({
    where: { versionId },
    _max: { sortOrder: true },
  });
  return (max._max.sortOrder ?? 0) + 1;
}

export async function createKnowledgeChunk(input: {
  packId: string;
  versionId: string;
  sourceDocumentId?: string | null;
  chunkType?: string;
  title: string;
  content: string;
  section?: string | null;
  tags?: string[];
  metadata?: KnowledgeChunkMetadata | null;
  sortOrder?: number;
}) {
  const pack = await prisma.knowledgePack.findUnique({ where: { packId: input.packId } });
  if (!pack) return { error: "NOT_FOUND" as const };

  const version = await resolveVersionForPack(input.packId, input.versionId);
  if (!version) return { error: "VERSION_NOT_FOUND" as const };

  const titleError = validateTitle(input.title);
  if (titleError) return { error: "VALIDATION" as const, message: titleError };

  const contentError = validateContent(input.content);
  if (contentError) return { error: "VALIDATION" as const, message: contentError };

  const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean);
  if (tags.length > MAX_TAGS) {
    return { error: "VALIDATION" as const, message: `태그는 최대 ${MAX_TAGS}개까지 등록할 수 있습니다.` };
  }

  const metadataResult = validateAndNormalizeChunkMetadata(input.metadata);
  if (!metadataResult.ok) {
    return { error: "VALIDATION" as const, message: metadataResult.errors.join("\n") };
  }

  if (input.sourceDocumentId) {
    const doc = await prisma.sourceDocument.findFirst({
      where: { id: input.sourceDocumentId, versionId: version.id },
    });
    if (!doc) return { error: "SOURCE_NOT_FOUND" as const };
  }

  const sortOrder =
    typeof input.sortOrder === "number" ? input.sortOrder : await nextSortOrder(version.id);

  const chunk = await prisma.knowledgeChunk.create({
    data: {
      versionId: version.id,
      sourceDocumentId: input.sourceDocumentId ?? null,
      chunkType: input.chunkType?.trim() || "MANUAL",
      title: input.title.trim(),
      content: input.content.trim(),
      section: input.section?.trim() || null,
      tags,
      metadata: metadataResult.metadata ?? Prisma.JsonNull,
      sortOrder,
      isActive: true,
    },
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_CHUNK_CREATE,
    entityType: "KnowledgeChunk",
    entityId: chunk.id,
    metadata: { packId: input.packId },
  });

  const list = await listPackChunks(input.packId);
  return { chunk: toKnowledgeChunkDto(chunk), summary: list!.summary };
}

export async function updateKnowledgeChunk(input: {
  packId: string;
  chunkId: string;
  title?: string;
  content?: string;
  section?: string | null;
  tags?: string[];
  metadata?: KnowledgeChunkMetadata | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const chunk = await prisma.knowledgeChunk.findFirst({
    where: { id: input.chunkId, version: { packId: input.packId } },
  });

  if (!chunk) return { error: "NOT_FOUND" as const };

  if (input.title !== undefined) {
    const err = validateTitle(input.title);
    if (err) return { error: "VALIDATION" as const, message: err };
  }
  if (input.content !== undefined) {
    const err = validateContent(input.content);
    if (err) return { error: "VALIDATION" as const, message: err };
  }

  const tags = input.tags?.map((t) => t.trim()).filter(Boolean);
  if (tags && tags.length > MAX_TAGS) {
    return { error: "VALIDATION" as const, message: `태그는 최대 ${MAX_TAGS}개까지 등록할 수 있습니다.` };
  }

  let metadata: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined = undefined;
  if (input.metadata !== undefined) {
    const metadataResult = validateAndNormalizeChunkMetadata(input.metadata);
    if (!metadataResult.ok) {
      return { error: "VALIDATION" as const, message: metadataResult.errors.join("\n") };
    }
    metadata = metadataResult.metadata ?? Prisma.JsonNull;
  }

  const updated = await prisma.knowledgeChunk.update({
    where: { id: chunk.id },
    data: {
      title: input.title?.trim(),
      content: input.content?.trim(),
      section: input.section === undefined ? undefined : input.section?.trim() || null,
      tags: tags ?? undefined,
      metadata,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_CHUNK_UPDATE,
    entityType: "KnowledgeChunk",
    entityId: updated.id,
    metadata: { packId: input.packId },
  });

  const list = await listPackChunks(input.packId);
  return { chunk: toKnowledgeChunkDto(updated), summary: list!.summary };
}

export async function bulkUpdateChunkMetadata(input: {
  packId: string;
  chunkIds: string[];
  mode: BulkMetadataMode;
  metadata?: KnowledgeChunkMetadata | null;
}) {
  const ids = Array.from(
    new Set((input.chunkIds ?? []).map((id) => id.trim()).filter(Boolean)),
  );
  if (ids.length === 0) {
    return { error: "VALIDATION" as const, message: "선택된 chunk가 없습니다." };
  }

  let normalized: Record<string, string | string[]> | null = null;
  if (input.mode !== "clear") {
    const result = validateAndNormalizeChunkMetadata(input.metadata);
    if (!result.ok) {
      return { error: "VALIDATION" as const, message: result.errors.join("\n") };
    }
    normalized = result.metadata;
    if (input.mode === "merge" && !normalized) {
      return { error: "VALIDATION" as const, message: "병합할 metadata가 없습니다." };
    }
  }

  const chunks = await prisma.knowledgeChunk.findMany({
    where: { id: { in: ids }, version: { packId: input.packId } },
  });
  if (chunks.length === 0) return { error: "NOT_FOUND" as const };

  let updatedCount = 0;
  await prisma.$transaction(async (tx) => {
    for (const chunk of chunks) {
      let nextMetadata: Prisma.InputJsonValue | typeof Prisma.JsonNull;
      if (input.mode === "clear") {
        nextMetadata = Prisma.JsonNull;
      } else if (input.mode === "replace") {
        nextMetadata = normalized ?? Prisma.JsonNull;
      } else {
        const existing =
          chunk.metadata && typeof chunk.metadata === "object" && !Array.isArray(chunk.metadata)
            ? (chunk.metadata as Record<string, unknown>)
            : {};
        nextMetadata = { ...existing, ...(normalized ?? {}) } as Prisma.InputJsonValue;
      }

      await tx.knowledgeChunk.update({
        where: { id: chunk.id },
        data: { metadata: nextMetadata },
      });
      updatedCount += 1;
    }
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_CHUNK_UPDATE,
    entityType: "KnowledgeChunk",
    entityId: input.packId,
    metadata: { packId: input.packId, chunkCount: updatedCount, mode: input.mode, bulk: true },
  });

  const list = await listPackChunks(input.packId);
  return { updatedCount, summary: list!.summary };
}

export async function deactivateKnowledgeChunk(input: { packId: string; chunkId: string }) {
  const chunk = await prisma.knowledgeChunk.findFirst({
    where: { id: input.chunkId, version: { packId: input.packId } },
  });

  if (!chunk) return { error: "NOT_FOUND" as const };

  const updated = await prisma.knowledgeChunk.update({
    where: { id: chunk.id },
    data: { isActive: false },
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_CHUNK_DEACTIVATE,
    entityType: "KnowledgeChunk",
    entityId: updated.id,
    metadata: { packId: input.packId },
  });

  const list = await listPackChunks(input.packId);
  return { chunk: toKnowledgeChunkDto(updated), summary: list!.summary };
}

export async function generateChunksFromSourceDocument(input: {
  packId: string;
  sourceDocumentId: string;
  maxChunkChars?: number;
  overwriteExisting?: boolean;
}) {
  const maxChunkChars = input.maxChunkChars ?? 1200;
  const overwriteExisting = Boolean(input.overwriteExisting);

  const doc = await prisma.sourceDocument.findFirst({
    where: {
      id: input.sourceDocumentId,
      version: { packId: input.packId },
    },
    include: { version: true },
  });

  if (!doc) return { error: "NOT_FOUND" as const };

  const content = doc.content?.trim() ?? "";
  if (content.length < CONTENT_MIN) {
    return {
      error: "VALIDATION" as const,
      message: `원천 문서 content가 ${CONTENT_MIN}자 이상이어야 합니다.`,
    };
  }

  const existing = await prisma.knowledgeChunk.findMany({
    where: {
      sourceDocumentId: doc.id,
      isActive: true,
    },
  });

  if (existing.length > 0 && !overwriteExisting) {
    return { error: "CHUNKS_EXIST" as const };
  }

  const texts = splitContentToChunks(content, maxChunkChars);
  if (texts.length === 0) {
    return { error: "VALIDATION" as const, message: "청크로 분할할 내용이 없습니다." };
  }

  let sortBase = await nextSortOrder(doc.versionId);

  await prisma.$transaction(async (tx) => {
    if (overwriteExisting && existing.length > 0) {
      await tx.knowledgeChunk.updateMany({
        where: { sourceDocumentId: doc.id, isActive: true },
        data: { isActive: false },
      });
    }

    for (let i = 0; i < texts.length; i++) {
      await tx.knowledgeChunk.create({
        data: {
          versionId: doc.versionId,
          sourceDocumentId: doc.id,
          chunkType: "SOURCE_DOCUMENT",
          title: `${doc.title} #${i + 1}`,
          content: texts[i]!,
          section: doc.title,
          tags: [],
          sortOrder: sortBase++,
          isActive: true,
        },
      });
    }
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_CHUNK_GENERATE,
    entityType: "SourceDocument",
    entityId: doc.id,
    metadata: {
      packId: input.packId,
      sourceDocumentId: doc.id,
      generatedCount: texts.length,
      maxChunkChars,
      overwriteExisting,
    },
  });

  const list = await listPackChunks(input.packId);
  return { generatedCount: texts.length, summary: list!.summary, chunks: list!.chunks };
}

export async function getPackChunkSummary(packId: string) {
  const list = await listPackChunks(packId);
  if (!list) return null;
  return list.summary;
}

import { prisma } from "@/lib/prisma";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";

const SOURCE_PREVIEW_MAX = 2500;
const CONTENT_MAX = 20000;

export type ProviderChunkReviewDetailDto = {
  chunkId: string;
  title: string;
  content: string;
  contentTruncated: boolean;
  section: string | null;
  tags: string[];
  sortOrder: number;
  sourceDocumentId: string | null;
  sourceFileName: string | null;
  sourceContentPreview: string | null;
  sourceContentTruncated: boolean;
  prevChunkTitle: string | null;
  nextChunkTitle: string | null;
  knowledgeUnitId: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Loads a single chunk for provider review detail (owned packs only).
 */
export async function getProviderChunkReviewDetailForClient(
  userId: string,
  clientId: string,
  packId: string,
  chunkId: string,
): Promise<ProviderChunkReviewDetailDto | null> {
  const trimmedPackId = packId.trim();
  const trimmedChunkId = chunkId.trim();
  if (!trimmedPackId || !trimmedChunkId) return null;

  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);
  if (!profile) return null;

  const pack = await prisma.knowledgePack.findFirst({
    where: {
      packId: trimmedPackId,
      providerProfileId: profile.id,
    },
    select: { packId: true },
  });
  if (!pack) return null;

  const chunk = await prisma.knowledgeChunk.findFirst({
    where: {
      id: trimmedChunkId,
      version: { packId: pack.packId },
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      content: true,
      section: true,
      tags: true,
      sortOrder: true,
      sourceDocumentId: true,
      metadata: true,
      versionId: true,
      sourceDocument: {
        select: {
          id: true,
          title: true,
          fileName: true,
          content: true,
        },
      },
    },
  });
  if (!chunk) return null;

  const [prev, next] = await Promise.all([
    prisma.knowledgeChunk.findFirst({
      where: {
        versionId: chunk.versionId,
        isActive: true,
        sortOrder: { lt: chunk.sortOrder },
      },
      orderBy: { sortOrder: "desc" },
      select: { title: true },
    }),
    prisma.knowledgeChunk.findFirst({
      where: {
        versionId: chunk.versionId,
        isActive: true,
        sortOrder: { gt: chunk.sortOrder },
      },
      orderBy: { sortOrder: "asc" },
      select: { title: true },
    }),
  ]);

  const meta = asRecord(chunk.metadata);
  const knowledgeUnitId =
    (typeof meta?.knowledgeUnitId === "string" && meta.knowledgeUnitId.trim()) ||
    (typeof meta?.unitId === "string" && meta.unitId.trim()) ||
    null;

  const fullContent = chunk.content ?? "";
  const contentTruncated = fullContent.length > CONTENT_MAX;
  const sourceFull = chunk.sourceDocument?.content ?? null;
  const sourceTruncated = Boolean(sourceFull && sourceFull.length > SOURCE_PREVIEW_MAX);

  return {
    chunkId: chunk.id,
    title: chunk.title,
    content: contentTruncated ? fullContent.slice(0, CONTENT_MAX) : fullContent,
    contentTruncated,
    section: chunk.section,
    tags: chunk.tags,
    sortOrder: chunk.sortOrder,
    sourceDocumentId: chunk.sourceDocumentId,
    sourceFileName:
      chunk.sourceDocument?.fileName?.trim() ||
      chunk.sourceDocument?.title?.trim() ||
      null,
    sourceContentPreview: sourceFull
      ? sourceTruncated
        ? sourceFull.slice(0, SOURCE_PREVIEW_MAX)
        : sourceFull
      : null,
    sourceContentTruncated: sourceTruncated,
    prevChunkTitle: prev?.title ?? null,
    nextChunkTitle: next?.title ?? null,
    knowledgeUnitId,
  };
}

/**
 * Loads multiple chunks for provider PDF export (owned packs only).
 * Caps at `limit` (default 40). Order follows the requested chunkIds.
 */
export async function listProviderChunkReviewDetailsForClient(
  userId: string,
  clientId: string,
  packId: string,
  chunkIds: readonly string[],
  limit = 40,
): Promise<ProviderChunkReviewDetailDto[]> {
  const trimmedPackId = packId.trim();
  const ids = [...new Set(chunkIds.map((id) => id.trim()).filter(Boolean))].slice(0, limit);
  if (!trimmedPackId || ids.length === 0) return [];

  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);
  if (!profile) return [];

  const pack = await prisma.knowledgePack.findFirst({
    where: {
      packId: trimmedPackId,
      providerProfileId: profile.id,
    },
    select: { packId: true },
  });
  if (!pack) return [];

  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      id: { in: ids },
      version: { packId: pack.packId },
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      content: true,
      section: true,
      tags: true,
      sortOrder: true,
      sourceDocumentId: true,
      metadata: true,
      sourceDocument: {
        select: {
          id: true,
          title: true,
          fileName: true,
          content: true,
        },
      },
    },
  });

  const byId = new Map(chunks.map((c) => [c.id, c]));
  const result: ProviderChunkReviewDetailDto[] = [];
  for (const id of ids) {
    const chunk = byId.get(id);
    if (!chunk) continue;
    const meta = asRecord(chunk.metadata);
    const knowledgeUnitId =
      (typeof meta?.knowledgeUnitId === "string" && meta.knowledgeUnitId.trim()) ||
      (typeof meta?.unitId === "string" && meta.unitId.trim()) ||
      null;
    const fullContent = chunk.content ?? "";
    const contentTruncated = fullContent.length > CONTENT_MAX;
    const sourceFull = chunk.sourceDocument?.content ?? null;
    const sourceTruncated = Boolean(sourceFull && sourceFull.length > SOURCE_PREVIEW_MAX);
    result.push({
      chunkId: chunk.id,
      title: chunk.title,
      content: contentTruncated ? fullContent.slice(0, CONTENT_MAX) : fullContent,
      contentTruncated,
      section: chunk.section,
      tags: chunk.tags,
      sortOrder: chunk.sortOrder,
      sourceDocumentId: chunk.sourceDocumentId,
      sourceFileName:
        chunk.sourceDocument?.fileName?.trim() ||
        chunk.sourceDocument?.title?.trim() ||
        null,
      sourceContentPreview: sourceFull
        ? sourceTruncated
          ? sourceFull.slice(0, SOURCE_PREVIEW_MAX)
          : sourceFull
        : null,
      sourceContentTruncated: sourceTruncated,
      prevChunkTitle: null,
      nextChunkTitle: null,
      knowledgeUnitId,
    });
  }
  return result;
}

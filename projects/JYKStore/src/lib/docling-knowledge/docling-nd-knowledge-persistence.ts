/**
 * Draft/production lifecycle writes for Docling ND knowledge generations.
 */
import type { Prisma } from "@prisma/client";
import {
  DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE,
  DOCLING_RETRIEVAL_CHUNK_TYPE,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import { prisma } from "@/lib/prisma";

/** Activate a successful draft generation; retire prior DRAFT generations only (atomic). */
export async function activateDraftIndexGeneration(input: {
  versionId: string;
  indexGenerationId: string;
}): Promise<{ activatedChunkCount: number; retiredDraftCount: number }> {
  const result = await prisma.$transaction(async (tx) => {
    const priorDrafts = await tx.knowledgeChunk.findMany({
      where: {
        versionId: input.versionId,
        chunkType: {
          in: [DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE, DOCLING_RETRIEVAL_CHUNK_TYPE],
        },
        isActive: true,
      },
      select: { id: true, metadata: true, chunkType: true },
    });

    const toRetire = priorDrafts.filter((c) => {
      const meta = c.metadata as Record<string, unknown> | null;
      if (meta?.indexScope === "PRODUCTION") return false;
      if (meta?.indexGenerationId === input.indexGenerationId) return false;
      return (
        meta?.indexScope === "DRAFT" ||
        meta?.draftIndex === true ||
        meta?.generatedBy === "docling-knowledge-pipeline"
      );
    });

    for (const c of toRetire) {
      const meta = { ...((c.metadata as Record<string, unknown> | null) ?? {}) };
      meta.indexStatus = "RETIRED";
      await tx.knowledgeChunk.update({
        where: { id: c.id },
        data: {
          isActive: false,
          metadata: meta as Prisma.InputJsonValue,
        },
      });
    }

    const building = await tx.knowledgeChunk.findMany({
      where: {
        versionId: input.versionId,
        chunkType: {
          in: [DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE, DOCLING_RETRIEVAL_CHUNK_TYPE],
        },
        metadata: {
          path: ["indexGenerationId"],
          equals: input.indexGenerationId,
        },
      },
      select: { id: true, chunkType: true, metadata: true },
    });

    let activatedChunkCount = 0;
    for (const c of building) {
      const meta = { ...((c.metadata as Record<string, unknown> | null) ?? {}) };
      meta.indexStatus = "DRAFT";
      meta.indexScope = "DRAFT";
      meta.draftIndex = true;
      const isRetrieval = c.chunkType === DOCLING_RETRIEVAL_CHUNK_TYPE;
      await tx.knowledgeChunk.update({
        where: { id: c.id },
        data: {
          isActive: isRetrieval,
          metadata: meta as Prisma.InputJsonValue,
        },
      });
      if (isRetrieval) activatedChunkCount += 1;
    }

    return {
      activatedChunkCount,
      retiredDraftCount: toRetire.length,
    };
  });

  // P4.1: mirror activation into SearchIndexGeneration (authoritative; failures propagate).
  const { syncSearchGenerationReady } = await import(
    "@/lib/search-generation/search-generation-pipeline-sync"
  );
  await syncSearchGenerationReady({
    versionId: input.versionId,
    indexGenerationId: input.indexGenerationId,
  });

  return result;
}

/** Mark a failed building generation without touching other generations. */
export async function failDraftIndexGeneration(input: {
  versionId: string;
  indexGenerationId: string;
  failureCode?: string;
  failureMessage?: string | null;
}): Promise<void> {
  const rows = await prisma.knowledgeChunk.findMany({
    where: {
      versionId: input.versionId,
      chunkType: {
        in: [DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE, DOCLING_RETRIEVAL_CHUNK_TYPE],
      },
    },
    select: { id: true, metadata: true },
  });
  for (const c of rows) {
    const meta = c.metadata as Record<string, unknown> | null;
    if (meta?.indexGenerationId !== input.indexGenerationId) continue;
    await prisma.knowledgeChunk.update({
      where: { id: c.id },
      data: {
        isActive: false,
        metadata: {
          ...meta,
          indexStatus: "FAILED",
        } as Prisma.InputJsonValue,
      },
    });
  }

  // P4.1: mirror failure into SearchIndexGeneration (authoritative when row exists).
  const { syncSearchGenerationFailed } = await import(
    "@/lib/search-generation/search-generation-pipeline-sync"
  );
  await syncSearchGenerationFailed({
    versionId: input.versionId,
    indexGenerationId: input.indexGenerationId,
    ...(input.failureCode ? { failureCode: input.failureCode } : {}),
    ...(input.failureMessage !== undefined ? { failureMessage: input.failureMessage } : {}),
  });
}

/** Promote a specific DRAFT generation to PRODUCTION (admin approve). */
export async function promoteDraftIndexToProduction(input: {
  versionId: string;
  pipelineRunId: string;
  indexGenerationId: string;
  fingerprint: string;
  tx?: Prisma.TransactionClient;
  /** P5.1.1: Snapshot descriptor guard for conditional Generation promotion. */
  promotionGuard?: import("@/lib/search-generation/search-generation-service").PromoteSearchGenerationGuard;
}): Promise<number> {
  const db = input.tx ?? prisma;

  const candidates = await db.knowledgeChunk.findMany({
    where: {
      versionId: input.versionId,
      chunkType: {
        in: [DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE, DOCLING_RETRIEVAL_CHUNK_TYPE],
      },
      metadata: {
        path: ["indexGenerationId"],
        equals: input.indexGenerationId,
      },
    },
    select: { id: true, chunkType: true, metadata: true, isActive: true },
  });

  const matching = candidates.filter((c) => {
    const meta = c.metadata as Record<string, unknown> | null;
    if (meta?.pipelineRunId !== input.pipelineRunId) return false;
    if (
      meta?.fingerprint !== input.fingerprint &&
      meta?.normalizedDocumentFingerprint !== input.fingerprint
    ) {
      return false;
    }
    if (meta?.indexScope === "PRODUCTION" && meta?.indexStatus === "APPROVED") return false;
    return meta?.indexScope === "DRAFT" || meta?.indexStatus === "DRAFT" || meta?.draftIndex === true;
  });

  if (matching.length === 0) {
    throw new Error("DRAFT_GENERATION_NOT_FOUND");
  }

  const production = await db.knowledgeChunk.findMany({
    where: {
      versionId: input.versionId,
      chunkType: {
        in: [DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE, DOCLING_RETRIEVAL_CHUNK_TYPE],
      },
      isActive: true,
    },
    select: { id: true, metadata: true },
  });

  for (const c of production) {
    const meta = c.metadata as Record<string, unknown> | null;
    if (meta?.indexGenerationId === input.indexGenerationId) continue;
    if (meta?.indexScope !== "PRODUCTION" && meta?.generatedBy !== "docling-knowledge-pipeline") {
      // leave non-docling chunks alone
      if (meta?.indexScope == null && meta?.draftIndex !== true) continue;
    }
    if (meta?.indexScope === "PRODUCTION" || meta?.draftIndex === true || meta?.indexScope === "DRAFT") {
      const next = { ...(meta ?? {}) };
      next.indexStatus = "RETIRED";
      await db.knowledgeChunk.update({
        where: { id: c.id },
        data: {
          isActive: false,
          metadata: next as Prisma.InputJsonValue,
        },
      });
    }
  }

  let n = 0;
  for (const c of matching) {
    const meta = { ...((c.metadata as Record<string, unknown> | null) ?? {}) };
    meta.indexScope = "PRODUCTION";
    meta.indexStatus = "APPROVED";
    meta.draftIndex = false;
    const isRetrieval = c.chunkType === DOCLING_RETRIEVAL_CHUNK_TYPE;
    await db.knowledgeChunk.update({
      where: { id: c.id },
      data: {
        isActive: isRetrieval,
        metadata: meta as Prisma.InputJsonValue,
      },
    });
    if (isRetrieval) n += 1;
  }

  // P4: promote the matching SearchIndexGeneration inside the same transaction (§36).
  const { syncSearchGenerationPromotion } = await import(
    "@/lib/search-generation/search-generation-pipeline-sync"
  );
  await syncSearchGenerationPromotion({
    versionId: input.versionId,
    indexGenerationId: input.indexGenerationId,
    tx: db as Prisma.TransactionClient,
    ...(input.promotionGuard ? { guard: input.promotionGuard } : {}),
  });

  return n;
}

export async function ensureDoclingOriginSourceDocument(input: {
  versionId: string;
  packId: string;
  title: string | null;
  fingerprint: string | null;
}): Promise<string | null> {
  const byLegacy = await prisma.sourceDocument.findFirst({
    where: {
      versionId: input.versionId,
      legacySourceType: "DOCLING_ORIGIN",
    },
    select: { id: true },
  });
  if (byLegacy) return byLegacy.id;

  if (input.fingerprint) {
    const byChecksum = await prisma.sourceDocument.findFirst({
      where: { versionId: input.versionId, checksum: input.fingerprint },
      select: { id: true },
    });
    if (byChecksum) return byChecksum.id;
  }

  const origin = await prisma.knowledgePackFile.findFirst({
    where: {
      versionId: input.versionId,
      role: "SOURCE_ORIGINAL",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, originalFileName: true, checksumSha256: true, mimeType: true },
  });

  const created = await prisma.sourceDocument.create({
    data: {
      versionId: input.versionId,
      title: input.title?.trim() || origin?.originalFileName || "Docling origin",
      sourceType: "ETC",
      legacySourceType: "DOCLING_ORIGIN",
      sourceFormat: "TEXT",
      fileName: origin?.originalFileName ?? null,
      mimeType: origin?.mimeType ?? null,
      checksum: origin?.checksumSha256 ?? input.fingerprint ?? null,
      validationStatus: "PASS",
      validationSummary: "Docling origin linked for knowledge provenance",
    },
    select: { id: true },
  });
  return created.id;
}

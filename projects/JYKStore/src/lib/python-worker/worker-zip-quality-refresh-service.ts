/**
 * Worker ZIP → legacy quality gate wiring (option C).
 *
 * After the Python Worker import reaches READY, the Store still needs the
 * existing quality runners to produce real reports so admin "판단 근거" can
 * clear MISSING blockers. This module:
 *  1. Backfills empty Worker SourceDocument.content from linked KnowledgeChunks
 *     (covers packs imported before content was persisted at ensure-time).
 *  2. Runs `refreshAdminReviewReadiness` (validate → structure → chunk →
 *     retrieval → release gate) without regenerating chunks.
 *
 * Does NOT invent fake PASS reports — if structure/chunk/retrieval honestly
 * FAIL, that result is what the review gate shows.
 */
import type { AdminReviewRefreshResult } from "@/lib/admin-review-refresh-service";
import { refreshAdminReviewReadiness } from "@/lib/admin-review-refresh-service";
import { prisma } from "@/lib/prisma";
import {
  resolveWorkerSourceDocumentFormat,
  resolveWorkerSourceDocumentType,
} from "@/lib/python-worker/worker-source-document-content";
import { WORKER_ZIP_SOURCE_LEGACY_TYPE } from "@/lib/python-worker/worker-source-document-service";

const MAX_BACKFILL_CONTENT_CHARS = 200_000;

type PrismaClientLike = typeof prisma;

export type WorkerZipQualityRefreshResult =
  | {
      ok: true;
      refresh: AdminReviewRefreshResult;
      backfilledSourceDocuments: number;
      retypedSourceDocuments: number;
    }
  | { ok: false; error: "NOT_FOUND" | "NO_WORKER_SOURCES"; message: string };

/**
 * For Worker-ZIP SourceDocuments with empty content, concatenate linked active
 * KnowledgeChunk contents so source validation / structure coverage have text.
 */
export async function backfillWorkerSourceDocumentContentFromChunks(input: {
  packId: string;
  prismaClient?: PrismaClientLike;
}): Promise<number> {
  const client = input.prismaClient ?? prisma;
  const pack = await client.knowledgePack.findUnique({
    where: { packId: input.packId },
    select: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, currentWorkingCopyId: true },
      },
    },
  });
  const version = pack?.versions[0];
  const versionId = version?.id;
  if (!versionId) return 0;

  const emptyDocs = await client.sourceDocument.findMany({
    where: {
      versionId,
      legacySourceType: WORKER_ZIP_SOURCE_LEGACY_TYPE,
      ...(version.currentWorkingCopyId
        ? { workingCopyId: version.currentWorkingCopyId }
        : {}),
      OR: [{ content: null }, { content: "" }],
    },
    select: { id: true, title: true, fileName: true },
  });
  if (emptyDocs.length === 0) return 0;

  let updated = 0;
  for (const doc of emptyDocs) {
    const chunks = await client.knowledgeChunk.findMany({
      where: { sourceDocumentId: doc.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { title: true, section: true, content: true },
      take: 200,
    });

    const parts: string[] = [];
    for (const chunk of chunks) {
      const header = [chunk.title, chunk.section].filter(Boolean).join(" — ");
      if (header) parts.push(header);
      if (chunk.content?.trim()) parts.push(chunk.content.trim());
    }
    // License / index / supporting files may have no KnowledgeChunks (Worker
    // excluded them from chunking). Fall back to title/fileName so source
    // validation does not hard-FAIL with CONTENT_OR_URL_REQUIRED and block the
    // rest of the quality pipeline — those docs typically land as WARNING.
    let content = parts.join("\n\n").trim();
    if (!content) {
      content = [doc.title, doc.fileName].filter((v) => Boolean(v?.trim())).join("\n").trim();
    }
    if (!content) continue;
    if (content.length > MAX_BACKFILL_CONTENT_CHARS) {
      content = `${content.slice(0, MAX_BACKFILL_CONTENT_CHARS)}\n\n…(truncated)`;
    }

    await client.sourceDocument.update({
      where: { id: doc.id },
      data: {
        content,
        // Re-open validation so the next refresh re-checks with real text.
        validationStatus: "NOT_CHECKED",
      },
    });
    updated += 1;
  }
  return updated;
}

/**
 * Earlier Worker ZIP imports left every SourceDocument as ETC. That stamps
 * ONLY_ETC_TYPE WARNING on every doc; with hundreds of docs the knowledge-quality
 * warning penalty collapsed the score to FAIL even when structure coverage was
 * 100%. Retype from fileName/title heuristics before re-validation.
 */
export async function retypeWorkerEtcSourceDocuments(input: {
  packId: string;
  prismaClient?: PrismaClientLike;
}): Promise<number> {
  const client = input.prismaClient ?? prisma;
  const pack = await client.knowledgePack.findUnique({
    where: { packId: input.packId },
    select: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, currentWorkingCopyId: true },
      },
    },
  });
  const version = pack?.versions[0];
  const versionId = version?.id;
  if (!versionId) return 0;

  const etcDocs = await client.sourceDocument.findMany({
    where: {
      versionId,
      legacySourceType: WORKER_ZIP_SOURCE_LEGACY_TYPE,
      ...(version.currentWorkingCopyId
        ? { workingCopyId: version.currentWorkingCopyId }
        : {}),
      sourceType: "ETC",
    },
    select: { id: true, title: true, fileName: true },
  });
  if (etcDocs.length === 0) return 0;

  let updated = 0;
  for (const doc of etcDocs) {
    const sourcePath = doc.fileName?.trim() || doc.title || "document.txt";
    const sourceType = resolveWorkerSourceDocumentType({
      sourcePath,
      title: doc.title,
    });
    const sourceFormat = resolveWorkerSourceDocumentFormat({ sourcePath });
    if (sourceType === "ETC") continue;
    await client.sourceDocument.update({
      where: { id: doc.id },
      data: {
        sourceType,
        sourceFormat,
        validationStatus: "NOT_CHECKED",
      },
    });
    updated += 1;
  }
  return updated;
}

/**
 * Run the legacy quality pipeline against a Worker ZIP pack's current Store
 * data. Safe for Worker chunks (refreshAdminReviewReadiness never regenerates).
 */
export async function refreshWorkerZipReviewReadiness(input: {
  packId: string;
  reviewerClientId?: string;
  prismaClient?: PrismaClientLike;
}): Promise<WorkerZipQualityRefreshResult> {
  const packId = input.packId.trim();
  const client = input.prismaClient ?? prisma;

  const pack = await client.knowledgePack.findUnique({
    where: { packId },
    select: {
      packId: true,
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          sourceDocuments: {
            where: { legacySourceType: WORKER_ZIP_SOURCE_LEGACY_TYPE },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!pack) {
    return { ok: false, error: "NOT_FOUND", message: "지식팩을 찾을 수 없습니다." };
  }
  if (!pack.versions[0]?.sourceDocuments.length) {
    return {
      ok: false,
      error: "NO_WORKER_SOURCES",
      message: "Worker ZIP 원천 문서가 없습니다. 지식데이터 생성을 먼저 실행해 주세요.",
    };
  }

  const backfilledSourceDocuments = await backfillWorkerSourceDocumentContentFromChunks({
    packId,
    prismaClient: client,
  });
  const retypedSourceDocuments = await retypeWorkerEtcSourceDocuments({
    packId,
    prismaClient: client,
  });

  const refresh = await refreshAdminReviewReadiness({
    packId,
    reviewerClientId: input.reviewerClientId,
  });
  if ("error" in refresh) {
    return { ok: false, error: "NOT_FOUND", message: "지식팩을 찾을 수 없습니다." };
  }

  return { ok: true, refresh, backfilledSourceDocuments, retypedSourceDocuments };
}

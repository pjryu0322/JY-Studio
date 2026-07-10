import { Prisma, type SourceDocument } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertProviderPackEditableForClient } from "@/lib/provider-pack-service";
import { GitHubDiscoveryError } from "./github-auto-collect-types";
import type {
  GitHubKnowledgeUnitDraftInput,
  GitHubKnowledgeUnitDraftResult,
} from "./github-auto-collect-types";
import {
  AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
  buildDraftCandidatesForSourceDocument,
  buildDraftChunkMetadata,
  extractGitHubPathFromSourceUrl,
  selectDraftCandidates,
  type SourceDocumentDraftInput,
} from "./github-knowledge-unit-draft-generator";
import {
  normalizeGitHubKnowledgeUnitDraftInput,
  SOURCE_DOCUMENT_MIN_CONTENT_LENGTH,
} from "./github-knowledge-unit-draft-options";
import {
  normalizeGitHubRepositoryPath,
  pathMatchesRequestedSourcePath,
} from "./github-path-utils";
import {
  dedupeKuDraftCandidates,
  isKuDraftDuplicate,
  type KuDraftDedupRecord,
} from "@/lib/knowledge-unit-draft/ku-draft-dedup";
import { buildKuDraftActionableWarnings } from "@/lib/knowledge-unit-draft/ku-draft-content";
import { readDraftMetadata } from "@/lib/provider-knowledge-unit-draft-dto";

export type GenerateGitHubKnowledgeUnitDraftDeps = {
  prismaClient?: typeof prisma;
  assertEditablePack?: typeof assertProviderPackEditableForClient;
};

function throwPreflightError(
  editable: {
    ok: false;
    error: "PROFILE_REQUIRED" | "NOT_FOUND" | "NOT_EDITABLE";
  },
): never {
  if (editable.error === "PROFILE_REQUIRED") {
    throw new GitHubDiscoveryError(
      "INVALID_KNOWLEDGE_UNIT_DRAFT_OPTIONS",
      "Provider 프로필이 필요합니다.",
      400,
    );
  }
  if (editable.error === "NOT_FOUND") {
    throw new GitHubDiscoveryError(
      "INVALID_KNOWLEDGE_UNIT_DRAFT_OPTIONS",
      "지식팩을 찾을 수 없습니다.",
      404,
    );
  }
  throw new GitHubDiscoveryError(
    "INVALID_KNOWLEDGE_UNIT_DRAFT_OPTIONS",
    "초안(DRAFT) 상태에서만 생성할 수 있습니다.",
    409,
  );
}

function toDraftInput(doc: SourceDocument): SourceDocumentDraftInput {
  return {
    id: doc.id,
    title: doc.title,
    sourceType: doc.sourceType,
    sourceFormat: doc.sourceFormat,
    sourceUrl: doc.sourceUrl,
    fileName: doc.fileName,
    content: doc.content,
  };
}

function matchesSourcePath(doc: SourceDocument, paths: string[]): boolean {
  if (paths.length === 0) return true;

  const docPath =
    extractGitHubPathFromSourceUrl(doc.sourceUrl) ??
    (doc.fileName ? normalizeGitHubRepositoryPath(doc.fileName) : "");

  if (!docPath) return false;

  return paths.some((p) => pathMatchesRequestedSourcePath(docPath, p));
}

async function nextSortOrder(db: typeof prisma, versionId: string, start: number): Promise<number> {
  const max = await db.knowledgeChunk.aggregate({
    where: { versionId },
    _max: { sortOrder: true },
  });
  return Math.max(start, (max._max.sortOrder ?? 0) + 1);
}

export async function generateGitHubKnowledgeUnitDraftsForPack(
  userId: string,
  clientId: string,
  packId: string,
  input: GitHubKnowledgeUnitDraftInput,
  deps: GenerateGitHubKnowledgeUnitDraftDeps = {},
): Promise<GitHubKnowledgeUnitDraftResult> {
  const warnings: string[] = [];
  const normalized = normalizeGitHubKnowledgeUnitDraftInput(input, warnings);
  const db = deps.prismaClient ?? prisma;
  const trimmedPackId = packId.trim();

  const assertEditable = deps.assertEditablePack ?? assertProviderPackEditableForClient;
  const editable = await assertEditable(userId, clientId, trimmedPackId);
  if (!editable.ok) {
    throwPreflightError(editable);
  }

  let profile = await db.providerProfile.findFirst({ where: { userId } });
  if (!profile && clientId) {
    const legacy = await db.providerProfile.findUnique({ where: { clientId } });
    if (legacy && !legacy.userId) profile = legacy;
  }
  if (!profile) {
    throwPreflightError({ ok: false, error: "PROFILE_REQUIRED" });
  }

  const pack = await db.knowledgePack.findFirst({
    where: { packId: editable.packId, providerProfileId: profile.id },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sourceDocuments: true },
      },
    },
  });

  if (!pack?.versions[0]) {
    throw new GitHubDiscoveryError(
      "INVALID_KNOWLEDGE_UNIT_DRAFT_OPTIONS",
      "지식팩 버전을 찾을 수 없습니다.",
      400,
    );
  }

  const version = pack.versions[0];
  let documents = version.sourceDocuments;

  if (normalized.sourceDocumentIds.length > 0) {
    const idSet = new Set(normalized.sourceDocumentIds);
    documents = documents.filter((d) => idSet.has(d.id));
  }

  if (normalized.sourceDocumentPaths.length > 0) {
    documents = documents.filter((d) => matchesSourcePath(d, normalized.sourceDocumentPaths));
  }

  if (
    normalized.sourceDocumentIds.length === 0 &&
    normalized.sourceDocumentPaths.length === 0
  ) {
    documents = documents.filter((d) => d.sourceUrl?.startsWith("https://github.com/"));
  }

  const existingDrafts = await db.knowledgeChunk.findMany({
    where: {
      versionId: version.id,
      chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
    },
    select: { id: true, sourceDocumentId: true, title: true, content: true, metadata: true },
  });

  const existingDedupRecords: KuDraftDedupRecord[] = existingDrafts
    .filter((chunk) => {
      const meta = readDraftMetadata(chunk.metadata);
      return meta.reviewStatus === "pending_review";
    })
    .map((chunk) => {
      const meta = readDraftMetadata(chunk.metadata);
      const evidence = meta.evidence;
      return {
        sourceDocumentId: chunk.sourceDocumentId ?? "",
        title: chunk.title,
        sourcePath: meta.sourcePath,
        primaryHeading:
          typeof (chunk.metadata as Record<string, unknown> | null)?.primaryHeading === "string"
            ? String((chunk.metadata as Record<string, unknown>).primaryHeading)
            : evidence?.headings?.[0] ?? null,
        contentChecksum:
          typeof (chunk.metadata as Record<string, unknown> | null)?.contentChecksum === "string"
            ? String((chunk.metadata as Record<string, unknown>).contentChecksum)
            : chunk.content.slice(0, 120),
      };
    });

  const skippedDocuments: GitHubKnowledgeUnitDraftResult["skippedDocuments"] = [];
  const failedDocuments: GitHubKnowledgeUnitDraftResult["failedDocuments"] = [];
  let existingDraftSkippedCount = 0;
  const eligible: SourceDocument[] = [];

  for (const doc of documents) {
    if (!doc.content?.trim()) {
      skippedDocuments.push({ sourceDocumentId: doc.id, reason: "CONTENT_REQUIRED" });
      continue;
    }
    if (!doc.sourceUrl?.trim()) {
      skippedDocuments.push({ sourceDocumentId: doc.id, reason: "SOURCE_URL_REQUIRED" });
      continue;
    }
    if (!doc.sourceUrl.startsWith("https://github.com/")) {
      skippedDocuments.push({ sourceDocumentId: doc.id, reason: "NON_GITHUB_SOURCE" });
      continue;
    }
    if (doc.validationStatus === "FAIL") {
      skippedDocuments.push({ sourceDocumentId: doc.id, reason: "SOURCE_VALIDATION_FAILED" });
      continue;
    }
    if (doc.content.trim().length < SOURCE_DOCUMENT_MIN_CONTENT_LENGTH) {
      skippedDocuments.push({ sourceDocumentId: doc.id, reason: "CONTENT_TOO_SHORT" });
      continue;
    }
    eligible.push(doc);
  }

  if (normalized.sourceDocumentIds.length > 0) {
    const versionDocIds = new Set(version.sourceDocuments.map((d) => d.id));
    for (const requestedId of normalized.sourceDocumentIds) {
      if (!versionDocIds.has(requestedId)) {
        failedDocuments.push({
          sourceDocumentId: requestedId,
          error: "SOURCE_DOCUMENT_NOT_FOUND",
        });
      }
    }
  }

  if (normalized.overwriteExistingDrafts && eligible.length > 0) {
    const overwriteIds = new Set(eligible.map((d) => d.id));
    const toSupersede = existingDrafts.filter(
      (c) => c.sourceDocumentId && overwriteIds.has(c.sourceDocumentId),
    );
    for (const chunk of toSupersede) {
      const meta =
        chunk.metadata && typeof chunk.metadata === "object" && !Array.isArray(chunk.metadata)
          ? { ...(chunk.metadata as Record<string, unknown>) }
          : {};
      meta.reviewStatus = "superseded";
      await db.knowledgeChunk.update({
        where: { id: chunk.id },
        data: { metadata: meta as Prisma.InputJsonValue, isActive: false },
      });
    }
  }

  const allCandidates = eligible.flatMap((doc) =>
    buildDraftCandidatesForSourceDocument(
      toDraftInput(doc),
      normalized.productProfileType,
    ),
  );

  const selectedRaw = selectDraftCandidates(
    allCandidates,
    normalized.targetKnowledgeUnitCount,
    normalized.maxKnowledgeUnitCount,
  );

  const { kept: batchDeduped, mergedCount: batchMerged } = dedupeKuDraftCandidates(selectedRaw);
  if (batchMerged > 0) {
    warnings.push(`동일 주제 중복 ${batchMerged}건을 자동 병합(생성 제외)했습니다.`);
  }

  const selected = batchDeduped.filter((candidate) => {
    const record: KuDraftDedupRecord = {
      sourceDocumentId: candidate.sourceDocumentId,
      title: candidate.title,
      sourcePath: candidate.sourcePath,
      primaryHeading: candidate.primaryHeading,
      contentChecksum: candidate.contentChecksum,
    };
    return !existingDedupRecords.some((existing) => isKuDraftDuplicate(record, existing));
  });

  const skippedByExisting = batchDeduped.length - selected.length;
  if (skippedByExisting > 0) {
    existingDraftSkippedCount += skippedByExisting;
    warnings.push(`기존 Unit과 중복된 ${skippedByExisting}건은 새로 생성하지 않았습니다.`);
  }

  let sortOrder = await nextSortOrder(db, version.id, 1);
  const drafts: GitHubKnowledgeUnitDraftResult["drafts"] = [];

  for (const candidate of selected) {
    const unitId = `ku_${candidate.sourceDocumentId}_${candidate.unitSlug}`;
    const siblingTitles = selected
      .filter((c) => c.sourceDocumentId === candidate.sourceDocumentId)
      .map((c) => c.title);
    const unitWarnings = buildKuDraftActionableWarnings({
      title: candidate.title,
      sourcePath: candidate.sourcePath,
      siblingTitles,
    });

    const metadata = buildDraftChunkMetadata({
      unitId,
      sourceDocumentId: candidate.sourceDocumentId,
      sourceUrl: candidate.sourceUrl,
      sourcePath: candidate.sourcePath,
      sourceType: candidate.sourceType,
      sourceFormat: candidate.sourceFormat,
      generationMode: normalized.generationMode,
      productProfileType: normalized.productProfileType,
      evidenceHeadings: candidate.evidenceHeadings,
      evidenceKeywords: candidate.evidenceKeywords,
      topic: candidate.topic,
      primaryHeading: candidate.primaryHeading,
      sourceExcerpt: candidate.sourceExcerpt,
      contentChecksum: candidate.contentChecksum,
      warnings: unitWarnings,
    });

    try {
      const created = await db.knowledgeChunk.create({
        data: {
          versionId: version.id,
          sourceDocumentId: candidate.sourceDocumentId,
          chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
          title: candidate.title,
          content: candidate.content,
          section: candidate.section,
          tags: candidate.tags,
          metadata: metadata as Prisma.InputJsonValue,
          sortOrder,
          isActive: false,
        },
      });
      sortOrder += 1;
      drafts.push({
        id: created.id,
        sourceDocumentId: candidate.sourceDocumentId,
        title: candidate.title,
        section: candidate.section,
        tags: candidate.tags,
        reviewStatus: "pending_review",
        generatedBy: "github-auto-collector",
        sourcePath: candidate.sourcePath ?? undefined,
        sourceUrl: candidate.sourceUrl ?? undefined,
      });
    } catch {
      failedDocuments.push({
        sourceDocumentId: candidate.sourceDocumentId,
        error: "DRAFT_PERSIST_FAILED",
      });
    }
  }

  return {
    clientId,
    packId: editable.packId,
    versionId: version.id,
    summary: {
      sourceDocumentCount: eligible.length,
      generatedDraftCount: drafts.length,
      skippedDocumentCount: skippedDocuments.length,
      existingDraftSkippedCount,
      failedCount: failedDocuments.length,
      generationMode: normalized.generationMode,
      targetKnowledgeUnitCount: normalized.targetKnowledgeUnitCount,
    },
    drafts,
    skippedDocuments,
    failedDocuments,
    warnings,
  };
}

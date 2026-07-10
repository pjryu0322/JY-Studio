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
  applyGenerationSafetyLimit,
  buildDraftCandidatesForSourceDocument,
  buildDraftChunkMetadata,
  extractGitHubPathFromSourceUrl,
  type DraftCandidate,
  type SourceDocumentDraftInput,
} from "./github-knowledge-unit-draft-generator";
import { getKuSourceDocumentExclusionReason } from "@/lib/knowledge-unit-draft/ku-draft-processing-status";
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
import {
  AUTO_KU_GENERATION_REPORT_CHUNK_TYPE,
  serializeKuGenerationReport,
  type KuGenerationDocumentOutcome,
} from "@/lib/knowledge-unit-draft/ku-draft-generation-report";
import { readDraftMetadata } from "@/lib/provider-knowledge-unit-draft-dto";
import type { GitHubKnowledgeUnitDocumentProcessingOutcome } from "./github-auto-collect-types";

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

const SKIP_REASON_LABELS: Record<string, string> = {
  CONTENT_REQUIRED: "본문이 비어 있음",
  SOURCE_URL_REQUIRED: "원천 URL 없음",
  NON_GITHUB_SOURCE: "GitHub 원천이 아님",
  SOURCE_VALIDATION_FAILED: "원천 문서 검증 실패",
  CONTENT_TOO_SHORT: "본문이 너무 짧음",
  METADATA_FILE: "메타데이터 파일",
  LOCK_FILE: "의존성 잠금 파일",
};

function docPath(doc: SourceDocument): string {
  return (
    extractGitHubPathFromSourceUrl(doc.sourceUrl) ??
    doc.fileName?.replace(/\\/g, "/") ??
    doc.title
  );
}

function candidateToDedupRecord(candidate: DraftCandidate): KuDraftDedupRecord {
  return {
    sourceDocumentId: candidate.sourceDocumentId,
    title: candidate.title,
    sourcePath: candidate.sourcePath,
    primaryHeading: candidate.primaryHeading,
    contentChecksum: candidate.contentChecksum,
  };
}

async function upsertKuGenerationReport(
  db: typeof prisma,
  versionId: string,
  payload: {
    generationScope: string;
    isPreviewGeneration: boolean;
    documents: KuGenerationDocumentOutcome[];
  },
): Promise<void> {
  const content = serializeKuGenerationReport({
    versionId,
    generatedAt: new Date().toISOString(),
    generationScope: payload.generationScope,
    isPreviewGeneration: payload.isPreviewGeneration,
    documents: payload.documents,
  });

  const existing = await db.knowledgeChunk.findFirst({
    where: { versionId, chunkType: AUTO_KU_GENERATION_REPORT_CHUNK_TYPE },
    select: { id: true },
  });

  if (existing) {
    await db.knowledgeChunk.update({
      where: { id: existing.id },
      data: { content, updatedAt: new Date() },
    });
    return;
  }

  const sortOrder = await nextSortOrder(db, versionId, 0);
  await db.knowledgeChunk.create({
    data: {
      versionId,
      chunkType: AUTO_KU_GENERATION_REPORT_CHUNK_TYPE,
      title: "__ku_generation_report__",
      content,
      tags: ["github-auto-collect", "generation-report"],
      metadata: { reviewStatus: "system" } as Prisma.InputJsonValue,
      sortOrder,
      isActive: false,
    },
  });
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

  const existingDedupRecords: Array<{ id: string; record: KuDraftDedupRecord }> = existingDrafts
    .filter((chunk) => {
      const meta = readDraftMetadata(chunk.metadata);
      return meta.reviewStatus === "pending_review";
    })
    .map((chunk) => {
      const meta = readDraftMetadata(chunk.metadata);
      const evidence = meta.evidence;
      return {
        id: chunk.id,
        record: {
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
        },
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
    const metadataExclusion = getKuSourceDocumentExclusionReason({
      id: doc.id,
      title: doc.title,
      sourceUrl: doc.sourceUrl,
      fileName: doc.fileName,
      content: doc.content,
      validationStatus: doc.validationStatus,
      validationSummary: doc.validationSummary,
    });
    if (metadataExclusion) {
      skippedDocuments.push({
        sourceDocumentId: doc.id,
        reason:
          metadataExclusion === "메타데이터 파일"
            ? "METADATA_FILE"
            : metadataExclusion === "의존성 잠금 파일"
              ? "LOCK_FILE"
              : "SOURCE_VALIDATION_FAILED",
      });
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

  const selectedRaw = applyGenerationSafetyLimit(allCandidates, {
    maxPerRun: normalized.maxKnowledgeUnitCount,
    scope: normalized.generationScope,
    targetCount: normalized.targetKnowledgeUnitCount,
  });

  const isPreviewGeneration = normalized.generationScope === "limited_preview";
  if (isPreviewGeneration) {
    warnings.push("미리보기 생성(limited_preview) 모드입니다. 일부 Unit만 생성됩니다.");
  } else if (selectedRaw.length < allCandidates.length && allCandidates.length > normalized.maxKnowledgeUnitCount) {
    warnings.push(
      `비정상적으로 많은 후보(${allCandidates.length}건)로 hard limit ${normalized.maxKnowledgeUnitCount}건을 적용했습니다. 문서당 최소 1개 Unit은 유지합니다.`,
    );
  }

  const { kept: batchDeduped, mergedCount: batchMerged } = dedupeKuDraftCandidates(selectedRaw);
  if (batchMerged > 0) {
    warnings.push(`동일 주제 중복 ${batchMerged}건을 자동 병합(생성 제외)했습니다.`);
  }

  const selected: DraftCandidate[] = [];
  const skippedExistingByDoc = new Map<string, { count: number; duplicateOfChunkId?: string }>();

  for (const candidate of batchDeduped) {
    const record = candidateToDedupRecord(candidate);
    const duplicateEntry = existingDedupRecords.find((existing) =>
      isKuDraftDuplicate(record, existing.record),
    );
    if (duplicateEntry) {
      existingDraftSkippedCount += 1;
      const bucket = skippedExistingByDoc.get(candidate.sourceDocumentId) ?? { count: 0 };
      bucket.count += 1;
      bucket.duplicateOfChunkId = bucket.duplicateOfChunkId ?? duplicateEntry.id;
      skippedExistingByDoc.set(candidate.sourceDocumentId, bucket);
      continue;
    }
    selected.push(candidate);
  }

  if (existingDraftSkippedCount > 0) {
    warnings.push(`기존 Unit과 중복된 ${existingDraftSkippedCount}건은 새로 생성하지 않았습니다.`);
  }

  const createdTitlesByDoc = new Map<string, string[]>();
  const rawCandidatesByDoc = new Map<string, number>();
  for (const candidate of allCandidates) {
    rawCandidatesByDoc.set(
      candidate.sourceDocumentId,
      (rawCandidatesByDoc.get(candidate.sourceDocumentId) ?? 0) + 1,
    );
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
      const titles = createdTitlesByDoc.get(candidate.sourceDocumentId) ?? [];
      titles.push(candidate.title);
      createdTitlesByDoc.set(candidate.sourceDocumentId, titles);
    } catch {
      failedDocuments.push({
        sourceDocumentId: candidate.sourceDocumentId,
        error: "DRAFT_PERSIST_FAILED",
      });
    }
  }

  const skippedById = new Map(skippedDocuments.map((s) => [s.sourceDocumentId, s.reason]));
  const failedById = new Map(failedDocuments.map((f) => [f.sourceDocumentId, f.error]));
  const eligibleIds = new Set(eligible.map((d) => d.id));

  const existingTitlesByDoc = new Map<string, string[]>();
  for (const chunk of existingDrafts) {
    const meta = readDraftMetadata(chunk.metadata);
    if (meta.reviewStatus !== "pending_review" || !chunk.sourceDocumentId) continue;
    const bucket = existingTitlesByDoc.get(chunk.sourceDocumentId) ?? [];
    bucket.push(chunk.title);
    existingTitlesByDoc.set(chunk.sourceDocumentId, bucket);
  }

  const reportDocuments: KuGenerationDocumentOutcome[] = version.sourceDocuments.map((doc) => {
    const path = docPath(doc);
    const createdTitles = createdTitlesByDoc.get(doc.id) ?? [];
    const existingTitles = existingTitlesByDoc.get(doc.id) ?? [];

    if (skippedById.has(doc.id)) {
      const reason = SKIP_REASON_LABELS[skippedById.get(doc.id)!] ?? skippedById.get(doc.id)!;
      return {
        sourceDocumentId: doc.id,
        status: "excluded",
        reason,
        generatedUnitTitles: [],
        steps: [path, "Knowledge Unit 생성 안 함", `사유: ${reason}`],
      };
    }

    if (failedById.has(doc.id)) {
      const reason = failedById.get(doc.id)!;
      return {
        sourceDocumentId: doc.id,
        status: "failed",
        reason,
        generatedUnitTitles: [],
        steps: [path, "처리 실패", reason],
      };
    }

    if (createdTitles.length > 0) {
      return {
        sourceDocumentId: doc.id,
        status: "generated",
        generatedUnitTitles: createdTitles,
        steps:
          createdTitles.length === 1
            ? [path, `${createdTitles[0]} 생성`, "PASS"]
            : [path, `${createdTitles.length}개의 Unit 생성`, createdTitles.join(" · ")],
      };
    }

    if (!eligibleIds.has(doc.id)) {
      return {
        sourceDocumentId: doc.id,
        status: "excluded",
        reason: "이번 생성 범위에 포함되지 않음",
        generatedUnitTitles: existingTitles,
        steps: [path, "생성 범위 제외"],
      };
    }

    const dupInfo = skippedExistingByDoc.get(doc.id);
    if (dupInfo && (rawCandidatesByDoc.get(doc.id) ?? 0) > 0) {
      const reason = "기존 Knowledge Unit과 중복 (sourcePath · heading · checksum)";
      return {
        sourceDocumentId: doc.id,
        status: "deduped",
        reason,
        duplicateOfChunkId: dupInfo.duplicateOfChunkId,
        generatedUnitTitles: existingTitles,
        steps: [path, "Knowledge Unit 생성 안 함", `사유: ${reason}`],
      };
    }

    if ((rawCandidatesByDoc.get(doc.id) ?? 0) === 0) {
      return {
        sourceDocumentId: doc.id,
        status: "failed",
        reason: "Knowledge Unit 후보 생성 실패",
        generatedUnitTitles: existingTitles,
        steps: [path, "후보 생성 실패"],
      };
    }

    if (existingTitles.length > 0) {
      return {
        sourceDocumentId: doc.id,
        status: "deduped",
        reason: "기존 검토 대기 Unit이 있어 새로 생성하지 않음",
        generatedUnitTitles: existingTitles,
        steps: [path, "기존 Unit 유지", existingTitles.join(" · ")],
      };
    }

    return {
      sourceDocumentId: doc.id,
      status: "failed",
      reason: "이번 실행에서 Unit이 생성되지 않음",
      generatedUnitTitles: [],
      steps: [path, "처리 실패", "Unit 미생성"],
    };
  });

  await upsertKuGenerationReport(db, version.id, {
    generationScope: normalized.generationScope,
    isPreviewGeneration,
    documents: reportDocuments,
  });

  const documentProcessing: GitHubKnowledgeUnitDocumentProcessingOutcome[] = reportDocuments.map(
    (doc) => ({
      sourceDocumentId: doc.sourceDocumentId,
      status: doc.status,
      reason: doc.reason,
      generatedUnitTitles: doc.generatedUnitTitles,
      duplicateOfChunkId: doc.duplicateOfChunkId,
      steps: doc.steps,
    }),
  );

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
      generationScope: normalized.generationScope,
      targetKnowledgeUnitCount: normalized.targetKnowledgeUnitCount,
      maxKnowledgeUnitCount: normalized.maxKnowledgeUnitCount,
      isPreviewGeneration,
    },
    drafts,
    skippedDocuments,
    failedDocuments,
    documentProcessing,
    warnings,
  };
}

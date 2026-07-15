import {
  DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
  DOCLING_KNOWLEDGE_STAGES,
  DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE,
  DOCLING_RETRIEVAL_CHUNK_TYPE,
  type DoclingKnowledgeStageId,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { prisma } from "@/lib/prisma";
import { DoclingImportBundleStatus } from "@prisma/client";

const STAGE_IDS = new Set(DOCLING_KNOWLEDGE_STAGES.map((s) => s.id));

export function isDoclingKnowledgeExportStageId(
  value: string,
): value is DoclingKnowledgeStageId {
  return STAGE_IDS.has(value as DoclingKnowledgeStageId);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function safeFilePart(value: string): string {
  return value.replace(/[^\w.\-가-힣]+/g, "_").slice(0, 80) || "pack";
}

function chunkForExport(chunk: {
  id: string;
  chunkType: string;
  title: string;
  content: string;
  section: string | null;
  tags: string[];
  sortOrder: number;
  isActive: boolean;
  sourceDocumentId: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: chunk.id,
    chunkType: chunk.chunkType,
    title: chunk.title,
    content: chunk.content,
    section: chunk.section,
    tags: chunk.tags,
    sortOrder: chunk.sortOrder,
    isActive: chunk.isActive,
    sourceDocumentId: chunk.sourceDocumentId,
    metadata: chunk.metadata,
    createdAt: chunk.createdAt.toISOString(),
    updatedAt: chunk.updatedAt.toISOString(),
  };
}

export async function exportDoclingKnowledgePipelineStage(input: {
  userId: string;
  clientId: string;
  packId: string;
  stageId: DoclingKnowledgeStageId;
}): Promise<
  | { ok: true; fileName: string; mimeType: string; body: string }
  | {
      error: "PROFILE_REQUIRED" | "NOT_FOUND" | "NOT_READY" | "INVALID_STAGE";
      message: string;
    }
> {
  if (!isDoclingKnowledgeExportStageId(input.stageId)) {
    return { error: "INVALID_STAGE", message: "알 수 없는 단계입니다." };
  }

  const profile = await findOrEnsureProviderProfileForUser(input.userId, input.clientId);
  if (!profile) {
    return { error: "PROFILE_REQUIRED", message: "제공자 프로필이 필요합니다." };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: profile.id },
    select: { packId: true, name: true },
  });
  if (!pack) return { error: "NOT_FOUND", message: "지식팩을 찾을 수 없습니다." };

  const version = await prisma.knowledgePackVersion.findFirst({
    where: { packId: input.packId },
    orderBy: latestKnowledgePackVersionOrderBy,
    select: { id: true, version: true },
  });
  if (!version) return { error: "NOT_FOUND", message: "버전을 찾을 수 없습니다." };

  const latest = await prisma.pipelineRun.findFirst({
    where: { packId: input.packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER },
    orderBy: { startedAt: "desc" },
    include: { steps: true },
  });
  if (!latest) {
    return {
      error: "NOT_READY",
      message: "지식 데이터 생성 결과가 없습니다. 먼저 생성을 완료해 주세요.",
    };
  }

  const stageMeta = DOCLING_KNOWLEDGE_STAGES.find((s) => s.id === input.stageId)!;
  const step = latest.steps.find((s) => s.step === stageMeta.pipelineStep);
  if (!step || (step.status !== "PASS" && step.status !== "WARNING")) {
    return {
      error: "NOT_READY",
      message: `${stageMeta.label} 결과가 아직 없어 다운로드할 수 없습니다.`,
    };
  }

  const binding = parseKnowledgeRunBinding(latest.summary);
  const indexGenerationId =
    binding?.indexGenerationId ??
    (typeof asRecord(step.details)?.indexGenerationId === "string"
      ? String(asRecord(step.details)!.indexGenerationId)
      : null);

  const bundle = await prisma.doclingImportBundle.findFirst({
    where: {
      packId: input.packId,
      versionId: version.id,
      isActive: true,
      status: DoclingImportBundleStatus.REVIEW_READY,
      ...(binding?.bundleId ? { id: binding.bundleId } : {}),
    },
    select: { id: true, status: true },
  });

  const nd = await prisma.normalizedDocument.findFirst({
    where: {
      packId: input.packId,
      versionId: version.id,
      isActive: true,
      ...(binding?.normalizedDocumentId ? { id: binding.normalizedDocumentId } : {}),
    },
  });

  const exportedAt = new Date().toISOString();
  const baseMeta = {
    packId: input.packId,
    packTitle: pack.name,
    versionId: version.id,
    versionLabel: version.version,
    stageId: input.stageId,
    stageLabel: stageMeta.label,
    pipelineRunId: latest.id,
    pipelineRunStatus: latest.status,
    stepStatus: step.status,
    stepMessage: step.message,
    stepDetails: step.details,
    indexGenerationId,
    bundleId: bundle?.id ?? binding?.bundleId ?? null,
    normalizedDocumentId: nd?.id ?? binding?.normalizedDocumentId ?? null,
    fingerprint: nd?.fingerprint ?? binding?.fingerprint ?? null,
    exportedAt,
  };

  let payload: Record<string, unknown> = { ...baseMeta };

  if (input.stageId === "STRUCTURE") {
    if (!nd) {
      return {
        error: "NOT_READY",
        message: "정규화 문서가 없어 문서 구조 데이터를 다운로드할 수 없습니다.",
      };
    }
    payload = {
      ...baseMeta,
      normalizedDocument: {
        id: nd.id,
        title: nd.title,
        language: nd.language,
        fingerprint: nd.fingerprint,
        fingerprintVersion: nd.fingerprintVersion,
        adapterType: nd.adapterType,
        adapterVersion: nd.adapterVersion,
        structureSummaryJson: nd.structureSummaryJson,
        sectionsJson: nd.sectionsJson,
        tablesJson: nd.tablesJson,
        figuresJson: nd.figuresJson,
        readingOrderJson: nd.readingOrderJson,
        warningsJson: nd.warningsJson,
        createdAt: nd.createdAt.toISOString(),
        updatedAt: nd.updatedAt.toISOString(),
      },
    };
  } else if (input.stageId === "KNOWLEDGE_UNIT" || input.stageId === "RETRIEVAL_CHUNK") {
    const chunkType =
      input.stageId === "KNOWLEDGE_UNIT"
        ? DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE
        : DOCLING_RETRIEVAL_CHUNK_TYPE;
    const chunks = await prisma.knowledgeChunk.findMany({
      where: {
        versionId: version.id,
        chunkType,
      },
      orderBy: { sortOrder: "asc" },
    });
    const filtered = indexGenerationId
      ? chunks.filter((c) => {
          const meta = asRecord(c.metadata);
          return meta?.indexGenerationId === indexGenerationId;
        })
      : chunks.filter((c) => c.isActive);
    payload = {
      ...baseMeta,
      count: filtered.length,
      items: filtered.map(chunkForExport),
    };
  } else if (input.stageId === "SEARCH_INDEX") {
    const chunks = await prisma.knowledgeChunk.findMany({
      where: {
        versionId: version.id,
        chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
      },
      select: {
        id: true,
        title: true,
        isActive: true,
        metadata: true,
        embeddings: {
          select: {
            id: true,
            provider: true,
            model: true,
            dimension: true,
            contentHash: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });
    const filtered = indexGenerationId
      ? chunks.filter((c) => asRecord(c.metadata)?.indexGenerationId === indexGenerationId)
      : chunks.filter((c) => c.isActive);
    payload = {
      ...baseMeta,
      note: "벡터 값(vector)은 용량이 커서 제외하고, Embedding 메타데이터만 포함합니다.",
      count: filtered.length,
      items: filtered.map((c) => ({
        chunkId: c.id,
        title: c.title,
        isActive: c.isActive,
        metadata: c.metadata,
        embeddings: c.embeddings.map((e) => ({
          id: e.id,
          provider: e.provider,
          model: e.model,
          dimension: e.dimension,
          contentHash: e.contentHash,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        })),
      })),
    };
  } else if (input.stageId === "RETRIEVAL_EVALUATION") {
    payload = {
      ...baseMeta,
      evaluation: step.details ?? null,
    };
  }

  const stamp = exportedAt.replace(/[:.]/g, "-");
  const fileName = `${safeFilePart(input.packId)}_${input.stageId}_${stamp}.json`;
  const body = `${JSON.stringify(payload, null, 2)}\n`;

  return {
    ok: true,
    fileName,
    mimeType: "application/json; charset=utf-8",
    body,
  };
}

import { prisma } from "@/lib/prisma";
import { assertProviderPackEditableForClient } from "@/lib/provider-pack-service";
import { AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import {
  readDraftMetadata,
  toProviderKnowledgeUnitDraftDto,
  type ProviderKnowledgeUnitDraftListResponse,
  type ProviderKnowledgeUnitDraftResetResponse,
} from "@/lib/provider-knowledge-unit-draft-dto";
import { buildKuProcessingSummary } from "@/lib/knowledge-unit-draft/ku-draft-processing-status";
import {
  AUTO_KU_GENERATION_REPORT_CHUNK_TYPE,
  kuGenerationReportToDocumentMap,
  parseKuGenerationReportContent,
} from "@/lib/knowledge-unit-draft/ku-draft-generation-report";

export type KnowledgeUnitDraftListStatus = "pending_review" | "superseded" | "all";

export class ProviderKnowledgeUnitDraftListError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ProviderKnowledgeUnitDraftListError";
    this.code = code;
    this.status = status;
  }
}

export type ListProviderKnowledgeUnitDraftDeps = {
  prismaClient?: typeof prisma;
  assertProviderPackEditableForClient?: typeof assertProviderPackEditableForClient;
};

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 50;
  return Math.min(100, Math.max(1, Math.floor(limit)));
}

export async function listProviderKnowledgeUnitDrafts(
  userId: string,
  clientId: string,
  packId: string,
  options?: {
    status?: KnowledgeUnitDraftListStatus;
    sourceDocumentId?: string;
    limit?: number;
  },
  deps: ListProviderKnowledgeUnitDraftDeps = {},
): Promise<ProviderKnowledgeUnitDraftListResponse> {
  const db = deps.prismaClient ?? prisma;
  const trimmedPackId = packId.trim();
  if (!trimmedPackId) {
    throw new ProviderKnowledgeUnitDraftListError(
      "PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED",
      "지식팩을 찾을 수 없습니다.",
      404,
    );
  }

  const status = options?.status ?? "pending_review";
  const limit = clampLimit(options?.limit);
  const sourceDocumentId = options?.sourceDocumentId?.trim() || undefined;

  let profile = await db.providerProfile.findFirst({ where: { userId } });
  if (!profile && clientId) {
    const legacy = await db.providerProfile.findUnique({ where: { clientId } });
    if (legacy && !legacy.userId) profile = legacy;
  }
  if (!profile) {
    throw new ProviderKnowledgeUnitDraftListError(
      "PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED",
      "Provider 프로필이 필요합니다.",
      400,
    );
  }

  const pack = await db.knowledgePack.findFirst({
    where: { packId: trimmedPackId, providerProfileId: profile.id },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sourceDocuments: true },
      },
    },
  });

  if (!pack) {
    throw new ProviderKnowledgeUnitDraftListError(
      "PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED",
      "지식팩을 찾을 수 없습니다.",
      404,
    );
  }

  const version = pack.versions[0];
  if (!version) {
    throw new ProviderKnowledgeUnitDraftListError(
      "PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED",
      "지식팩 버전을 찾을 수 없습니다.",
      400,
    );
  }

  const activeDraftCount = await db.knowledgeChunk.count({
    where: {
      versionId: version.id,
      chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
      isActive: true,
    },
  });

  const chunks = await db.knowledgeChunk.findMany({
    where: {
      versionId: version.id,
      chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
      isActive: false,
      ...(sourceDocumentId ? { sourceDocumentId } : {}),
    },
    include: { sourceDocument: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const dtos = chunks.map((chunk) => toProviderKnowledgeUnitDraftDto(chunk));

  let pendingReviewCount = 0;
  let supersededCount = 0;
  for (const dto of dtos) {
    if (dto.reviewStatus === "pending_review") pendingReviewCount += 1;
    if (dto.reviewStatus === "superseded") supersededCount += 1;
  }

  const filtered =
    status === "all"
      ? dtos
      : dtos.filter((dto) => dto.reviewStatus === status);

  const reportChunk = await db.knowledgeChunk.findFirst({
    where: { versionId: version.id, chunkType: AUTO_KU_GENERATION_REPORT_CHUNK_TYPE },
    select: { content: true },
  });
  const generationReport = parseKuGenerationReportContent(reportChunk?.content);
  const reportByDocumentId = kuGenerationReportToDocumentMap(generationReport);

  const draftsByDocumentId = new Map<string, { title: string; reviewStatus: string }[]>();
  for (const dto of dtos) {
    if (!dto.sourceDocumentId) continue;
    const bucket = draftsByDocumentId.get(dto.sourceDocumentId) ?? [];
    bucket.push({ title: dto.title, reviewStatus: dto.reviewStatus });
    draftsByDocumentId.set(dto.sourceDocumentId, bucket);
  }

  const processingResult = buildKuProcessingSummary(
    version.sourceDocuments.map((doc) => ({
      id: doc.id,
      title: doc.title,
      sourceUrl: doc.sourceUrl,
      fileName: doc.fileName,
      content: doc.content,
      validationStatus: doc.validationStatus,
      validationSummary: doc.validationSummary,
      sourceFormat: doc.sourceFormat,
      mimeType: doc.mimeType,
    })),
    draftsByDocumentId,
    {
      reportByDocumentId,
      generationScope: generationReport?.generationScope,
      isPreviewGeneration: generationReport?.isPreviewGeneration,
    },
  );

  return {
    clientId,
    packId: pack.packId,
    versionId: version.id,
    summary: {
      totalCount: dtos.length,
      pendingReviewCount,
      supersededCount,
      activeDraftCount,
    },
    processing: processingResult.summary,
    documentProcessing: processingResult.documents,
    items: filtered.slice(0, limit),
  };
}

export function parseKnowledgeUnitDraftListQuery(searchParams: URLSearchParams): {
  status: KnowledgeUnitDraftListStatus;
  sourceDocumentId?: string;
  limit: number;
} {
  const rawStatus = searchParams.get("status") ?? "pending_review";
  const status: KnowledgeUnitDraftListStatus =
    rawStatus === "superseded" || rawStatus === "all" ? rawStatus : "pending_review";

  const sourceDocumentId = searchParams.get("sourceDocumentId")?.trim() || undefined;
  const limit = clampLimit(Number(searchParams.get("limit") ?? "50"));

  return { status, sourceDocumentId, limit };
}

export type KnowledgeUnitDraftResetScope =
  | "pending_review_only"
  | "pending_and_superseded"
  | "all_auto_generated";

export async function resetProviderKnowledgeUnitDrafts(
  userId: string,
  clientId: string,
  packId: string,
  options?: { scope?: KnowledgeUnitDraftResetScope },
  deps: ListProviderKnowledgeUnitDraftDeps = {},
): Promise<ProviderKnowledgeUnitDraftResetResponse> {
  const db = deps.prismaClient ?? prisma;
  const assertEditable = deps.assertProviderPackEditableForClient ?? assertProviderPackEditableForClient;
  const scope = options?.scope ?? "pending_and_superseded";
  const trimmedPackId = packId.trim();
  if (!trimmedPackId) {
    throw new ProviderKnowledgeUnitDraftListError(
      "PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED",
      "지식팩을 찾을 수 없습니다.",
      404,
    );
  }

  let profile = await db.providerProfile.findFirst({ where: { userId } });
  if (!profile && clientId) {
    const legacy = await db.providerProfile.findUnique({ where: { clientId } });
    if (legacy && !legacy.userId) profile = legacy;
  }
  if (!profile) {
    throw new ProviderKnowledgeUnitDraftListError(
      "PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED",
      "Provider 프로필이 필요합니다.",
      400,
    );
  }

  const editable = await assertEditable(userId, clientId, trimmedPackId);
  if (!editable.ok) {
    throw new ProviderKnowledgeUnitDraftListError(
      "PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED",
      editable.error === "NOT_FOUND" ? "지식팩을 찾을 수 없습니다." : "초안(DRAFT) 상태에서만 초기화할 수 있습니다.",
      editable.error === "NOT_FOUND" ? 404 : 409,
    );
  }

  const pack = await db.knowledgePack.findFirst({
    where: { packId: editable.packId, providerProfileId: profile.id },
    include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const version = pack?.versions[0];
  if (!version) {
    throw new ProviderKnowledgeUnitDraftListError(
      "PROVIDER_KNOWLEDGE_UNIT_DRAFTS_FAILED",
      "지식팩 버전을 찾을 수 없습니다.",
      400,
    );
  }

  const chunks = await db.knowledgeChunk.findMany({
    where: {
      versionId: version.id,
      chunkType: { in: [AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE, AUTO_KU_GENERATION_REPORT_CHUNK_TYPE] },
    },
    select: { id: true, chunkType: true, metadata: true },
  });

  const idsToDelete: string[] = [];
  let deletedDraftCount = 0;
  let deletedReportCount = 0;

  for (const chunk of chunks) {
    if (chunk.chunkType === AUTO_KU_GENERATION_REPORT_CHUNK_TYPE) {
      idsToDelete.push(chunk.id);
      deletedReportCount += 1;
      continue;
    }
    const reviewStatus = readDraftMetadata(chunk.metadata).reviewStatus;
    const shouldDelete =
      scope === "all_auto_generated" ||
      (scope === "pending_review_only" && reviewStatus === "pending_review") ||
      (scope === "pending_and_superseded" &&
        (reviewStatus === "pending_review" || reviewStatus === "superseded"));
    if (shouldDelete) {
      idsToDelete.push(chunk.id);
      deletedDraftCount += 1;
    }
  }

  if (idsToDelete.length > 0) {
    await db.knowledgeChunk.deleteMany({ where: { id: { in: idsToDelete } } });
  }

  return {
    clientId,
    packId: pack!.packId,
    versionId: version.id,
    deletedDraftCount,
    deletedReportCount,
  };
}

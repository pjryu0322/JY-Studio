import { prisma } from "@/lib/prisma";
import { AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import {
  toProviderKnowledgeUnitDraftDto,
  type ProviderKnowledgeUnitDraftListResponse,
} from "@/lib/provider-knowledge-unit-draft-dto";

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
      versions: { orderBy: { createdAt: "desc" }, take: 1 },
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

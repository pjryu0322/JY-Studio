import type { Prisma } from "@prisma/client";
import { AuditAction } from "@prisma/client";
import { AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import { prisma } from "@/lib/prisma";
import { readDraftMetadata } from "@/lib/provider-knowledge-unit-draft-dto";
import {
  toAdminKnowledgeUnitDraftDto,
  type AdminKnowledgeUnitDraftDecisionResponse,
  type AdminKnowledgeUnitDraftListResponse,
} from "@/lib/admin-knowledge-unit-draft-dto";

export type AdminKnowledgeUnitDraftListStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "superseded"
  | "all";

export class AdminKnowledgeUnitDraftError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AdminKnowledgeUnitDraftError";
    this.code = code;
    this.status = status;
  }
}

export type AdminKnowledgeUnitDraftServiceDeps = {
  prismaClient?: typeof prisma;
};

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 50;
  return Math.min(100, Math.max(1, Math.floor(limit)));
}

function chunkListWhere(packId?: string): Prisma.KnowledgeChunkWhereInput {
  return {
    chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
    isActive: false,
    ...(packId ? { version: { packId } } : {}),
  };
}

function activeDraftCountWhere(packId?: string): Prisma.KnowledgeChunkWhereInput {
  return {
    chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
    isActive: true,
    ...(packId ? { version: { packId } } : {}),
  };
}

export function parseAdminKnowledgeUnitDraftListQuery(searchParams: URLSearchParams): {
  status: AdminKnowledgeUnitDraftListStatus;
  packId?: string;
  limit: number;
} {
  const rawStatus = searchParams.get("status") ?? "pending_review";
  const status: AdminKnowledgeUnitDraftListStatus =
    rawStatus === "approved" ||
    rawStatus === "rejected" ||
    rawStatus === "superseded" ||
    rawStatus === "all"
      ? rawStatus
      : "pending_review";

  const packId = searchParams.get("packId")?.trim() || undefined;
  const limit = clampLimit(Number(searchParams.get("limit") ?? "50"));

  return { status, packId, limit };
}

export async function listAdminKnowledgeUnitDrafts(
  clientId: string,
  options?: {
    status?: AdminKnowledgeUnitDraftListStatus;
    packId?: string;
    limit?: number;
  },
  deps: AdminKnowledgeUnitDraftServiceDeps = {},
): Promise<AdminKnowledgeUnitDraftListResponse> {
  const db = deps.prismaClient ?? prisma;
  const status = options?.status ?? "pending_review";
  const packId = options?.packId?.trim() || undefined;
  const limit = clampLimit(options?.limit);

  const chunks = await db.knowledgeChunk.findMany({
    where: chunkListWhere(packId),
    include: {
      sourceDocument: true,
      version: { include: { pack: true } },
    },
    orderBy: [{ createdAt: "desc" }, { sortOrder: "asc" }],
  });

  const activeDraftCount = await db.knowledgeChunk.count({
    where: activeDraftCountWhere(packId),
  });

  const dtos = chunks.map((chunk) => toAdminKnowledgeUnitDraftDto(chunk));

  let pendingReviewCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let supersededCount = 0;
  for (const dto of dtos) {
    if (dto.reviewStatus === "pending_review") pendingReviewCount += 1;
    if (dto.reviewStatus === "approved") approvedCount += 1;
    if (dto.reviewStatus === "rejected") rejectedCount += 1;
    if (dto.reviewStatus === "superseded") supersededCount += 1;
  }

  const filtered =
    status === "all" ? dtos : dtos.filter((dto) => dto.reviewStatus === status);

  return {
    clientId,
    summary: {
      totalCount: dtos.length,
      pendingReviewCount,
      approvedCount,
      rejectedCount,
      supersededCount,
      activeDraftCount,
    },
    items: filtered.slice(0, limit),
  };
}

const DECISION_ERROR_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  NOT_DRAFT: 400,
  ALREADY_ACTIVE: 409,
  NOT_PENDING_REVIEW: 409,
  VALIDATION: 400,
  REJECTION_REASON_REQUIRED: 400,
};

const DECISION_ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "초안을 찾을 수 없습니다.",
  NOT_DRAFT: "초안을 찾을 수 없습니다.",
  ALREADY_ACTIVE: "이미 활성화된 초안은 처리할 수 없습니다.",
  NOT_PENDING_REVIEW: "검토 대기 상태의 초안만 처리할 수 있습니다.",
  VALIDATION: "요청값이 올바르지 않습니다.",
  REJECTION_REASON_REQUIRED: "반려 사유를 입력해 주세요.",
};

function decisionError(code: keyof typeof DECISION_ERROR_MESSAGES): never {
  throw new AdminKnowledgeUnitDraftError(
    code,
    DECISION_ERROR_MESSAGES[code] ?? "요청을 처리하지 못했습니다.",
    DECISION_ERROR_STATUS[code] ?? 400,
  );
}

export async function decideAdminKnowledgeUnitDraft(
  clientId: string,
  input: {
    draftId: string;
    decision: "approve" | "reject";
    memo?: string;
    rejectionReason?: string;
  },
  deps: AdminKnowledgeUnitDraftServiceDeps = {},
): Promise<AdminKnowledgeUnitDraftDecisionResponse> {
  const db = deps.prismaClient ?? prisma;
  const draftId = input.draftId.trim();
  if (!draftId) decisionError("NOT_FOUND");

  if (input.decision !== "approve" && input.decision !== "reject") {
    decisionError("VALIDATION");
  }

  if (input.decision === "reject" && !input.rejectionReason?.trim()) {
    decisionError("REJECTION_REASON_REQUIRED");
  }

  const chunk = await db.knowledgeChunk.findUnique({
    where: { id: draftId },
    include: {
      sourceDocument: true,
      version: { include: { pack: true } },
    },
  });

  if (!chunk) decisionError("NOT_FOUND");
  if (chunk.chunkType !== AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE) decisionError("NOT_DRAFT");
  if (chunk.isActive) decisionError("ALREADY_ACTIVE");

  const previousMeta = readDraftMetadata(chunk.metadata);
  if (previousMeta.reviewStatus !== "pending_review") {
    decisionError("NOT_PENDING_REVIEW");
  }

  const now = new Date();
  const memo = input.memo?.trim() || null;
  const rejectionReason = input.rejectionReason?.trim() || null;

  const existing =
    chunk.metadata && typeof chunk.metadata === "object" && !Array.isArray(chunk.metadata)
      ? (chunk.metadata as Record<string, unknown>)
      : {};

  const nextMetadata: Record<string, unknown> =
    input.decision === "approve"
      ? {
          ...existing,
          reviewStatus: "approved",
          reviewDecision: "approve",
          reviewedBy: clientId,
          reviewedAt: now.toISOString(),
          reviewMemo: memo,
          approvedForActivation: true,
        }
      : {
          ...existing,
          reviewStatus: "rejected",
          reviewDecision: "reject",
          reviewedBy: clientId,
          reviewedAt: now.toISOString(),
          reviewMemo: memo,
          rejectionReason,
          approvedForActivation: false,
        };

  const updated = await db.knowledgeChunk.update({
    where: { id: chunk.id },
    data: {
      metadata: nextMetadata as Prisma.InputJsonValue,
      isActive: false,
    },
    include: {
      sourceDocument: true,
      version: { include: { pack: true } },
    },
  });

  await db.auditLog.create({
    data: {
      action: AuditAction.ADMIN_CHUNK_UPDATE,
      entityType: "KnowledgeChunk",
      entityId: updated.id,
      metadata: {
        draftId: updated.id,
        decision: input.decision,
        reviewStatus: input.decision === "approve" ? "approved" : "rejected",
        memo,
        rejectionReason,
        previousReviewStatus: previousMeta.reviewStatus,
      } as Prisma.InputJsonValue,
    },
  });

  return {
    clientId,
    draft: toAdminKnowledgeUnitDraftDto(updated),
  };
}

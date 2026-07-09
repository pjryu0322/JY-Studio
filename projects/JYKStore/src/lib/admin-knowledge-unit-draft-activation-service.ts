import type { Prisma } from "@prisma/client";
import { AuditAction, type KnowledgeChunk } from "@prisma/client";
import { AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import {
  toAdminKnowledgeUnitDraftDto,
  readAdminDraftActivationFields,
  readAdminDraftReviewFields,
} from "@/lib/admin-knowledge-unit-draft-dto";
import {
  AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE,
  toActivatedKnowledgeUnitChunkDto,
  type AdminKnowledgeUnitDraftActivationResponse,
  readActivatedChunkMetadata,
} from "@/lib/admin-knowledge-unit-draft-activation-dto";
import { prisma } from "@/lib/prisma";
import { readDraftMetadata } from "@/lib/provider-knowledge-unit-draft-dto";

const TITLE_MIN = 2;
const TITLE_MAX = 120;
const CONTENT_MIN = 20;
const CONTENT_MAX = 4000;

export class AdminKnowledgeUnitDraftActivationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AdminKnowledgeUnitDraftActivationError";
    this.code = code;
    this.status = status;
  }
}

const ERROR_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  NOT_DRAFT: 400,
  ALREADY_ACTIVE: 409,
  NOT_APPROVED: 409,
  ALREADY_ACTIVATED: 409,
  VALIDATION: 400,
};

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "초안을 찾을 수 없습니다.",
  NOT_DRAFT: "초안을 찾을 수 없습니다.",
  ALREADY_ACTIVE: "이미 활성화된 초안은 처리할 수 없습니다.",
  NOT_APPROVED: "승인된 초안만 활성화할 수 있습니다.",
  ALREADY_ACTIVATED: "이미 활성화된 초안입니다.",
  VALIDATION: "요청값이 올바르지 않습니다.",
};

function activationError(code: keyof typeof ERROR_MESSAGES): never {
  throw new AdminKnowledgeUnitDraftActivationError(
    code,
    ERROR_MESSAGES[code] ?? "활성화에 실패했습니다.",
    ERROR_STATUS[code] ?? 400,
  );
}

function validateTitle(title: string): void {
  const t = title.trim();
  if (t.length < TITLE_MIN || t.length > TITLE_MAX) activationError("VALIDATION");
}

function validateContent(content: string): void {
  const c = content.trim();
  if (c.length < CONTENT_MIN || c.length > CONTENT_MAX) activationError("VALIDATION");
}

function metadataRecord(metadata: KnowledgeChunk["metadata"]): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

async function findActiveChunkActivatedFromDraft(
  db: typeof prisma,
  versionId: string,
  draftId: string,
) {
  const activeChunks = await db.knowledgeChunk.findMany({
    where: { versionId, isActive: true },
  });
  return activeChunks.find((chunk) => {
    const meta = readActivatedChunkMetadata(chunk.metadata);
    return meta.activatedFromDraftId === draftId;
  });
}

export type ActivateAdminKnowledgeUnitDraftDeps = {
  prismaClient?: typeof prisma;
};

export async function activateAdminKnowledgeUnitDraft(
  clientId: string,
  input: { draftId: string; memo?: string },
  deps: ActivateAdminKnowledgeUnitDraftDeps = {},
): Promise<AdminKnowledgeUnitDraftActivationResponse> {
  const db = deps.prismaClient ?? prisma;
  const draftId = input.draftId.trim();
  if (!draftId) activationError("NOT_FOUND");

  const chunk = await db.knowledgeChunk.findUnique({
    where: { id: draftId },
    include: {
      sourceDocument: true,
      version: { include: { pack: true } },
    },
  });

  if (!chunk) activationError("NOT_FOUND");
  if (chunk.chunkType !== AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE) activationError("NOT_DRAFT");
  if (chunk.isActive) activationError("ALREADY_ACTIVE");

  const draftMeta = readDraftMetadata(chunk.metadata);
  const review = readAdminDraftReviewFields(chunk.metadata);
  const activation = readAdminDraftActivationFields(chunk.metadata);

  if (draftMeta.reviewStatus !== "approved" || review.reviewDecision !== "approve") {
    activationError("NOT_APPROVED");
  }
  if (activation.approvedForActivation !== true) {
    activationError("NOT_APPROVED");
  }
  if (activation.activationStatus === "activated" || activation.activatedChunkId) {
    activationError("ALREADY_ACTIVATED");
  }

  const existingActive = await findActiveChunkActivatedFromDraft(db, chunk.versionId, chunk.id);
  if (existingActive) activationError("ALREADY_ACTIVATED");

  validateTitle(chunk.title);
  validateContent(chunk.content);

  const now = new Date();
  const memo = input.memo?.trim() || null;
  const existing = metadataRecord(chunk.metadata);

  const maxSort = await db.knowledgeChunk.aggregate({
    where: { versionId: chunk.versionId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

  const activeMetadata: Record<string, unknown> = {
    activatedFromDraftId: chunk.id,
    activatedBy: clientId,
    activatedAt: now.toISOString(),
    activationStatus: "active",
    sourcePath: existing.sourcePath ?? draftMeta.sourcePath,
    sourceUrl: existing.sourceUrl ?? draftMeta.sourceUrl,
    productProfileType: existing.productProfileType ?? draftMeta.productProfileType,
    generatedBy: existing.generatedBy ?? draftMeta.generatedBy,
    reviewDecision: "approve",
  };

  const draftNextMetadata: Record<string, unknown> = {
    ...existing,
    activationStatus: "activated",
    activatedBy: clientId,
    activatedAt: now.toISOString(),
  };

  const packId = chunk.version.pack.packId;

  const { activeChunk, updatedDraft } = await db.$transaction(async (tx) => {
    const created = await tx.knowledgeChunk.create({
      data: {
        versionId: chunk.versionId,
        sourceDocumentId: chunk.sourceDocumentId,
        chunkType: AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE,
        title: chunk.title.trim(),
        content: chunk.content.trim(),
        section: chunk.section,
        tags: chunk.tags,
        metadata: activeMetadata as Prisma.InputJsonValue,
        sortOrder,
        isActive: true,
      },
    });

    draftNextMetadata.activatedChunkId = created.id;

    const updated = await tx.knowledgeChunk.update({
      where: { id: chunk.id },
      data: {
        metadata: draftNextMetadata as Prisma.InputJsonValue,
        isActive: false,
      },
      include: {
        sourceDocument: true,
        version: { include: { pack: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.ADMIN_CHUNK_CREATE,
        entityType: "KnowledgeChunk",
        entityId: created.id,
        metadata: {
          draftId: chunk.id,
          activatedChunkId: created.id,
          packId,
          versionId: chunk.versionId,
          sourceDocumentId: chunk.sourceDocumentId,
          memo,
        } as Prisma.InputJsonValue,
      },
    });

    return { activeChunk: created, updatedDraft: updated };
  });

  return {
    clientId,
    draft: toAdminKnowledgeUnitDraftDto(updatedDraft),
    activatedChunk: toActivatedKnowledgeUnitChunkDto(activeChunk),
  };
}

/** Mirrors retrieval candidate store: only isActive=true chunks are searchable. */
export function isRetrievalCandidateChunk(chunk: { isActive: boolean }): boolean {
  return chunk.isActive === true;
}

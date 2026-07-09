import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KnowledgeChunk, KnowledgePack, KnowledgePackVersion, SourceDocument } from "@prisma/client";
import { AuditAction } from "@prisma/client";
import { AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import { toAdminKnowledgeUnitDraftDto } from "@/lib/admin-knowledge-unit-draft-dto";
import {
  decideAdminKnowledgeUnitDraft,
  listAdminKnowledgeUnitDrafts,
  parseAdminKnowledgeUnitDraftListQuery,
  AdminKnowledgeUnitDraftError,
} from "@/lib/admin-knowledge-unit-draft-service";
import { canDecideKnowledgeUnitDraft } from "@/lib/admin-knowledge-unit-draft-ui-utils";

type ChunkWhere = {
  versionId?: string;
  chunkType?: string;
  isActive?: boolean;
  sourceDocumentId?: string;
  version?: { packId?: string };
};

type ChunkRow = KnowledgeChunk & {
  sourceDocument: SourceDocument | null;
  version: KnowledgePackVersion & { pack: KnowledgePack };
};

function matchesChunkWhere(chunk: ChunkRow, where: ChunkWhere): boolean {
  if (where.versionId !== undefined && chunk.versionId !== where.versionId) return false;
  if (where.chunkType !== undefined && chunk.chunkType !== where.chunkType) return false;
  if (where.isActive !== undefined && chunk.isActive !== where.isActive) return false;
  if (where.sourceDocumentId !== undefined && chunk.sourceDocumentId !== where.sourceDocumentId) {
    return false;
  }
  if (where.version?.packId !== undefined && chunk.version.pack.packId !== where.version.packId) {
    return false;
  }
  return true;
}

function makePack(overrides: Partial<KnowledgePack> = {}): KnowledgePack {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "pack-internal",
    packId: "pack-1",
    name: "Test Pack",
    categoryId: "cat-1",
    providerName: "Test Provider",
    providerType: "INDIVIDUAL",
    providerProfileId: "profile-1",
    status: "DRAFT",
    pricing: "FREE",
    icon: "📦",
    shortDescription: "short",
    description: "desc",
    tags: [],
    rating: 0,
    usageCount: 0,
    isVerified: false,
    pipelineStatus: "SOURCE_REGISTERING",
    pipelineUpdatedAt: null,
    structureTemplateKey: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    ...overrides,
  };
}

function makeVersion(pack: KnowledgePack): KnowledgePackVersion {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "ver-1",
    packId: pack.packId,
    version: "1.0.0",
    overview: "",
    features: [],
    includedKnowledge: [],
    supportedEnvironments: [],
    targetUsers: [],
    useCases: [],
    versionSummary: "",
    createdAt: now,
    updatedAt: now,
  };
}

function makeSourceDoc(id: string): SourceDocument {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id,
    versionId: "ver-1",
    title: "README",
    sourceType: "PRODUCT_MANUAL",
    legacySourceType: null,
    sourceFormat: "MARKDOWN",
    sourceUrl: "https://github.com/test/repo/blob/main/README.md",
    fileName: "README.md",
    mimeType: null,
    content: "SECRET SOURCE CONTENT",
    checksum: null,
    productVersion: null,
    documentVersion: null,
    licenseStatus: null,
    validationStatus: "PASS",
    validationSummary: null,
    registeredByClientId: "client-1",
    registeredAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function makeChunkRow(
  id: string,
  metadata: unknown,
  sourceDocument: SourceDocument | null,
  pack: KnowledgePack,
  overrides: Partial<KnowledgeChunk> = {},
): ChunkRow {
  const now = new Date("2026-01-02T00:00:00.000Z");
  const version = makeVersion(pack);
  return {
    id,
    versionId: version.id,
    sourceDocumentId: sourceDocument?.id ?? null,
    chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
    title: `Draft ${id}`,
    content: "Draft body for admin review",
    section: "개요",
    tags: ["github-auto-collect"],
    metadata: metadata as never,
    sortOrder: 1,
    isActive: false,
    createdAt: now,
    updatedAt: now,
    sourceDocument,
    version: { ...version, pack },
    ...overrides,
  };
}

function createListMockDb(chunks: ChunkRow[]) {
  return {
    knowledgeChunk: {
      findMany: async ({ where }: { where: ChunkWhere }) =>
        chunks.filter((chunk) => matchesChunkWhere(chunk, where)),
      count: async ({ where }: { where: ChunkWhere }) =>
        chunks.filter((chunk) => matchesChunkWhere(chunk, where)).length,
    },
  };
}

describe("canDecideKnowledgeUnitDraft", () => {
  it("allows pending_review inactive drafts only", () => {
    assert.equal(canDecideKnowledgeUnitDraft({ reviewStatus: "pending_review", isActive: false }), true);
    assert.equal(canDecideKnowledgeUnitDraft({ reviewStatus: "approved", isActive: false }), false);
    assert.equal(canDecideKnowledgeUnitDraft({ reviewStatus: "pending_review", isActive: true }), false);
  });
});

describe("admin knowledge unit draft dto", () => {
  it("omits source document content from admin draft dto", () => {
    const pack = makePack();
    const doc = makeSourceDoc("doc-1");
    const dto = toAdminKnowledgeUnitDraftDto(
      makeChunkRow("c1", { reviewStatus: "pending_review" }, doc, pack),
    );
    assert.ok(dto.sourceDocument);
    assert.equal((dto.sourceDocument as Record<string, unknown>).content, undefined);
  });
});

describe("admin knowledge unit draft service list", () => {
  it("lists pending_review drafts by default", async () => {
    const pack = makePack();
    const doc = makeSourceDoc("doc-1");
    const chunks = [
      makeChunkRow("d1", { reviewStatus: "pending_review" }, doc, pack),
      makeChunkRow("d2", { reviewStatus: "approved" }, doc, pack),
    ];

    const result = await listAdminKnowledgeUnitDrafts(
      "admin-client",
      {},
      { prismaClient: createListMockDb(chunks) as never },
    );

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.id, "d1");
    assert.equal(result.summary.pendingReviewCount, 1);
    assert.equal(result.summary.approvedCount, 1);
  });

  it("includes approved and rejected when status=all", async () => {
    const pack = makePack();
    const doc = makeSourceDoc("doc-1");
    const chunks = [
      makeChunkRow("d1", { reviewStatus: "pending_review" }, doc, pack),
      makeChunkRow("d2", { reviewStatus: "rejected" }, doc, pack),
    ];

    const result = await listAdminKnowledgeUnitDrafts(
      "admin-client",
      { status: "all" },
      { prismaClient: createListMockDb(chunks) as never },
    );

    assert.equal(result.items.length, 2);
  });

  it("filters by packId", async () => {
    const pack1 = makePack({ packId: "pack-1" });
    const pack2 = makePack({ packId: "pack-2", name: "Other" });
    const doc = makeSourceDoc("doc-1");
    const chunks = [
      makeChunkRow("d1", { reviewStatus: "pending_review" }, doc, pack1),
      makeChunkRow("d2", { reviewStatus: "pending_review" }, doc, pack2),
    ];

    const result = await listAdminKnowledgeUnitDrafts(
      "admin-client",
      { status: "all", packId: "pack-2" },
      { prismaClient: createListMockDb(chunks) as never },
    );

    assert.deepEqual(result.items.map((i) => i.id), ["d2"]);
  });

  it("excludes active drafts from admin list items and counts them separately", async () => {
    const pack = makePack();
    const doc = makeSourceDoc("doc-1");
    const chunks = [
      makeChunkRow("inactive-draft", { reviewStatus: "pending_review" }, doc, pack, {
        isActive: false,
      }),
      makeChunkRow("active-draft", { reviewStatus: "approved" }, doc, pack, {
        isActive: true,
      }),
    ];

    const result = await listAdminKnowledgeUnitDrafts(
      "admin-client",
      { status: "all" },
      { prismaClient: createListMockDb(chunks) as never },
    );

    assert.deepEqual(result.items.map((item) => item.id), ["inactive-draft"]);
    assert.equal(result.summary.activeDraftCount, 1);
    assert.equal(result.summary.totalCount, 1);
  });
});

describe("admin knowledge unit draft service decide", () => {
  it("approves pending draft and keeps isActive false", async () => {
    const pack = makePack();
    const doc = makeSourceDoc("doc-1");
    let stored = makeChunkRow("draft-1", { reviewStatus: "pending_review" }, doc, pack);
    const auditCalls: unknown[] = [];

    const db = {
      knowledgeChunk: {
        findUnique: async () => stored,
        update: async ({
          data,
        }: {
          data: { metadata: Record<string, unknown>; isActive: boolean };
        }) => {
          stored = {
            ...stored,
            metadata: data.metadata as never,
            isActive: data.isActive,
          };
          return stored;
        },
      },
      auditLog: {
        create: async ({ data }: { data: { action: string; metadata: unknown } }) => {
          auditCalls.push(data);
          return { id: "audit-1" };
        },
      },
    };

    const result = await decideAdminKnowledgeUnitDraft(
      "reviewer-1",
      { draftId: "draft-1", decision: "approve", memo: "OK" },
      { prismaClient: db as never },
    );

    assert.equal(result.draft.reviewStatus, "approved");
    assert.equal(stored.isActive, false);
    assert.equal(auditCalls.length, 1);
    const audit = auditCalls[0] as { action: string; metadata: Record<string, unknown> };
    assert.equal(audit.action, AuditAction.ADMIN_CHUNK_UPDATE);
    assert.equal(audit.metadata.decision, "approve");
    assert.equal(audit.metadata.previousReviewStatus, "pending_review");
    assert.equal(audit.metadata.content, undefined);
    assert.equal(audit.metadata.draftContent, undefined);
    assert.equal(audit.metadata.sourceDocumentContent, undefined);
    assert.equal(result.draft.reviewMemo, "OK");
  });

  it("requires rejectionReason for reject", async () => {
    const pack = makePack();
    const stored = makeChunkRow("draft-1", { reviewStatus: "pending_review" }, makeSourceDoc("d"), pack);
    const db = {
      knowledgeChunk: { findUnique: async () => stored },
      auditLog: { create: async () => ({ id: "a" }) },
    };

    await assert.rejects(
      () =>
        decideAdminKnowledgeUnitDraft(
          "reviewer-1",
          { draftId: "draft-1", decision: "reject" },
          { prismaClient: db as never },
        ),
      (err: unknown) =>
        err instanceof AdminKnowledgeUnitDraftError && err.code === "REJECTION_REASON_REQUIRED",
    );
  });

  it("rejects with metadata and audit", async () => {
    const pack = makePack();
    let stored = makeChunkRow("draft-1", { reviewStatus: "pending_review" }, makeSourceDoc("d"), pack);
    const db = {
      knowledgeChunk: {
        findUnique: async () => stored,
        update: async ({ data }: { data: { metadata: Record<string, unknown>; isActive: boolean } }) => {
          stored = { ...stored, metadata: data.metadata as never, isActive: data.isActive };
          return stored;
        },
      },
      auditLog: { create: async () => ({ id: "a" }) },
    };

    const result = await decideAdminKnowledgeUnitDraft(
      "reviewer-1",
      {
        draftId: "draft-1",
        decision: "reject",
        rejectionReason: "출처 근거 부족",
      },
      { prismaClient: db as never },
    );

    assert.equal(result.draft.reviewStatus, "rejected");
    assert.equal(result.draft.rejectionReason, "출처 근거 부족");
    assert.equal(stored.isActive, false);
  });

  it("rejects decision when not pending_review", async () => {
    const pack = makePack();
    const stored = makeChunkRow("draft-1", { reviewStatus: "approved" }, makeSourceDoc("d"), pack);
    const db = { knowledgeChunk: { findUnique: async () => stored } };

    await assert.rejects(
      () =>
        decideAdminKnowledgeUnitDraft(
          "reviewer-1",
          { draftId: "draft-1", decision: "approve" },
          { prismaClient: db as never },
        ),
      (err: unknown) =>
        err instanceof AdminKnowledgeUnitDraftError &&
        err.code === "NOT_PENDING_REVIEW" &&
        err.status === 409,
    );
  });

  it("rejects decision when draft is active", async () => {
    const pack = makePack();
    const stored = makeChunkRow(
      "draft-1",
      { reviewStatus: "pending_review" },
      makeSourceDoc("d"),
      pack,
      { isActive: true },
    );
    const db = { knowledgeChunk: { findUnique: async () => stored } };

    await assert.rejects(
      () =>
        decideAdminKnowledgeUnitDraft(
          "reviewer-1",
          { draftId: "draft-1", decision: "approve" },
          { prismaClient: db as never },
        ),
      (err: unknown) =>
        err instanceof AdminKnowledgeUnitDraftError && err.code === "ALREADY_ACTIVE",
    );
  });
});

describe("parseAdminKnowledgeUnitDraftListQuery", () => {
  it("parses status packId and clamps limit", () => {
    const query = parseAdminKnowledgeUnitDraftListQuery(
      new URLSearchParams("status=bad&limit=999&packId= pack-9 "),
    );
    assert.equal(query.status, "pending_review");
    assert.equal(query.limit, 100);
    assert.equal(query.packId, "pack-9");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KnowledgeChunk, SourceDocument } from "@prisma/client";
import { AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import {
  readDraftMetadata,
  toProviderKnowledgeUnitDraftDto,
} from "@/lib/provider-knowledge-unit-draft-dto";
import {
  listProviderKnowledgeUnitDrafts,
  parseKnowledgeUnitDraftListQuery,
  ProviderKnowledgeUnitDraftListError,
} from "@/lib/provider-knowledge-unit-draft-service";

type ChunkWhere = {
  versionId?: string;
  chunkType?: string;
  isActive?: boolean;
  sourceDocumentId?: string;
};

type ChunkRow = KnowledgeChunk & { sourceDocument: SourceDocument | null };

function matchesChunkWhere(chunk: ChunkRow, where: ChunkWhere): boolean {
  if (where.versionId !== undefined && chunk.versionId !== where.versionId) return false;
  if (where.chunkType !== undefined && chunk.chunkType !== where.chunkType) return false;
  if (where.isActive !== undefined && chunk.isActive !== where.isActive) return false;
  if (where.sourceDocumentId !== undefined && chunk.sourceDocumentId !== where.sourceDocumentId) {
    return false;
  }
  return true;
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
    content: "SECRET SOURCE CONTENT SHOULD NOT LEAK",
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

function makeChunk(
  id: string,
  metadata: unknown,
  sourceDocument: SourceDocument | null,
  overrides: Partial<KnowledgeChunk> = {},
): ChunkRow {
  const now = new Date("2026-01-02T00:00:00.000Z");
  return {
    id,
    versionId: "ver-1",
    sourceDocumentId: sourceDocument?.id ?? null,
    chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
    title: `Draft ${id}`,
    content: "Draft body for review",
    section: "개요",
    tags: ["github-auto-collect"],
    metadata: metadata as never,
    sortOrder: 1,
    isActive: false,
    createdAt: now,
    updatedAt: now,
    sourceDocument,
    ...overrides,
  };
}

function createMockDb(chunks: ChunkRow[]) {
  return {
    providerProfile: {
      findFirst: async () => ({ id: "profile-1", clientId: "client-1", userId: "user-1" }),
      findUnique: async () => ({ id: "profile-1", clientId: "client-1", userId: "user-1" }),
    },
    knowledgePack: {
      findFirst: async () => ({
        packId: "pack-1",
        providerProfileId: "profile-1",
        versions: [{ id: "ver-1" }],
      }),
    },
    knowledgeChunk: {
      count: async ({ where }: { where: ChunkWhere }) =>
        chunks.filter((chunk) => matchesChunkWhere(chunk, where)).length,
      findMany: async ({ where }: { where: ChunkWhere }) =>
        chunks.filter((chunk) => matchesChunkWhere(chunk, where)),
    },
  };
}

describe("provider knowledge unit draft dto", () => {
  it("readDraftMetadata handles invalid and valid shapes", () => {
    assert.deepEqual(readDraftMetadata(null).reviewStatus, "unknown");
    assert.deepEqual(readDraftMetadata("text").reviewStatus, "unknown");
    assert.deepEqual(readDraftMetadata([]).reviewStatus, "unknown");

    const parsed = readDraftMetadata({
      reviewStatus: "pending_review",
      generatedBy: "github-auto-collector",
      generatedAt: "2026-01-01T00:00:00.000Z",
      evidence: { headings: "not-array", keywords: ["a"] },
    });
    assert.equal(parsed.reviewStatus, "pending_review");
    assert.equal(parsed.generatedBy, "github-auto-collector");
    assert.equal(parsed.evidence?.headings, undefined);
    assert.deepEqual(parsed.evidence?.keywords, ["a"]);
  });

  it("omits source document content from draft dto", () => {
    const doc = makeSourceDoc("doc-1");
    const dto = toProviderKnowledgeUnitDraftDto(
      makeChunk(
        "chunk-1",
        { reviewStatus: "pending_review", generatedBy: "github-auto-collector" },
        doc,
      ),
    );
    assert.equal(dto.content, "Draft body for review");
    assert.ok(dto.sourceDocument);
    assert.equal((dto.sourceDocument as Record<string, unknown>).content, undefined);
  });
});

describe("provider knowledge unit draft service", () => {
  it("throws when provider profile is missing", async () => {
    await assert.rejects(
      () =>
        listProviderKnowledgeUnitDrafts("user-1", "client-1", "pack-1", {}, {
          prismaClient: {
            providerProfile: { findFirst: async () => null, findUnique: async () => null },
          } as never,
        }),
      (err: unknown) =>
        err instanceof ProviderKnowledgeUnitDraftListError && err.status === 400,
    );
  });

  it("throws when pack is not found", async () => {
    await assert.rejects(
      () =>
        listProviderKnowledgeUnitDrafts("user-1", "client-1", "pack-1", {}, {
          prismaClient: {
            providerProfile: {
              findFirst: async () => ({ id: "p1", userId: "user-1" }),
              findUnique: async () => ({ id: "p1" }),
            },
            knowledgePack: { findFirst: async () => null },
          } as never,
        }),
      (err: unknown) =>
        err instanceof ProviderKnowledgeUnitDraftListError && err.status === 404,
    );
  });

  it("throws when pack has no version", async () => {
    const db = {
      providerProfile: {
        findFirst: async () => ({ id: "profile-1", clientId: "client-1", userId: "user-1" }),
        findUnique: async () => ({ id: "profile-1", clientId: "client-1", userId: "user-1" }),
      },
      knowledgePack: {
        findFirst: async () => ({
          packId: "pack-1",
          providerProfileId: "profile-1",
          versions: [],
        }),
      },
    };

    await assert.rejects(
      () =>
        listProviderKnowledgeUnitDrafts("user-1", "client-1", "pack-1", {}, {
          prismaClient: db as never,
        }),
      (err: unknown) =>
        err instanceof ProviderKnowledgeUnitDraftListError && err.status === 400,
    );
  });

  it("lists inactive AUTO_KNOWLEDGE_UNIT_DRAFT chunks with status filter", async () => {
    const doc = makeSourceDoc("doc-1");
    const chunks = [
      makeChunk("c1", { reviewStatus: "pending_review" }, doc),
      makeChunk("c2", { reviewStatus: "superseded" }, doc),
    ];
    const db = createMockDb(chunks);

    const pending = await listProviderKnowledgeUnitDrafts(
      "user-1",
      "client-1",
      "pack-1",
      { status: "pending_review" },
      { prismaClient: db as never },
    );
    assert.equal(pending.items.length, 1);
    assert.equal(pending.items[0]?.reviewStatus, "pending_review");
    assert.equal(pending.summary.pendingReviewCount, 1);
    assert.equal(pending.summary.supersededCount, 1);

    const all = await listProviderKnowledgeUnitDrafts(
      "user-1",
      "client-1",
      "pack-1",
      { status: "all" },
      { prismaClient: db as never },
    );
    assert.equal(all.items.length, 2);
  });

  it("excludes non draft chunk types", async () => {
    const doc = makeSourceDoc("doc-1");
    const chunks = [
      makeChunk("draft-1", { reviewStatus: "pending_review" }, doc),
      makeChunk("normal-1", { reviewStatus: "pending_review" }, doc, {
        chunkType: "MANUAL_CHUNK",
      }),
    ];

    const result = await listProviderKnowledgeUnitDrafts(
      "user-1",
      "client-1",
      "pack-1",
      { status: "all" },
      { prismaClient: createMockDb(chunks) as never },
    );

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.id, "draft-1");
  });

  it("excludes active drafts from items and counts them separately", async () => {
    const doc = makeSourceDoc("doc-1");
    const chunks = [
      makeChunk("inactive-draft", { reviewStatus: "pending_review" }, doc),
      makeChunk("active-draft", { reviewStatus: "pending_review" }, doc, {
        isActive: true,
      }),
    ];

    const result = await listProviderKnowledgeUnitDrafts(
      "user-1",
      "client-1",
      "pack-1",
      { status: "all" },
      { prismaClient: createMockDb(chunks) as never },
    );

    assert.deepEqual(result.items.map((item) => item.id), ["inactive-draft"]);
    assert.equal(result.summary.activeDraftCount, 1);
  });

  it("filters drafts by latest version id", async () => {
    const doc = makeSourceDoc("doc-1");
    const chunks = [
      makeChunk("ver-1-draft", { reviewStatus: "pending_review" }, doc, {
        versionId: "ver-1",
      }),
      makeChunk("old-ver-draft", { reviewStatus: "pending_review" }, doc, {
        versionId: "ver-old",
      }),
    ];

    const result = await listProviderKnowledgeUnitDrafts(
      "user-1",
      "client-1",
      "pack-1",
      { status: "all" },
      { prismaClient: createMockDb(chunks) as never },
    );

    assert.deepEqual(result.items.map((item) => item.id), ["ver-1-draft"]);
  });

  it("filters drafts by sourceDocumentId", async () => {
    const doc1 = makeSourceDoc("doc-1");
    const doc2 = makeSourceDoc("doc-2");
    const chunks = [
      makeChunk("draft-1", { reviewStatus: "pending_review" }, doc1),
      makeChunk("draft-2", { reviewStatus: "pending_review" }, doc2),
    ];

    const result = await listProviderKnowledgeUnitDrafts(
      "user-1",
      "client-1",
      "pack-1",
      { status: "all", sourceDocumentId: "doc-2" },
      { prismaClient: createMockDb(chunks) as never },
    );

    assert.deepEqual(result.items.map((item) => item.id), ["draft-2"]);
  });

  it("clamps limit through service options", async () => {
    const doc = makeSourceDoc("doc-1");
    const chunks = Array.from({ length: 120 }, (_, index) =>
      makeChunk(`draft-${index}`, { reviewStatus: "pending_review" }, doc, {
        sortOrder: index,
      }),
    );

    const result = await listProviderKnowledgeUnitDrafts(
      "user-1",
      "client-1",
      "pack-1",
      { status: "all", limit: 999 },
      { prismaClient: createMockDb(chunks) as never },
    );

    assert.equal(result.items.length, 100);

    const minResult = await listProviderKnowledgeUnitDrafts(
      "user-1",
      "client-1",
      "pack-1",
      { status: "all", limit: 0 },
      { prismaClient: createMockDb(chunks) as never },
    );
    assert.equal(minResult.items.length, 1);
  });
});

describe("parseKnowledgeUnitDraftListQuery", () => {
  it("parses and clamps query parameters", () => {
    const query = parseKnowledgeUnitDraftListQuery(
      new URLSearchParams("status=bad&limit=999&sourceDocumentId= doc-1 "),
    );

    assert.equal(query.status, "pending_review");
    assert.equal(query.limit, 100);
    assert.equal(query.sourceDocumentId, "doc-1");
  });

  it("accepts valid status values and clamps low limit", () => {
    assert.equal(
      parseKnowledgeUnitDraftListQuery(new URLSearchParams("status=superseded")).status,
      "superseded",
    );
    assert.equal(
      parseKnowledgeUnitDraftListQuery(new URLSearchParams("status=all")).status,
      "all",
    );
    assert.equal(parseKnowledgeUnitDraftListQuery(new URLSearchParams("limit=0")).limit, 1);
  });

  it("defaults invalid limit to 50", () => {
    assert.equal(parseKnowledgeUnitDraftListQuery(new URLSearchParams("limit=abc")).limit, 50);
  });
});

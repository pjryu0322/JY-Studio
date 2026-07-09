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
  ProviderKnowledgeUnitDraftListError,
} from "@/lib/provider-knowledge-unit-draft-service";

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
): KnowledgeChunk & { sourceDocument: SourceDocument | null } {
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
  };
}

function createMockDb(chunks: Array<KnowledgeChunk & { sourceDocument: SourceDocument | null }>) {
  return {
    providerProfile: {
      findUnique: async () => ({ id: "profile-1", clientId: "client-1" }),
    },
    knowledgePack: {
      findFirst: async () => ({
        packId: "pack-1",
        providerProfileId: "profile-1",
        versions: [{ id: "ver-1" }],
      }),
    },
    knowledgeChunk: {
      count: async ({ where }: { where: { isActive?: boolean } }) =>
        chunks.filter((c) => c.isActive === where.isActive).length,
      findMany: async () => chunks.filter((c) => !c.isActive),
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
        listProviderKnowledgeUnitDrafts("client-1", "pack-1", {}, {
          prismaClient: {
            providerProfile: { findUnique: async () => null },
          } as never,
        }),
      (err: unknown) =>
        err instanceof ProviderKnowledgeUnitDraftListError && err.status === 400,
    );
  });

  it("throws when pack is not found", async () => {
    await assert.rejects(
      () =>
        listProviderKnowledgeUnitDrafts("client-1", "pack-1", {}, {
          prismaClient: {
            providerProfile: { findUnique: async () => ({ id: "p1" }) },
            knowledgePack: { findFirst: async () => null },
          } as never,
        }),
      (err: unknown) =>
        err instanceof ProviderKnowledgeUnitDraftListError && err.status === 404,
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
      "client-1",
      "pack-1",
      { status: "all" },
      { prismaClient: db as never },
    );
    assert.equal(all.items.length, 2);
  });
});

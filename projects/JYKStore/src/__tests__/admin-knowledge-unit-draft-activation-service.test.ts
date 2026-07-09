import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import type { KnowledgeChunk, KnowledgePack, KnowledgePackVersion, SourceDocument } from "@prisma/client";
import { AuditAction } from "@prisma/client";
import { AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import { AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE } from "@/lib/admin-knowledge-unit-draft-activation-dto";
import {
  activateAdminKnowledgeUnitDraft,
  AdminKnowledgeUnitDraftActivationError,
  isRetrievalCandidateChunk,
} from "@/lib/admin-knowledge-unit-draft-activation-service";
import { canActivateKnowledgeUnitDraft } from "@/lib/admin-knowledge-unit-draft-ui-utils";
import { POST as activateDraftPOST } from "@/app/api/v1/admin/knowledge-unit-drafts/[draftId]/activate/route";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");
const activateRoutePath = join(
  projectRoot,
  "src/app/api/v1/admin/knowledge-unit-drafts/[draftId]/activate/route.ts",
);

type ChunkRow = KnowledgeChunk & {
  sourceDocument: SourceDocument | null;
  version: KnowledgePackVersion & { pack: KnowledgePack };
};

function makePack(): KnowledgePack {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "pack-internal",
    packId: "pack-1",
    name: "Test Pack",
    categoryId: "cat-1",
    providerName: "Test Provider",
    providerType: "COMMUNITY",
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
  };
}

function makeSourceDoc(): SourceDocument {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "doc-1",
    versionId: "ver-1",
    title: "README",
    sourceType: "PRODUCT_MANUAL",
    legacySourceType: null,
    sourceFormat: "MARKDOWN",
    sourceUrl: "https://example.com/readme",
    fileName: "README.md",
    mimeType: null,
    content: "SECRET",
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

function makeApprovedDraft(overrides: Partial<KnowledgeChunk> = {}): ChunkRow {
  const now = new Date("2026-01-02T00:00:00.000Z");
  const pack = makePack();
  const version: KnowledgePackVersion = {
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
  return {
    id: "draft-1",
    versionId: "ver-1",
    sourceDocumentId: "doc-1",
    chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
    title: "Approved draft title",
    content: "This is approved draft content long enough for validation.",
    section: "개요",
    tags: ["github-auto-collect"],
    metadata: {
      reviewStatus: "approved",
      reviewDecision: "approve",
      approvedForActivation: true,
      sourcePath: "docs/readme.md",
    } as never,
    sortOrder: 1,
    isActive: false,
    createdAt: now,
    updatedAt: now,
    sourceDocument: makeSourceDoc(),
    version: { ...version, pack },
    ...overrides,
  };
}

function createActivationMockDb(initialDraft: ChunkRow, extraActiveChunks: KnowledgeChunk[] = []) {
  let draft = initialDraft;
  const activeChunks: KnowledgeChunk[] = [...extraActiveChunks];
  const auditCalls: unknown[] = [];

  const db = {
    knowledgeChunk: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id === draft.id) return draft;
        return activeChunks.find((c) => c.id === where.id) ?? null;
      },
      findMany: async ({ where }: { where: { versionId?: string; isActive?: boolean } }) => {
        const rows: KnowledgeChunk[] = [draft, ...activeChunks];
        return rows.filter((chunk) => {
          if (where.versionId !== undefined && chunk.versionId !== where.versionId) return false;
          if (where.isActive !== undefined && chunk.isActive !== where.isActive) return false;
          return true;
        });
      },
      aggregate: async () => ({ _max: { sortOrder: 1 } }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date("2026-01-03T00:00:00.000Z");
        const created = {
          id: "active-chunk-1",
          versionId: data.versionId as string,
          sourceDocumentId: data.sourceDocumentId as string | null,
          chunkType: data.chunkType as string,
          title: data.title as string,
          content: data.content as string,
          section: data.section as string | null,
          tags: data.tags as string[],
          metadata: data.metadata as never,
          sortOrder: data.sortOrder as number,
          isActive: data.isActive as boolean,
          createdAt: now,
          updatedAt: now,
        };
        activeChunks.push(created);
        return created;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { metadata: unknown; isActive: boolean };
      }) => {
        if (where.id !== draft.id) throw new Error("unexpected update");
        draft = {
          ...draft,
          metadata: data.metadata as never,
          isActive: data.isActive,
        };
        return draft;
      },
    },
    auditLog: {
      create: async ({ data }: { data: unknown }) => {
        auditCalls.push(data);
        return { id: "audit-1" };
      },
    },
    $transaction: async (fn: (tx: typeof db) => Promise<unknown>) => fn(db),
  };

  return { db, getDraft: () => draft, getActiveChunks: () => activeChunks, auditCalls };
}

describe("canActivateKnowledgeUnitDraft", () => {
  it("allows approved inactive drafts without prior activation", () => {
    assert.equal(
      canActivateKnowledgeUnitDraft({
        reviewStatus: "approved",
        isActive: false,
        activationStatus: null,
        activatedChunkId: null,
        approvedForActivation: true,
      }),
      true,
    );
    assert.equal(
      canActivateKnowledgeUnitDraft({
        reviewStatus: "pending_review",
        isActive: false,
        activationStatus: null,
        activatedChunkId: null,
        approvedForActivation: true,
      }),
      false,
    );
  });
});

describe("admin knowledge unit draft activation service", () => {
  it("activates approved draft and creates active chunk", async () => {
    const draft = makeApprovedDraft();
    const { db, getDraft, getActiveChunks, auditCalls } = createActivationMockDb(draft);

    const result = await activateAdminKnowledgeUnitDraft(
      "admin-1",
      { draftId: "draft-1", memo: "go" },
      { prismaClient: db as never },
    );

    assert.equal(result.activatedChunk.chunkType, AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE);
    assert.equal(result.activatedChunk.isActive, true);
    assert.equal(result.activatedChunk.content, draft.content);
    assert.equal(result.activatedChunk.metadata.activatedFromDraftId, "draft-1");
    assert.equal(getDraft().isActive, false);
    const draftMeta = getDraft().metadata as Record<string, unknown>;
    assert.equal(draftMeta.activationStatus, "activated");
    assert.equal(draftMeta.activatedChunkId, "active-chunk-1");
    assert.equal(getActiveChunks().length, 1);
    assert.equal(auditCalls.length, 1);
    const audit = auditCalls[0] as { action: string; metadata: Record<string, unknown> };
    assert.equal(audit.action, AuditAction.ADMIN_CHUNK_CREATE);
    assert.equal(audit.metadata.content, undefined);
    assert.equal(audit.metadata.draftContent, undefined);
  });

  it("blocks duplicate activation", async () => {
    const draft = makeApprovedDraft();
    const existingActive: KnowledgeChunk = {
      ...makeApprovedDraft(),
      id: "active-existing",
      chunkType: AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE,
      isActive: true,
      metadata: { activatedFromDraftId: "draft-1" } as never,
    };
    const { db } = createActivationMockDb(draft, [existingActive]);

    await assert.rejects(
      () =>
        activateAdminKnowledgeUnitDraft("admin-1", { draftId: "draft-1" }, {
          prismaClient: db as never,
        }),
      (err: unknown) =>
        err instanceof AdminKnowledgeUnitDraftActivationError && err.code === "ALREADY_ACTIVATED",
    );
  });

  it("blocks pending_review draft activation", async () => {
    const draft = makeApprovedDraft({
      metadata: { reviewStatus: "pending_review", approvedForActivation: false } as never,
    });
    const { db } = createActivationMockDb(draft);

    await assert.rejects(
      () =>
        activateAdminKnowledgeUnitDraft("admin-1", { draftId: "draft-1" }, {
          prismaClient: db as never,
        }),
      (err: unknown) =>
        err instanceof AdminKnowledgeUnitDraftActivationError && err.code === "NOT_APPROVED",
    );
  });

  it("blocks rejected draft activation", async () => {
    const draft = makeApprovedDraft({
      metadata: {
        reviewStatus: "rejected",
        reviewDecision: "reject",
        approvedForActivation: false,
      } as never,
    });
    const { db } = createActivationMockDb(draft);

    await assert.rejects(
      () =>
        activateAdminKnowledgeUnitDraft("admin-1", { draftId: "draft-1" }, {
          prismaClient: db as never,
        }),
      (err: unknown) =>
        err instanceof AdminKnowledgeUnitDraftActivationError && err.code === "NOT_APPROVED",
    );
  });

  it("blocks active draft row activation", async () => {
    const draft = makeApprovedDraft({ isActive: true });
    const { db } = createActivationMockDb(draft);

    await assert.rejects(
      () =>
        activateAdminKnowledgeUnitDraft("admin-1", { draftId: "draft-1" }, {
          prismaClient: db as never,
        }),
      (err: unknown) =>
        err instanceof AdminKnowledgeUnitDraftActivationError && err.code === "ALREADY_ACTIVE",
    );
  });

  it("blocks non-draft chunk activation", async () => {
    const draft = makeApprovedDraft({ chunkType: "MANUAL_CHUNK" });
    const { db } = createActivationMockDb(draft);

    await assert.rejects(
      () =>
        activateAdminKnowledgeUnitDraft("admin-1", { draftId: "draft-1" }, {
          prismaClient: db as never,
        }),
      (err: unknown) =>
        err instanceof AdminKnowledgeUnitDraftActivationError && err.code === "NOT_DRAFT",
    );
  });

  it("exposes retrieval candidate contract for draft vs active chunk", () => {
    const draft = makeApprovedDraft();
    const active = { isActive: true as const };
    assert.equal(isRetrievalCandidateChunk(draft), false);
    assert.equal(isRetrievalCandidateChunk(active), true);
  });
});

describe("admin knowledge unit draft activation route", () => {
  const previousToken = process.env.JYKSTORE_ADMIN_OPS_TOKEN;

  before(() => {
    process.env.JYKSTORE_ADMIN_OPS_TOKEN = "p26-10-test-token";
  });

  after(() => {
    if (previousToken === undefined) delete process.env.JYKSTORE_ADMIN_OPS_TOKEN;
    else process.env.JYKSTORE_ADMIN_OPS_TOKEN = previousToken;
  });

  it("POST activate route uses rejectUnlessAdminOps before service", () => {
    const source = readFileSync(activateRoutePath, "utf8");
    const guardAt = source.indexOf("rejectUnlessAdminOps(request, clientId)");
    const activateAt = source.indexOf("activateAdminKnowledgeUnitDraft(");
    assert.ok(guardAt >= 0 && activateAt > guardAt);
  });

  it("POST activate rejects non-admin requests", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/admin/knowledge-unit-drafts/draft-1/activate",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    );
    const response = await activateDraftPOST(request, {
      params: Promise.resolve({ draftId: "draft-1" }),
    });
    assert.equal(response.status, 401);
  });
});

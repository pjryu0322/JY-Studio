import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SourceDocument, SourceFormat, SourceType } from "@prisma/client";
import { PackStatus } from "@prisma/client";
import { GitHubDiscoveryError } from "@/lib/github-auto-collect/github-auto-collect-types";
import {
  AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
  buildDraftCandidatesForSourceDocument,
  extractGitHubPathFromSourceUrl,
} from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import {
  KNOWLEDGE_UNIT_DRAFT_HARD_CAP,
  normalizeGitHubKnowledgeUnitDraftInput,
} from "@/lib/github-auto-collect/github-knowledge-unit-draft-options";
import {
  pathMatchesRequestedSourcePath,
} from "@/lib/github-auto-collect/github-path-utils";
import { generateGitHubKnowledgeUnitDraftsForPack } from "@/lib/github-auto-collect/github-knowledge-unit-draft-service";

const longBody = "# Section\n\n".padEnd(60, "x");

const editableDraftPack = async () =>
  ({ ok: true as const, packId: "pack-1", status: PackStatus.DRAFT });

function makeDoc(overrides: Partial<SourceDocument> & { id: string }): SourceDocument {
  const now = new Date();
  return {
    id: overrides.id,
    versionId: overrides.versionId ?? "ver-1",
    title: overrides.title ?? "README",
    sourceType: (overrides.sourceType ?? "PRODUCT_MANUAL") as SourceType,
    legacySourceType: overrides.legacySourceType ?? null,
    sourceFormat: (overrides.sourceFormat ?? "MARKDOWN") as SourceFormat,
    sourceUrl:
      overrides.sourceUrl ??
      "https://github.com/test/repo/blob/main/README.md",
    fileName: overrides.fileName ?? "README.md",
    mimeType: overrides.mimeType ?? "text/markdown",
    content:
      overrides.content ??
      "# Product\n\nThis is a long enough readme body for draft generation testing purposes.",
    checksum: overrides.checksum ?? null,
    productVersion: overrides.productVersion ?? null,
    documentVersion: overrides.documentVersion ?? null,
    licenseStatus: overrides.licenseStatus ?? null,
    validationStatus: overrides.validationStatus ?? "PASS",
    validationSummary: overrides.validationSummary ?? null,
    registeredByClientId: overrides.registeredByClientId ?? "client-1",
    registeredAt: overrides.registeredAt ?? now,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

type CreatedChunk = Record<string, unknown>;

function createMockPrisma(options: {
  documents: SourceDocument[];
  existingDraftSourceIds?: string[];
}) {
  const createdChunks: CreatedChunk[] = [];
  const documents = options.documents;
  const existingDraftSourceIds = new Set(options.existingDraftSourceIds ?? []);

  const db = {
    providerProfile: {
      findFirst: async () => ({ id: "profile-1", clientId: "client-1", userId: "user-test" }),
      findUnique: async () => ({ id: "profile-1", clientId: "client-1", userId: "user-test" }),
    },
    knowledgePack: {
      findFirst: async () => ({
        packId: "pack-1",
        providerProfileId: "profile-1",
        versions: [
          {
            id: "ver-1",
            sourceDocuments: documents,
          },
        ],
      }),
    },
    knowledgeChunk: {
      findMany: async () =>
        [...existingDraftSourceIds].map((sourceDocumentId, index) => ({
          id: `existing-${index}`,
          sourceDocumentId,
          metadata: { reviewStatus: "pending_review" },
        })),
      aggregate: async () => ({ _max: { sortOrder: 0 } }),
      update: async () => ({}),
      create: async ({ data }: { data: CreatedChunk }) => {
        createdChunks.push(data);
        return { id: `chunk-${createdChunks.length}`, ...data };
      },
    },
  };

  return { db: db as never, createdChunks };
}

describe("github knowledge unit draft options", () => {
  it("defaults to MINIMAL mode with target 8", () => {
    const normalized = normalizeGitHubKnowledgeUnitDraftInput({}, []);
    assert.equal(normalized.generationMode, "MINIMAL");
    assert.equal(normalized.targetKnowledgeUnitCount, 8);
    assert.equal(normalized.maxKnowledgeUnitCount, 10);
  });

  it("caps maxKnowledgeUnitCount at hard limit for CUSTOM", () => {
    const normalized = normalizeGitHubKnowledgeUnitDraftInput(
      {
        generationMode: "CUSTOM",
        targetKnowledgeUnitCount: 40,
        maxKnowledgeUnitCount: 999,
        minKnowledgeUnitCount: 1,
      },
      [],
    );
    assert.equal(normalized.maxKnowledgeUnitCount, KNOWLEDGE_UNIT_DRAFT_HARD_CAP);
  });

  it("rejects invalid generationMode", () => {
    assert.throws(
      () => normalizeGitHubKnowledgeUnitDraftInput({ generationMode: "HUGE" as never }, []),
      (err: unknown) =>
        err instanceof GitHubDiscoveryError &&
        err.code === "INVALID_KNOWLEDGE_UNIT_DRAFT_OPTIONS" &&
        err.status === 400,
    );
  });

  it("rejects max less than min", () => {
    assert.throws(
      () =>
        normalizeGitHubKnowledgeUnitDraftInput(
          {
            generationMode: "CUSTOM",
            minKnowledgeUnitCount: 20,
            maxKnowledgeUnitCount: 5,
          },
          [],
        ),
      (err: unknown) =>
        err instanceof GitHubDiscoveryError &&
        err.code === "INVALID_KNOWLEDGE_UNIT_DRAFT_OPTIONS",
    );
  });

  it("rejects unsafe sourceDocumentPaths", () => {
    for (const path of [
      "../secret.md",
      "docs/../secret.md",
      "http://evil.test/file.md",
      "https://evil.test/file.md",
      "git://evil.test/file.md",
      ".",
      "..",
    ]) {
      assert.throws(
        () => normalizeGitHubKnowledgeUnitDraftInput({ sourceDocumentPaths: [path] }, []),
        (err: unknown) =>
          err instanceof GitHubDiscoveryError &&
          err.code === "INVALID_KNOWLEDGE_UNIT_DRAFT_OPTIONS" &&
          err.status === 400,
      );
    }
  });

  it("normalizes backslashes in sourceDocumentPaths", () => {
    const warnings: string[] = [];
    const normalized = normalizeGitHubKnowledgeUnitDraftInput(
      { sourceDocumentPaths: ["docs\\getting-started.md"] },
      warnings,
    );
    assert.deepEqual(normalized.sourceDocumentPaths, ["docs/getting-started.md"]);
  });

  it("dedupes sourceDocumentPaths with warning", () => {
    const warnings: string[] = [];
    const normalized = normalizeGitHubKnowledgeUnitDraftInput(
      { sourceDocumentPaths: ["docs/api.md", "docs/api.md"] },
      warnings,
    );
    assert.deepEqual(normalized.sourceDocumentPaths, ["docs/api.md"]);
    assert.ok(warnings.some((w) => w.includes("중복")));
  });
});

describe("github knowledge unit draft generator", () => {
  it("matches paths with exact suffix and directory prefix only", () => {
    assert.equal(
      pathMatchesRequestedSourcePath("docs/api.md", "docs/api.md"),
      true,
    );
    assert.equal(
      pathMatchesRequestedSourcePath("packages/grid/docs/api.md", "docs/api.md"),
      true,
    );
    assert.equal(
      pathMatchesRequestedSourcePath("docs/getting-started.md", "docs"),
      true,
    );
    assert.equal(pathMatchesRequestedSourcePath("docs/api.md", "api"), false);
    assert.equal(pathMatchesRequestedSourcePath("samples/capitalize.ts", "api"), false);
  });

  it("extracts github blob path from sourceUrl", () => {
    assert.equal(
      extractGitHubPathFromSourceUrl(
        "https://github.com/test/repo/blob/main/docs/getting-started.md",
      ),
      "docs/getting-started.md",
    );
  });

  it("builds path-aware draft titles", () => {
    const readme = buildDraftCandidatesForSourceDocument({
      id: "doc-readme",
      title: "README",
      sourceType: "PRODUCT_MANUAL",
      sourceFormat: "MARKDOWN",
      sourceUrl: "https://github.com/test/repo/blob/main/README.md",
      fileName: "README.md",
      content: "# Product\n\nOverview paragraph with enough content for testing.",
    });
    assert.ok(readme.some((c) => c.title === "제품 개요"));

    const gs = buildDraftCandidatesForSourceDocument({
      id: "doc-gs",
      title: "docs/getting-started",
      sourceType: "INTEGRATION_GUIDE",
      sourceFormat: "MARKDOWN",
      sourceUrl: "https://github.com/test/repo/blob/main/docs/getting-started.md",
      fileName: "getting-started.md",
      content: "# Getting Started\n\nFollow these steps to integrate.",
    });
    assert.ok(gs.some((c) => c.title === "시작하기"));

    const api = buildDraftCandidatesForSourceDocument({
      id: "doc-api",
      title: "docs/api",
      sourceType: "API_SPEC",
      sourceFormat: "MARKDOWN",
      sourceUrl: "https://github.com/test/repo/blob/main/docs/api.md",
      fileName: "api.md",
      content: "# API\n\nEndpoints and request examples for the product.",
    });
    assert.ok(api.some((c) => c.title === "API 사용법"));

    const sample = buildDraftCandidatesForSourceDocument({
      id: "doc-ex",
      title: "examples/basic",
      sourceType: "SAMPLE_CODE",
      sourceFormat: "CODE",
      sourceUrl: "https://github.com/test/repo/blob/main/examples/basic.ts",
      fileName: "basic.ts",
      content: "import { createGrid } from './grid';\nexport function demo() { return createGrid(); }",
    });
    assert.ok(sample.some((c) => c.title === "기본 예제"));
  });
});

describe("github knowledge unit draft service", () => {
  it("does not query documents when pack preflight fails", async () => {
    let packQueried = false;
    const { db } = createMockPrisma({ documents: [makeDoc({ id: "doc-1" })] });
    const patched = {
      ...db,
      knowledgePack: {
        findFirst: async () => {
          packQueried = true;
          return null;
        },
      },
    };

    await assert.rejects(
      () =>
        generateGitHubKnowledgeUnitDraftsForPack("user-test", "client-1",
          "pack-1",
          {},
          {
            prismaClient: patched as never,
            assertEditablePack: async () => ({ ok: false, error: "NOT_FOUND" }),
          },
        ),
      (err: unknown) =>
        err instanceof GitHubDiscoveryError &&
        err.code === "INVALID_KNOWLEDGE_UNIT_DRAFT_OPTIONS" &&
        err.status === 404,
    );
    assert.equal(packQueried, false);
  });

  it("skips invalid source documents and creates drafts for eligible github docs", async () => {
    const docs = [
      makeDoc({ id: "doc-readme", content: "# Hi\n\n".padEnd(60, "x") }),
      makeDoc({ id: "doc-empty", content: "" }),
      makeDoc({
        id: "doc-non-github",
        sourceUrl: "https://example.com/doc",
        content: "x".repeat(60),
      }),
      makeDoc({ id: "doc-fail", validationStatus: "FAIL", content: "x".repeat(60) }),
      makeDoc({ id: "doc-short", content: "short" }),
    ];
    const { db, createdChunks } = createMockPrisma({ documents: docs });

    const result = await generateGitHubKnowledgeUnitDraftsForPack("user-test", "client-1",
      "pack-1",
      {
        generationMode: "MINIMAL",
        sourceDocumentIds: docs.map((d) => d.id),
      },
      { prismaClient: db as never, assertEditablePack: editableDraftPack },
    );

    assert.ok(result.summary.generatedDraftCount > 0);
    assert.ok(
      result.skippedDocuments.some((s) => s.sourceDocumentId === "doc-empty" && s.reason === "CONTENT_REQUIRED"),
    );
    assert.ok(
      result.skippedDocuments.some(
        (s) => s.sourceDocumentId === "doc-non-github" && s.reason === "NON_GITHUB_SOURCE",
      ),
    );
    assert.ok(
      result.skippedDocuments.some(
        (s) => s.sourceDocumentId === "doc-fail" && s.reason === "SOURCE_VALIDATION_FAILED",
      ),
    );
    assert.ok(
      result.skippedDocuments.some(
        (s) => s.sourceDocumentId === "doc-short" && s.reason === "CONTENT_TOO_SHORT",
      ),
    );

    for (const chunk of createdChunks) {
      assert.equal(chunk.chunkType, AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE);
      assert.equal(chunk.isActive, false);
      const meta = chunk.metadata as Record<string, unknown>;
      assert.equal(meta.reviewStatus, "pending_review");
      assert.equal(meta.generatedBy, "github-auto-collector");
      assert.ok(chunk.sourceDocumentId);
    }
  });

  it("skips documents with existing drafts when overwrite is false", async () => {
    const docs = [makeDoc({ id: "doc-readme" })];
    const { db, createdChunks } = createMockPrisma({
      documents: docs,
      existingDraftSourceIds: ["doc-readme"],
    });

    const result = await generateGitHubKnowledgeUnitDraftsForPack("user-test", "client-1",
      "pack-1",
      {},
      { prismaClient: db as never, assertEditablePack: editableDraftPack },
    );

    assert.equal(result.summary.generatedDraftCount, 0);
    assert.equal(createdChunks.length, 0);
    assert.ok(
      result.skippedDocuments.some(
        (s) => s.sourceDocumentId === "doc-readme" && s.reason === "EXISTING_DRAFT",
      ),
    );
  });

  it("does not create drafts when requested sourceDocumentIds are missing", async () => {
    const { db, createdChunks } = createMockPrisma({ documents: [] });

    const result = await generateGitHubKnowledgeUnitDraftsForPack("user-test", "client-1",
      "pack-1",
      { sourceDocumentIds: ["missing-doc"] },
      { prismaClient: db as never, assertEditablePack: editableDraftPack },
    );

    assert.equal(result.summary.generatedDraftCount, 0);
    assert.equal(createdChunks.length, 0);
    assert.ok(
      result.failedDocuments.some(
        (f) => f.sourceDocumentId === "missing-doc" && f.error === "SOURCE_DOCUMENT_NOT_FOUND",
      ),
    );
  });

  it("inactive AUTO_KNOWLEDGE_UNIT_DRAFT chunks are excluded from retrieval filter contract", () => {
    const retrievalActiveFilter = { isActive: true as const };
    const draft = { chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE, isActive: false };
    assert.equal(draft.isActive, false);
    assert.equal(retrievalActiveFilter.isActive, true);
  });

  it("filters source documents by path without substring overmatch", async () => {
    const docs = [
      makeDoc({
        id: "doc-1",
        sourceUrl: "https://github.com/test/repo/blob/main/docs/api.md",
        fileName: "api.md",
        content: longBody,
        sourceType: "API_SPEC",
      }),
      makeDoc({
        id: "doc-2",
        sourceUrl: "https://github.com/test/repo/blob/main/packages/grid/docs/api.md",
        fileName: "api.md",
        content: longBody,
        sourceType: "API_SPEC",
      }),
      makeDoc({
        id: "doc-3",
        sourceUrl: "https://github.com/test/repo/blob/main/docs/getting-started.md",
        fileName: "getting-started.md",
        content: longBody,
        sourceType: "INTEGRATION_GUIDE",
      }),
      makeDoc({
        id: "doc-4",
        sourceUrl: "https://github.com/test/repo/blob/main/samples/capitalize.ts",
        fileName: "capitalize.ts",
        content: longBody,
        sourceType: "SAMPLE_CODE",
        sourceFormat: "CODE",
      }),
    ];

    async function eligibleDocIds(paths: string[]) {
      const { db, createdChunks } = createMockPrisma({ documents: docs });
      const result = await generateGitHubKnowledgeUnitDraftsForPack("user-test", "client-1",
        "pack-1",
        { sourceDocumentPaths: paths, generationMode: "FULL" },
        { prismaClient: db as never, assertEditablePack: editableDraftPack },
      );
      const ids = new Set(createdChunks.map((c) => String(c.sourceDocumentId)));
      return { result, ids };
    }

    const exact = await eligibleDocIds(["docs/api.md"]);
    assert.ok(exact.ids.has("doc-1"));
    assert.ok(exact.ids.has("doc-2"));
    assert.equal(exact.ids.has("doc-3"), false);
    assert.equal(exact.ids.has("doc-4"), false);

    const prefix = await eligibleDocIds(["docs"]);
    assert.ok(prefix.ids.has("doc-1"));
    assert.ok(prefix.ids.has("doc-3"));
    assert.equal(prefix.ids.has("doc-4"), false);

    const substring = await eligibleDocIds(["api"]);
    assert.equal(substring.result.summary.sourceDocumentCount, 0);
    assert.equal(substring.ids.size, 0);
  });
});

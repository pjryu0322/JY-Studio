import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KnowledgeChunk, KnowledgePack, KnowledgePackVersion, SourceDocument } from "@prisma/client";
import { PackStatus, type SourceFormat, type SourceType } from "@prisma/client";
import { AuditAction } from "@prisma/client";
import { decideAdminKnowledgeUnitDraft } from "@/lib/admin-knowledge-unit-draft-service";
import {
  activateAdminKnowledgeUnitDraft,
  isRetrievalCandidateChunk,
} from "@/lib/admin-knowledge-unit-draft-activation-service";
import { AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE } from "@/lib/admin-knowledge-unit-draft-activation-dto";
import { AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import { discoverGitHubRepository } from "@/lib/github-auto-collect/github-repository-discovery-service";
import { generateGitHubKnowledgeUnitDraftsForPack } from "@/lib/github-auto-collect/github-knowledge-unit-draft-service";
import { registerGitHubSourceDocumentsForPack } from "@/lib/github-auto-collect/github-source-register-service";
import { listProviderKnowledgeUnitDrafts } from "@/lib/provider-knowledge-unit-draft-service";
import { scoreRetrievalChunk } from "@/lib/retrieval-ranking";

const TUI_GRID_URL = "https://github.com/nhn/tui.grid";
const CLIENT_ID = "provider-client-1";
const PACK_ID = "toast-ui-grid-pack";
const VERSION_ID = "ver-tui-1";

const longMarkdown = (topic: string) =>
  `# TOAST UI Grid ${topic}\n\n`.padEnd(80, "Configure columns, data, and el for the grid. ");

function blobTree(paths: Array<{ path: string; sha: string; size: number }>) {
  return {
    sha: "tree-sha",
    truncated: false,
    tree: paths.map((p) => ({
      path: p.path,
      mode: "100644",
      type: "blob" as const,
      sha: p.sha,
      size: p.size,
    })),
  };
}

function tuiGridFetchFactory(blobs: Record<string, string>) {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/repos/nhn/tui.grid") && !url.includes("/git/")) {
      return new Response(
        JSON.stringify({
          name: "tui.grid",
          full_name: "nhn/tui.grid",
          html_url: "https://github.com/nhn/tui.grid",
          default_branch: "master",
          private: false,
          archived: false,
          license: { spdx_id: "MIT", name: "MIT" },
          size: 1200,
          language: "TypeScript",
          description: "The Powerful Component to Display and Edit Data",
        }),
        { status: 200 },
      );
    }
    if (url.includes("/git/trees/")) {
      return new Response(
        JSON.stringify(
          blobTree([
            { path: "README.md", sha: "sha-readme", size: 400 },
            { path: "docs/en/getting-started.md", sha: "sha-gs", size: 500 },
            { path: "docs/en/columns.md", sha: "sha-columns", size: 450 },
            { path: "examples/basic/index.html", sha: "sha-ex", size: 350 },
            { path: "package.json", sha: "sha-pkg", size: 200 },
            { path: "src/grid.ts", sha: "sha-src", size: 300 },
            { path: "test/grid.spec.ts", sha: "sha-test", size: 250 },
          ]),
        ),
        { status: 200 },
      );
    }
    if (url.includes("/git/blobs/")) {
      const sha = url.split("/").pop() ?? "";
      const text = blobs[sha] ?? "";
      const encoded = Buffer.from(text, "utf8").toString("base64");
      return new Response(
        JSON.stringify({ content: encoded, encoding: "base64", size: text.length }),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  };
}

const tuiGridBlobs: Record<string, string> = {
  "sha-readme": longMarkdown("overview") + "TOAST UI Grid 설치와 기본 사용.",
  "sha-gs": longMarkdown("getting started") + "Grid 생성 시 el, columns, data 설정.",
  "sha-columns": longMarkdown("columns") + "columns 배열과 name, header 설정 방법.",
  "sha-ex":
    "<html><body>const grid = new Grid({ el, columns, data });</body></html>".padEnd(80, " "),
  "sha-pkg": JSON.stringify({ name: "tui-grid", description: "TOAST UI Grid" }),
  "sha-src": "export class Grid {}".padEnd(40, "//"),
  "sha-test": "describe('grid', () => {});".padEnd(40, "//"),
};

const editableDraftPack = async () =>
  ({ ok: true as const, packId: PACK_ID, status: PackStatus.DRAFT });

type ChunkRow = KnowledgeChunk & {
  sourceDocument: SourceDocument | null;
  version: KnowledgePackVersion & { pack: KnowledgePack };
};

function makePack(): KnowledgePack {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "pack-internal",
    packId: PACK_ID,
    name: "TOAST UI Grid Pack",
    categoryId: "cat-1",
    providerName: "Provider",
    providerType: "COMMUNITY",
    providerProfileId: "profile-1",
    status: "DRAFT",
    pricing: "FREE",
    icon: "📦",
    shortDescription: "short",
    description: "desc",
    tags: ["toast", "grid"],
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

function createP26E2EState() {
  const pack = makePack();
  const version: KnowledgePackVersion = {
    id: VERSION_ID,
    packId: PACK_ID,
    version: "1.0.0",
    overview: "",
    features: [],
    includedKnowledge: [],
    supportedEnvironments: [],
    targetUsers: [],
    useCases: [],
    versionSummary: "",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  return {
    pack,
    version,
    sourceDocuments: [] as SourceDocument[],
    chunkRows: [] as ChunkRow[],
    audits: [] as Array<{ action: string; metadata: Record<string, unknown> }>,
    docCounter: 0,
    chunkCounter: 0,
  };
}

function createP26E2EPrisma(state: ReturnType<typeof createP26E2EState>) {
  const enrichChunk = (chunk: KnowledgeChunk): ChunkRow => {
    const doc =
      state.sourceDocuments.find((d) => d.id === chunk.sourceDocumentId) ?? null;
    return {
      ...chunk,
      sourceDocument: doc,
      version: { ...state.version, pack: state.pack },
    };
  };

  const db = {
    providerProfile: {
      findUnique: async () => ({ id: "profile-1", clientId: CLIENT_ID }),
    },
    knowledgePack: {
      findFirst: async () => ({
        packId: PACK_ID,
        providerProfileId: "profile-1",
        versions: [
          {
            ...state.version,
            sourceDocuments: state.sourceDocuments,
          },
        ],
      }),
    },
    knowledgeChunk: {
      findMany: async ({
        where,
      }: {
        where: {
          versionId?: string;
          chunkType?: string;
          isActive?: boolean;
          sourceDocumentId?: string;
        };
      }) => {
        return state.chunkRows.filter((row) => {
          if (where.versionId !== undefined && row.versionId !== where.versionId) return false;
          if (where.chunkType !== undefined && row.chunkType !== where.chunkType) return false;
          if (where.isActive !== undefined && row.isActive !== where.isActive) return false;
          if (
            where.sourceDocumentId !== undefined &&
            row.sourceDocumentId !== where.sourceDocumentId
          ) {
            return false;
          }
          return true;
        });
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = state.chunkRows.find((c) => c.id === where.id);
        return row ?? null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.chunkCounter += 1;
        const now = new Date("2026-01-02T00:00:00.000Z");
        const chunk: KnowledgeChunk = {
          id: `chunk-${state.chunkCounter}`,
          versionId: data.versionId as string,
          sourceDocumentId: (data.sourceDocumentId as string | null) ?? null,
          chunkType: data.chunkType as string,
          title: data.title as string,
          content: data.content as string,
          section: (data.section as string | null) ?? null,
          tags: data.tags as string[],
          metadata: data.metadata as never,
          sortOrder: data.sortOrder as number,
          isActive: data.isActive as boolean,
          createdAt: now,
          updatedAt: now,
        };
        const row = enrichChunk(chunk);
        state.chunkRows.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { metadata?: unknown; isActive?: boolean };
      }) => {
        const idx = state.chunkRows.findIndex((c) => c.id === where.id);
        if (idx < 0) throw new Error("chunk not found");
        const prev = state.chunkRows[idx]!;
        const next: KnowledgeChunk = {
          ...prev,
          metadata: (data.metadata as never) ?? prev.metadata,
          isActive: data.isActive ?? prev.isActive,
          updatedAt: new Date("2026-01-03T00:00:00.000Z"),
        };
        const row = enrichChunk(next);
        state.chunkRows[idx] = row;
        return row;
      },
      aggregate: async () => ({
        _max: { sortOrder: state.chunkRows.reduce((m, c) => Math.max(m, c.sortOrder), 0) },
      }),
      count: async ({ where }: { where: { isActive?: boolean; chunkType?: string } }) =>
        state.chunkRows.filter((c) => {
          if (where.isActive !== undefined && c.isActive !== where.isActive) return false;
          if (where.chunkType !== undefined && c.chunkType !== where.chunkType) return false;
          return true;
        }).length,
    },
    auditLog: {
      create: async ({ data }: { data: { action: string; metadata: unknown } }) => {
        state.audits.push({
          action: data.action,
          metadata: data.metadata as Record<string, unknown>,
        });
        return { id: `audit-${state.audits.length}` };
      },
    },
    $transaction: async (fn: (tx: typeof db) => Promise<unknown>) => fn(db),
  };

  return db;
}

function pushSourceDocument(
  state: ReturnType<typeof createP26E2EState>,
  input: {
    title: string;
    sourceType: string;
    sourceFormat: string;
    sourceUrl: string;
    fileName: string;
    content: string;
  },
): SourceDocument {
  state.docCounter += 1;
  const now = new Date("2026-01-01T12:00:00.000Z");
  const doc: SourceDocument = {
    id: `doc-${state.docCounter}`,
    versionId: VERSION_ID,
    title: input.title,
    sourceType: input.sourceType as SourceType,
    legacySourceType: null,
    sourceFormat: input.sourceFormat as SourceFormat,
    sourceUrl: input.sourceUrl,
    fileName: input.fileName,
    mimeType: null,
    content: input.content,
    checksum: null,
    productVersion: null,
    documentVersion: null,
    licenseStatus: null,
    validationStatus: "PASS",
    validationSummary: null,
    registeredByClientId: CLIENT_ID,
    registeredAt: now,
    createdAt: now,
    updatedAt: now,
  };
  state.sourceDocuments.push(doc);
  return doc;
}

describe("P26 GitHub auto collect E2E", () => {
  it("discovers nhn/tui.grid from mock fixtures", async () => {
    const fetchImpl = tuiGridFetchFactory(tuiGridBlobs);
    const discovery = await discoverGitHubRepository(
      { repositoryUrl: TUI_GRID_URL, maxFilesToAnalyze: 50, maxCandidateFiles: 20 },
      { fetchImpl: fetchImpl as typeof fetch },
    );

    assert.equal(discovery.repository.fullName, "nhn/tui.grid");
    assert.equal(discovery.repository.defaultBranch, "master");
    const paths = discovery.sourceCandidates.map((c) => c.path);
    assert.ok(paths.includes("README.md"));
    assert.ok(paths.some((p) => p.startsWith("docs/en/")));
    assert.ok(paths.includes("examples/basic/index.html"));

    const srcCandidate = discovery.sourceCandidates.find((c) => c.path === "src/grid.ts");
    if (srcCandidate) {
      assert.equal(srcCandidate.shouldFetchContent, false);
    }

    assert.ok(
      ["FRONTEND_COMPONENT", "CHART_COMPONENT", "UI_LIBRARY", "UNKNOWN"].includes(
        discovery.productProfile.primaryType,
      ),
    );
    assert.ok(!discovery.warnings.some((w) => /token|secret|password/i.test(w)));
  });

  it("runs auto collect lifecycle end to end with mocks", async () => {
    const state = createP26E2EState();
    const fetchImpl = tuiGridFetchFactory(tuiGridBlobs);
    const selectedPaths = ["README.md", "docs/en/getting-started.md", "docs/en/columns.md"];

    const registerResult = await registerGitHubSourceDocumentsForPack(
      CLIENT_ID,
      PACK_ID,
      {
        repositoryUrl: TUI_GRID_URL,
        selectedSourcePaths: selectedPaths,
        sourceCodeAnalysis: "NONE",
      },
      {
        fetchImpl: fetchImpl as typeof fetch,
        assertEditablePack: editableDraftPack,
        createSourceDocument: async (_clientId, _packId, input) => {
          pushSourceDocument(state, {
            title: input.title,
            sourceType: input.sourceType,
            sourceFormat: input.sourceFormat,
            sourceUrl: input.sourceUrl ?? "",
            fileName: input.fileName ?? "file",
            content: input.content ?? "",
          });
          return { pack: { packId: PACK_ID } as never };
        },
      },
    );

    assert.equal(registerResult.summary.registeredCount, 3);
    assert.ok(state.sourceDocuments.every((d) => d.sourceUrl?.includes("github.com/nhn/tui.grid")));
    assert.ok(state.sourceDocuments.every((d) => (d.content?.length ?? 0) > 20));

    const prisma = createP26E2EPrisma(state);

    const draftResult = await generateGitHubKnowledgeUnitDraftsForPack(
      CLIENT_ID,
      PACK_ID,
      { generationMode: "MINIMAL" },
      { prismaClient: prisma as never, assertEditablePack: editableDraftPack },
    );

    assert.ok(draftResult.summary.generatedDraftCount > 0, JSON.stringify(draftResult.skippedDocuments));
    const drafts = state.chunkRows.filter((c) => c.chunkType === AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE);
    assert.ok(drafts.length > 0);
    assert.ok(drafts.every((d) => d.isActive === false));
    assert.ok(
      drafts.every((d) => {
        const meta = d.metadata as Record<string, unknown>;
        return meta.reviewStatus === "pending_review" && meta.generatedBy === "github-auto-collector";
      }),
    );
    assert.ok(drafts.every((d) => d.sourceDocumentId && state.sourceDocuments.some((s) => s.id === d.sourceDocumentId)));

    const beforeActivate = state.chunkRows.filter((c) => isRetrievalCandidateChunk(c));
    assert.equal(beforeActivate.length, 0);

    const providerDrafts = await listProviderKnowledgeUnitDrafts(
      CLIENT_ID,
      PACK_ID,
      { status: "pending_review" },
      { prismaClient: prisma as never },
    );
    assert.ok(providerDrafts.items.length > 0);
    assert.ok(
      providerDrafts.items.every(
        (item) => (item.sourceDocument as Record<string, unknown> | null)?.content === undefined,
      ),
    );

    const targetDraft = providerDrafts.items[0]!;
    const columnsDraft =
      providerDrafts.items.find((d) => d.content.includes("columns")) ?? targetDraft;

    await decideAdminKnowledgeUnitDraft(
      "admin-reviewer",
      { draftId: columnsDraft.id, decision: "approve", memo: "E2E approve" },
      { prismaClient: prisma as never },
    );

    const approvedRow = state.chunkRows.find((c) => c.id === columnsDraft.id)!;
    const approvedMeta = approvedRow.metadata as Record<string, unknown>;
    assert.equal(approvedMeta.reviewStatus, "approved");
    assert.equal(approvedMeta.reviewDecision, "approve");
    assert.equal(approvedMeta.approvedForActivation, true);
    assert.equal(approvedRow.isActive, false);

    const updateAudit = state.audits.find((a) => a.action === AuditAction.ADMIN_CHUNK_UPDATE);
    assert.ok(updateAudit);
    assert.equal(updateAudit.metadata.content, undefined);
    assert.equal(updateAudit.metadata.draftContent, undefined);

    const activated = await activateAdminKnowledgeUnitDraft(
      "admin-reviewer",
      { draftId: columnsDraft.id, memo: "E2E activate" },
      { prismaClient: prisma as never },
    );

    assert.equal(activated.activatedChunk.chunkType, AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE);
    assert.equal(activated.activatedChunk.isActive, true);
    assert.equal(activated.activatedChunk.metadata.activatedFromDraftId, columnsDraft.id);
    assert.equal(activated.activatedChunk.content, columnsDraft.content);

    const draftAfter = state.chunkRows.find((c) => c.id === columnsDraft.id)!;
    assert.equal(draftAfter.isActive, false);
    const draftMetaAfter = draftAfter.metadata as Record<string, unknown>;
    assert.equal(draftMetaAfter.activationStatus, "activated");
    assert.equal(draftMetaAfter.activatedChunkId, activated.activatedChunk.id);

    const createAudit = state.audits.find((a) => a.action === AuditAction.ADMIN_CHUNK_CREATE);
    assert.ok(createAudit);
    assert.equal(createAudit.metadata.content, undefined);

    await assert.rejects(
      () =>
        activateAdminKnowledgeUnitDraft(
          "admin-reviewer",
          { draftId: columnsDraft.id },
          { prismaClient: prisma as never },
        ),
      (err: unknown) => (err as { code: string }).code === "ALREADY_ACTIVATED",
    );

    const activeCandidates = state.chunkRows.filter((c) => isRetrievalCandidateChunk(c));
    assert.equal(activeCandidates.length, 1);
    assert.equal(activeCandidates[0]?.chunkType, AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE);

    const inactiveDrafts = state.chunkRows.filter(
      (c) => c.chunkType === AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE && !c.isActive,
    );
    assert.ok(inactiveDrafts.length >= 1);
    assert.ok(!inactiveDrafts.some((c) => isRetrievalCandidateChunk(c)));

    const tokens = ["TOAST", "UI", "Grid", "컬럼", "columns"];
    const scored = activeCandidates.map((chunk) =>
      scoreRetrievalChunk({
        chunk: {
          title: chunk.title,
          content: chunk.content,
          section: chunk.section,
          chunkType: chunk.chunkType,
          tags: chunk.tags,
          sortOrder: chunk.sortOrder,
          createdAt: chunk.createdAt,
          metadata: chunk.metadata as Record<string, unknown> | null,
        },
        tokens,
        filters: {},
      }),
    );
    assert.ok(scored[0]!.score > 0);

    const draftOnlyPhrase = "draft-only-should-not-rank";
    assert.ok(!activeCandidates[0]!.content.includes(draftOnlyPhrase));
    for (const draft of inactiveDrafts) {
      assert.ok(!draft.content.includes(draftOnlyPhrase) || !isRetrievalCandidateChunk(draft));
    }
  });
});

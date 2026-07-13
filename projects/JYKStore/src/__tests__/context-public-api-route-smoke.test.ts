import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KnowledgeChunk } from "@prisma/client";
import { PackStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { createContextGetHandler, createContextQueryHandler } from "@/lib/context-public-api-routes";
import { DEFAULT_QUOTA_POLICY } from "@/lib/quota-policy";
import type { PackContextResponseDto } from "@/lib/context-dto";
import type { PublicApiGatewayOverrides } from "@/lib/public-api-route";

const PACK_ID = "toast-ui-grid-pack";
const VERSION_ID = "ver-1";
const DRAFT_SECRET = "draft-only-should-not-appear";
const SOURCE_DOC_SECRET = "SOURCE-DOCUMENT-CONTENT-SHOULD-NOT-APPEAR";
const ACTIVE_SNIPPET = "TOAST UI Grid columns 배열과 name header 설정 방법";

const sourceDocument = {
  id: "doc-1",
  versionId: VERSION_ID,
  title: "docs/en/columns.md",
  sourceUrl: "https://github.com/nhn/tui.grid/blob/master/docs/en/columns.md",
  sourceType: "GITHUB",
  content: SOURCE_DOC_SECRET,
};

const inactiveDraft = {
  id: "draft-1",
  versionId: VERSION_ID,
  chunkType: "AUTO_KNOWLEDGE_UNIT_DRAFT",
  title: "Draft only",
  content: DRAFT_SECRET,
  section: null,
  tags: [] as string[],
  sortOrder: 0,
  isActive: false,
  metadata: {
    reviewStatus: "approved",
    reviewDecision: "approve",
    approvedForActivation: true,
  },
  sourceDocumentId: sourceDocument.id,
  sourceDocument,
};

const activeChunk = {
  id: "active-1",
  versionId: VERSION_ID,
  chunkType: "AUTO_KNOWLEDGE_UNIT",
  title: "TOAST UI Grid 컬럼 설정",
  content: ACTIVE_SNIPPET,
  section: "columns",
  tags: ["grid", "columns"],
  sortOrder: 1,
  isActive: true,
  metadata: {
    activatedFromDraftId: "draft-1",
    activationStatus: "active",
  },
  sourceDocumentId: sourceDocument.id,
  sourceDocument,
};

const allChunks = [inactiveDraft, activeChunk];

const packRow = {
  packId: PACK_ID,
  name: "TOAST UI Grid",
  status: PackStatus.PUBLISHED,
  providerName: "NHN",
  shortDescription: "Grid component pack",
  category: { name: "UI Components" },
};

const versionRow = {
  id: VERSION_ID,
  version: "1.0.0",
  overview: "TOAST UI Grid overview",
  features: ["columns", "data"],
};

function chunkMatchesToken(chunk: KnowledgeChunk, token: string): boolean {
  const needle = token.toLowerCase();
  return (
    chunk.title.toLowerCase().includes(needle) ||
    chunk.content.toLowerCase().includes(needle) ||
    (chunk.section?.toLowerCase().includes(needle) ?? false) ||
    chunk.chunkType.toLowerCase().includes(needle) ||
    chunk.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
}

function createSmokePrismaMock() {
  return {
    knowledgePack: {
      findFirst: async (args: {
        where: { packId: string; status?: { in: PackStatus[] } };
      }) => {
        const allowed = args.where.status?.in ?? [];
        if (packRow.packId !== args.where.packId) return null;
        if (allowed.length > 0 && !allowed.includes(packRow.status)) return null;
        return {
          ...packRow,
          versions: [versionRow],
        };
      },
    },
    knowledgeChunk: {
      count: async (args: {
        where: {
          versionId: string;
          isActive?: boolean;
        };
      }) => {
        return allChunks.filter(
          (chunk) =>
            chunk.versionId === args.where.versionId &&
            (args.where.isActive === undefined || chunk.isActive === args.where.isActive),
        ).length;
      },
      findMany: async (args: {
        where: {
          versionId: string;
          isActive?: boolean;
          OR?: Array<Record<string, unknown>>;
        };
        take?: number;
      }) => {
        let rows = allChunks.filter(
          (chunk) =>
            chunk.versionId === args.where.versionId &&
            (args.where.isActive === undefined || chunk.isActive === args.where.isActive),
        );

        const orClauses = args.where.OR;
        if (orClauses && orClauses.length > 0) {
          const tokens = new Set<string>();
          for (const clause of orClauses) {
            for (const field of Object.values(clause)) {
              if (field && typeof field === "object" && "contains" in field) {
                const contains = (field as { contains: string }).contains;
                if (typeof contains === "string") tokens.add(contains.toLowerCase());
              }
            }
          }
          if (tokens.size > 0) {
            rows = rows.filter((chunk) =>
              [...tokens].some((token) => chunkMatchesToken(chunk as KnowledgeChunk, token)),
            );
          }
        }

        const take = args.take ?? rows.length;
        return rows.slice(0, take);
      },
    },
    apiUsageLog: {
      create: async () => ({}),
    },
  };
}

const smokeGatewayOverrides: PublicApiGatewayOverrides = {
  requireContextReadApiKey: async (context) => {
    context.apiKeyId = "smoke-api-key-id";
    context.clientId = "smoke-client-id";
    return { ok: true, apiKeyId: "smoke-api-key-id", clientId: "smoke-client-id" };
  },
  requireQuota: async (context) => {
    const quota = {
      ok: true as const,
      tenantKey: "smoke-client-id",
      policy: DEFAULT_QUOTA_POLICY,
      usage: {
        minuteCount: 0,
        dayCount: 0,
        perMinuteLimit: DEFAULT_QUOTA_POLICY.perMinuteRequests,
        perDayLimit: DEFAULT_QUOTA_POLICY.perDayRequests,
      },
    };
    context.quota = quota;
    return { ok: true, quota };
  },
  recordPublicApiUsage: async () => {},
};

const routeOptions = {
  contextServiceDeps: { prismaClient: createSmokePrismaMock() as never },
  gatewayOverrides: smokeGatewayOverrides,
};

const getContext = createContextGetHandler(routeOptions);
const postContextQuery = createContextQueryHandler(routeOptions);

function authHeaders(): Record<string, string> {
  return {
    Authorization: "Bearer jyk_live_smoke_test_only_not_a_real_key",
  };
}

function assertPackContextShape(body: PackContextResponseDto) {
  assert.deepEqual(Object.keys(body).sort(), ["context", "pack", "usage"]);
  assert.deepEqual(Object.keys(body.pack).sort(), [
    "category",
    "name",
    "packId",
    "provider",
    "status",
    "version",
  ]);
  assert.deepEqual(Object.keys(body.context).sort(), ["chunks", "instructions", "summary"]);
  assert.deepEqual(Object.keys(body.usage).sort(), ["chunkCount", "requestId"]);
  assert.ok(body.usage.requestId.startsWith("req_"));
  assert.ok(body.context.chunks.length > 0);
  const chunk = body.context.chunks[0];
  assert.deepEqual(Object.keys(chunk).sort(), [
    "chunkId",
    "chunkType",
    "content",
    "metadata",
    "section",
    "source",
    "tags",
    "title",
  ]);
}

function assertSmokeContent(serialized: string) {
  assert.equal(serialized.includes(DRAFT_SECRET), false);
  assert.equal(serialized.includes(SOURCE_DOC_SECRET), false);
  assert.equal(serialized.includes("TOAST UI Grid"), true);
  assert.equal(serialized.includes("columns"), true);
}

describe("Context Public API route smoke", () => {
  it("GET context returns active activated knowledge and excludes inactive draft", async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/packs/${PACK_ID}/context?q=${encodeURIComponent("TOAST UI Grid columns")}&limit=5`,
      { headers: authHeaders() },
    );

    const response = await getContext(request, {
      params: Promise.resolve({ packId: PACK_ID }),
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as PackContextResponseDto;
    assertPackContextShape(body);
    assert.ok(body.usage.chunkCount > 0);
    assert.equal(body.context.chunks.some((c) => c.content.includes(ACTIVE_SNIPPET)), true);
    assertSmokeContent(JSON.stringify(body));
  });

  it("POST context query returns active activated knowledge and excludes inactive draft", async () => {
    const request = new NextRequest(`http://localhost/api/v1/packs/${PACK_ID}/context/query`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "TOAST UI Grid columns",
        limit: 5,
        includeMetadata: true,
      }),
    });

    const response = await postContextQuery(request, {
      params: Promise.resolve({ packId: PACK_ID }),
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as PackContextResponseDto;
    assertPackContextShape(body);
    const chunk = body.context.chunks[0];
    assert.equal(chunk.metadata?.sortOrder, activeChunk.sortOrder);
    assert.equal(chunk.source?.documentId, sourceDocument.id);
    assert.equal(chunk.source?.title, sourceDocument.title);
    assertSmokeContent(JSON.stringify(body));
  });

  it("POST context query returns 400 for invalid JSON", async () => {
    const request = new NextRequest(`http://localhost/api/v1/packs/${PACK_ID}/context/query`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: "{bad-json",
    });

    const response = await postContextQuery(request, {
      params: Promise.resolve({ packId: PACK_ID }),
    });

    assert.equal(response.status, 400);
    const body = (await response.json()) as {
      error: { code: string; message: string };
      usage: { requestId: string };
    };
    assert.equal(body.error.code, "INVALID_REQUEST");
    assert.ok(body.usage.requestId.startsWith("req_"));
    const serialized = JSON.stringify(body);
    assert.equal(serialized.includes("at "), false);
    assert.equal(serialized.includes("stack"), false);
  });

  it("exported GET/POST are production context route handlers", async () => {
    const { GET: productionGet } = await import("@/app/api/v1/packs/[packId]/context/route");
    const { POST: productionPost } = await import(
      "@/app/api/v1/packs/[packId]/context/query/route"
    );
    assert.equal(typeof productionGet, "function");
    assert.equal(typeof productionPost, "function");
    assert.equal(productionGet.name, "GET");
    assert.equal(productionPost.name, "POST");
    assert.notEqual(productionGet, getContext);
  });
});

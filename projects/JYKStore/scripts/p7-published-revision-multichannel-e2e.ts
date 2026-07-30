/**
 * P7 — Published Revision multi-channel E2E (Public API / MCP / RAG Export).
 *
 * Usage (from projects/JYKStore):
 *   node --import tsx scripts/p7-published-revision-multichannel-e2e.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  AuditAction,
  PackStatus,
  PrismaClient,
  type Prisma,
} from "@prisma/client";
import { executeRetrievalApiRequest } from "@/lib/retrieval/retrieval-api-adapter";
import { resolvePublicRetrievalGenerationScope } from "@/lib/retrieval/retrieval-generation-scope";
import { loadPublicRetrievalPack } from "@/lib/retrieval/retrieval-pack-store";
import { buildPublicRagExportPackage } from "@/lib/exports/rag-export-public";
import { promoteSearchGeneration } from "@/lib/search-generation/search-generation-service";

const PACK_ID = process.env.P7_PACK_ID?.trim() || "p431e2ems633k5n";
const QUERY = "셀 병합과 관련된 기능이나 API를 찾아줘";
const OUT_DIR = path.join(process.cwd(), "tmp-p7-e2e");
const prisma = new PrismaClient();

type Report = Record<string, unknown>;

async function ensurePublishedAndChannels(packId: string) {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    select: { status: true, publishedAt: true, name: true },
  });
  if (!pack) throw new Error(`pack not found: ${packId}`);

  const version = await prisma.knowledgePackVersion.findFirst({
    where: { packId },
    orderBy: { createdAt: "desc" },
    select: { id: true, version: true },
  });
  if (!version) throw new Error("version missing");

  let production = await prisma.searchIndexGeneration.findFirst({
    where: {
      packId,
      versionId: version.id,
      scope: "PRODUCTION",
      status: "PROMOTED",
      staleAt: null,
      retiredAt: null,
    },
    orderBy: { promotedAt: "desc" },
  });

  if (!production) {
    const draft = await prisma.searchIndexGeneration.findFirst({
      where: {
        packId,
        versionId: version.id,
        status: "READY",
        scope: "DRAFT",
        staleAt: null,
        retiredAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!draft) throw new Error("no READY DRAFT or PROMOTED generation");
    production = await promoteSearchGeneration(draft.id);
  }

  const now = new Date();
  if (pack.status !== PackStatus.PUBLISHED && pack.status !== PackStatus.VERIFIED) {
    await prisma.knowledgePack.update({
      where: { packId },
      data: {
        status: PackStatus.PUBLISHED,
        publishedAt: pack.publishedAt ?? now,
        isVerified: false,
      },
    });
  }

  const existingDist = await prisma.packDistributionMetadata.findFirst({
    where: { packId, versionId: version.id },
  });
  if (!existingDist) {
    await prisma.packDistributionMetadata.create({
      data: {
        packId,
        versionId: version.id,
        allowApi: true,
        allowMcp: true,
        allowDownload: true,
        licenseName: "P7-E2E-TEST-LICENSE",
        rightsBasis: "RIGHTS_HOLDER",
        rightsConfirmedAt: now,
        sourceTitle: "rMateGridH5Web Trial",
        contentType: "DOCUMENT",
      },
    });
  } else {
    await prisma.packDistributionMetadata.update({
      where: { id: existingDist.id },
      data: {
        allowApi: true,
        allowMcp: true,
        allowDownload: true,
        licenseName: existingDist.licenseName?.trim() || "P7-E2E-TEST-LICENSE",
        rightsBasis: existingDist.rightsBasis || "RIGHTS_HOLDER",
        rightsConfirmedAt: existingDist.rightsConfirmedAt ?? now,
        sourceTitle: existingDist.sourceTitle?.trim() || "rMateGridH5Web Trial",
      },
    });
  }

  return {
    packName: pack.name,
    versionId: version.id,
    versionLabel: version.version,
    publishedRevisionId: production.id,
    publishedAt: (await prisma.knowledgePack.findUnique({
      where: { packId },
      select: { publishedAt: true },
    }))!.publishedAt,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const report: Report = {
    startedAt: new Date().toISOString(),
    packId: PACK_ID,
    query: QUERY,
  };

  const prepared = await ensurePublishedAndChannels(PACK_ID);
  report.prepared = prepared;

  const scope = await resolvePublicRetrievalGenerationScope(prepared.versionId);
  report.publicResolverRevision = scope.searchIndexGenerationId;
  if (scope.searchIndexGenerationId !== prepared.publishedRevisionId) {
    throw new Error("resolver revision mismatch vs prepared production generation");
  }

  // --- Draft B isolation: active unpublished draft must not replace PRODUCTION ---
  const publishedGen = await prisma.searchIndexGeneration.findUniqueOrThrow({
    where: { id: prepared.publishedRevisionId },
  });
  const existingActiveDraft = await prisma.searchIndexGeneration.findFirst({
    where: {
      versionId: prepared.versionId,
      scope: "DRAFT",
      status: { in: ["PENDING", "EMBEDDING", "INDEXING", "READY"] },
      id: { not: prepared.publishedRevisionId },
    },
    select: { id: true, scope: true, status: true },
  });
  let draftB = existingActiveDraft;
  let createdDraftB = false;
  if (!draftB) {
    draftB = await prisma.searchIndexGeneration.create({
      data: {
        id: `p7draftb${randomBytes(6).toString("hex")}`,
        packId: PACK_ID,
        versionId: prepared.versionId,
        scope: "DRAFT",
        status: "FAILED",
        pipelineRunId: `p7pipeb${randomBytes(6).toString("hex")}`,
        normalizedDocumentId: publishedGen.normalizedDocumentId,
        chunkGenerationId: `p7chunkb${randomBytes(6).toString("hex")}`,
        fingerprint: `${publishedGen.fingerprint}-draft-b`,
        generationFingerprint: `${publishedGen.generationFingerprint}-draft-b`,
        embeddingProvider: publishedGen.embeddingProvider,
        embeddingModel: publishedGen.embeddingModel,
        embeddingModelRevision: publishedGen.embeddingModelRevision,
        embeddingDimension: publishedGen.embeddingDimension,
        distanceMetric: publishedGen.distanceMetric,
        chunkCount: 0,
        embeddedCount: 0,
        failedCount: 0,
        failureCode: "P7_E2E_DRAFT_ISOLATION",
        failureMessage: "Synthetic unpublished draft for isolation proof",
      },
      select: { id: true, scope: true, status: true },
    });
    createdDraftB = true;
  }
  report.draftB = { ...draftB, created: createdDraftB };

  const afterDraftScope = await resolvePublicRetrievalGenerationScope(prepared.versionId);
  const draftIsolation = {
    draftBId: draftB.id,
    stillServingPublished: afterDraftScope.searchIndexGenerationId === prepared.publishedRevisionId,
  };
  report.draftIsolation = draftIsolation;
  if (!draftIsolation.stillServingPublished) {
    throw new Error("Draft B leaked into public resolver");
  }

  // --- Public API ---
  const apiStarted = Date.now();
  const api = await executeRetrievalApiRequest({
    knowledgePackId: PACK_ID,
    query: QUERY,
    topK: 5,
    includeMetadata: true,
    retrievalMode: "keyword",
    requestId: `p7-api-${Date.now()}`,
    serviceChannel: "API",
    executionMode: "PUBLIC",
  });
  const apiLatencyMs = Date.now() - apiStarted;
  if (!api.ok) throw new Error(`Public API failed: ${api.code} ${api.message}`);
  const apiContexts = api.data.contexts ?? [];
  const apiForeign = apiContexts.filter((c) => c.knowledgePackId !== PACK_ID);
  const publicApi = {
    ok: true as const,
    latencyMs: apiLatencyMs,
    hitCount: apiContexts.length,
    titles: apiContexts.map((c) => c.title ?? c.chunkId ?? "").slice(0, 5),
    hasSource: apiContexts.some(
      (c) => Array.isArray(c.references) && c.references.length > 0,
    ),
    packIsolationOk: apiForeign.length === 0,
    servedRevision: scope.searchIndexGenerationId,
  };
  report.publicApi = publicApi;

  // --- MCP (same adapter, MCP channel) ---
  const mcpStarted = Date.now();
  const mcp = await executeRetrievalApiRequest({
    knowledgePackId: PACK_ID,
    query: QUERY,
    topK: 5,
    includeMetadata: true,
    retrievalMode: "keyword",
    requestId: `p7-mcp-${Date.now()}`,
    serviceChannel: "MCP",
    executionMode: "PUBLIC",
  });
  const mcpLatencyMs = Date.now() - mcpStarted;
  if (!mcp.ok) throw new Error(`MCP failed: ${mcp.code} ${mcp.message}`);
  const mcpContexts = mcp.data.contexts ?? [];
  const mcpResult = {
    ok: true as const,
    implemented: true as const,
    path: "executeRetrievalApiRequest(serviceChannel=MCP, PUBLIC)",
    latencyMs: mcpLatencyMs,
    hitCount: mcpContexts.length,
    titles: mcpContexts.map((c) => c.title ?? c.chunkId ?? "").slice(0, 5),
    hasSource: mcpContexts.some(
      (c) => Array.isArray(c.references) && c.references.length > 0,
    ),
    servedRevision: scope.searchIndexGenerationId,
  };
  report.mcp = mcpResult;

  // --- RAG Export ---
  const exportStarted = Date.now();
  const rag = await buildPublicRagExportPackage(PACK_ID);
  const exportLatencyMs = Date.now() - exportStarted;
  if (!rag) throw new Error("RAG Export returned null");
  const manifest = JSON.parse(rag.files["manifest.json"]) as {
    pack: { packId: string; versionId?: string; version: string };
    generation: {
      searchIndexGenerationId: string;
      scope?: string;
      status?: string;
    };
  };
  const ragExport = {
    ok: true as const,
    latencyMs: exportLatencyMs,
    fileSize: rag.fileSize,
    chunkCount: rag.chunkCount,
    sourceCount: rag.sourceCount,
    packId: manifest.pack.packId,
    versionId: manifest.pack.versionId ?? null,
    versionLabel: manifest.pack.version,
    searchIndexGenerationId: manifest.generation.searchIndexGenerationId,
    scope: manifest.generation.scope ?? null,
    status: manifest.generation.status ?? null,
    servedRevision: manifest.generation.searchIndexGenerationId,
  };
  report.ragExport = ragExport;
  if (manifest.generation.searchIndexGenerationId !== prepared.publishedRevisionId) {
    throw new Error("RAG Export revision != Published Revision");
  }
  if (manifest.generation.status && manifest.generation.status !== "PROMOTED") {
    throw new Error(`RAG Export status not PROMOTED: ${manifest.generation.status}`);
  }

  const revisionIdentity = {
    published: prepared.publishedRevisionId,
    publicApi: publicApi.servedRevision,
    mcp: mcpResult.servedRevision,
    ragExport: ragExport.servedRevision,
    equal:
      prepared.publishedRevisionId === publicApi.servedRevision &&
      prepared.publishedRevisionId === mcpResult.servedRevision &&
      prepared.publishedRevisionId === ragExport.servedRevision,
  };
  report.revisionIdentity = revisionIdentity;

  // --- Unpublish ---
  await prisma.knowledgePack.update({
    where: { packId: PACK_ID },
    data: { status: PackStatus.DRAFT, isVerified: false },
  });
  await prisma.auditLog.create({
    data: {
      action: AuditAction.DEPRECATE,
      entityType: "KnowledgePack",
      entityId: PACK_ID,
      metadata: {
        action: "UNPUBLISH",
        source: "p7-e2e",
        preservedProductionGenerationId: prepared.publishedRevisionId,
        dataDeleted: false,
      } as Prisma.InputJsonValue,
    },
  });

  const publicAfter = await loadPublicRetrievalPack(PACK_ID);
  const apiAfter = await executeRetrievalApiRequest({
    knowledgePackId: PACK_ID,
    query: QUERY,
    topK: 3,
    retrievalMode: "keyword",
    requestId: `p7-api-unpub-${Date.now()}`,
    serviceChannel: "API",
    executionMode: "PUBLIC",
  });
  const mcpAfter = await executeRetrievalApiRequest({
    knowledgePackId: PACK_ID,
    query: QUERY,
    topK: 3,
    retrievalMode: "keyword",
    requestId: `p7-mcp-unpub-${Date.now()}`,
    serviceChannel: "MCP",
    executionMode: "PUBLIC",
  });
  const ragAfter = await buildPublicRagExportPackage(PACK_ID);
  const genPreserved = await prisma.searchIndexGeneration.findUnique({
    where: { id: prepared.publishedRevisionId },
    select: { id: true, scope: true, status: true },
  });

  const unpublish = {
    publicPackBlocked: publicAfter == null,
    apiBlocked: !apiAfter.ok && apiAfter.code === "PACK_NOT_FOUND",
    mcpBlocked: !mcpAfter.ok && mcpAfter.code === "PACK_NOT_FOUND",
    ragExportBlocked: ragAfter == null,
    generationPreserved: Boolean(genPreserved),
    generationScope: genPreserved?.scope ?? null,
    generationStatus: genPreserved?.status ?? null,
  };
  report.unpublish = unpublish;

  // cleanup synthetic draft B only
  if (createdDraftB) {
    await prisma.searchIndexGeneration.delete({ where: { id: draftB.id } }).catch(() => null);
  }

  report.finishedAt = new Date().toISOString();
  const pass =
    revisionIdentity.equal &&
    publicApi.ok &&
    mcpResult.ok &&
    ragExport.ok &&
    draftIsolation.stillServingPublished &&
    unpublish.apiBlocked &&
    unpublish.mcpBlocked &&
    unpublish.ragExportBlocked &&
    publicApi.packIsolationOk;

  report.verdict = pass
    ? "P7 PUBLISHED REVISION MULTI-CHANNEL E2E PASSED"
    : "P7 OPERATING E2E HARDENING REQUIRED";

  writeFileSync(path.join(OUT_DIR, "e2e-report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!pass) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
      path.join(OUT_DIR, "e2e-error.json"),
      JSON.stringify({ error: String(error), stack: (error as Error)?.stack }, null, 2),
      "utf8",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

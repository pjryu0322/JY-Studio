/**
 * P8.1 exploratory probe — OLAPAttribute + merge-related chunks + Top-K dump.
 * Usage: node --import tsx scripts/p8-olap-probe.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PackStatus, PrismaClient } from "@prisma/client";
import { executeRetrievalApiRequest } from "@/lib/retrieval/retrieval-api-adapter";
import { resolvePublicRetrievalGenerationScope } from "@/lib/retrieval/retrieval-generation-scope";
import { promoteSearchGeneration } from "@/lib/search-generation/search-generation-service";

const PACK_ID = process.env.P8_PACK_ID?.trim() || "p431e2ems633k5n";
const QUERY = "셀 병합과 관련된 기능이나 API를 찾아줘";
const OUT = path.join(process.cwd(), "tmp-p8-e2e");
const prisma = new PrismaClient();

async function ensurePublished(packId: string) {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    select: { status: true, publishedAt: true },
  });
  if (!pack) throw new Error(`pack not found: ${packId}`);
  const version = await prisma.knowledgePackVersion.findFirst({
    where: { packId },
    orderBy: { createdAt: "desc" },
    select: { id: true, version: true },
  });
  if (!version) throw new Error("no version");

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
    if (!draft) throw new Error("no generation to promote");
    production = await promoteSearchGeneration(draft.id);
  }

  const now = new Date();
  if (pack.status !== PackStatus.PUBLISHED && pack.status !== PackStatus.VERIFIED) {
    await prisma.knowledgePack.update({
      where: { packId },
      data: { status: PackStatus.PUBLISHED, publishedAt: pack.publishedAt ?? now },
    });
  }

  const dist = await prisma.packDistributionMetadata.findFirst({
    where: { packId, versionId: version.id },
  });
  if (!dist) {
    await prisma.packDistributionMetadata.create({
      data: {
        packId,
        versionId: version.id,
        allowApi: true,
        allowMcp: true,
        allowDownload: true,
        licenseName: "P8-E2E-TEST-LICENSE",
        rightsBasis: "RIGHTS_HOLDER",
        rightsConfirmedAt: now,
        sourceTitle: "rMateGridH5Web Trial",
        contentType: "DOCUMENT",
      },
    });
  } else if (!dist.allowApi || !dist.allowMcp) {
    await prisma.packDistributionMetadata.update({
      where: { id: dist.id },
      data: { allowApi: true, allowMcp: true, allowDownload: true },
    });
  }

  return { version, production };
}

function metaPath(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const p = m.sourcePath ?? m.path ?? m.relativePath;
  return typeof p === "string" ? p : null;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { version, production } = await ensurePublished(PACK_ID);
  const scope = await resolvePublicRetrievalGenerationScope(version.id);

  const exactOlap = await prisma.knowledgeChunk.findMany({
    where: {
      versionId: version.id,
      isActive: true,
      title: "OLAPAttribute",
    },
    include: {
      sourceDocument: {
        select: { id: true, title: true, fileName: true, sourceUrl: true },
      },
    },
    take: 10,
  });

  const mergeChunks = await prisma.knowledgeChunk.findMany({
    where: {
      versionId: version.id,
      isActive: true,
      OR: [
        { title: { contains: "SpanMerg", mode: "insensitive" } },
        { title: { contains: "merge", mode: "insensitive" } },
        { title: { contains: "병합", mode: "insensitive" } },
        { content: { contains: "mergeCells", mode: "insensitive" } },
        { content: { contains: "셀 병합", mode: "insensitive" } },
        { content: { contains: "병합", mode: "insensitive" } },
      ],
    },
    include: {
      sourceDocument: {
        select: { id: true, title: true, fileName: true },
      },
    },
    take: 50,
  });

  const started = Date.now();
  const retrieval = await executeRetrievalApiRequest({
    knowledgePackId: PACK_ID,
    query: QUERY,
    topK: 10,
    includeMetadata: true,
    retrievalMode: "keyword",
    requestId: `p8-olap-${Date.now()}`,
    serviceChannel: "API",
    executionMode: "PUBLIC",
  });
  const latencyMs = Date.now() - started;
  if (!retrieval.ok) {
    throw new Error(`retrieval failed: ${retrieval.code} ${retrieval.message}`);
  }

  const report = {
    packId: PACK_ID,
    versionId: version.id,
    versionLabel: version.version,
    publishedRevision: production.id,
    publicResolverRevision: scope.searchIndexGenerationId,
    query: QUERY,
    latencyMs,
    topK: retrieval.data.contexts.map((c, i) => ({
      rank: i + 1,
      chunkId: c.chunkId,
      title: c.title,
      score: c.score,
      matchReasons: c.matchReasons,
      scoreDetail: c.scoreDetail ?? null,
      knowledgePackId: c.knowledgePackId,
      contentPreview: (c.content ?? "").slice(0, 500),
      metadata: c.metadata ?? null,
      references: c.references ?? [],
      sourcePath:
        c.metadata && typeof c.metadata === "object"
          ? ((c.metadata as Record<string, unknown>).sourcePath as string | undefined) ?? null
          : null,
    })),
    exactOlapAttributeChunks: exactOlap.map((ch) => ({
      id: ch.id,
      title: ch.title,
      section: ch.section,
      tags: ch.tags,
      sourcePath: metaPath(ch.metadata),
      sourceDocumentId: ch.sourceDocumentId,
      sourceFileName: ch.sourceDocument?.fileName ?? null,
      sourceTitle: ch.sourceDocument?.title ?? null,
      content: ch.content,
      metadata: ch.metadata,
    })),
    mergeRelatedChunks: mergeChunks.map((ch) => ({
      id: ch.id,
      title: ch.title,
      section: ch.section,
      tags: ch.tags,
      sourcePath: metaPath(ch.metadata),
      sourceFileName: ch.sourceDocument?.fileName ?? null,
      contentPreview: (ch.content ?? "").slice(0, 600),
    })),
  };

  writeFileSync(path.join(OUT, "olap-probe.json"), JSON.stringify(report, null, 2), "utf8");
  console.log("[p8-olap] wrote", path.join(OUT, "olap-probe.json"));
  console.log(
    JSON.stringify(
      {
        revision: report.publishedRevision,
        top1: report.topK[0]
          ? {
              title: report.topK[0].title,
              score: report.topK[0].score,
              sourcePath: report.topK[0].sourcePath,
            }
          : null,
        topTitles: report.topK.map((t) => `${t.rank}:${t.title}`),
        exactOlapCount: report.exactOlapAttributeChunks.length,
        mergeCount: report.mergeRelatedChunks.length,
        mergeTitles: report.mergeRelatedChunks.map((m) => m.title).slice(0, 20),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

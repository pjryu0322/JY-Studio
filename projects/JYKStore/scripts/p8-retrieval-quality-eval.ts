/**
 * P8.1 retrieval semantic quality eval + before/after metrics.
 * Usage: node --import tsx scripts/p8-retrieval-quality-eval.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PackStatus, PrismaClient } from "@prisma/client";
import { executeRetrievalApiRequest } from "@/lib/retrieval/retrieval-api-adapter";
import { resolvePublicRetrievalGenerationScope } from "@/lib/retrieval/retrieval-generation-scope";
import { promoteSearchGeneration } from "@/lib/search-generation/search-generation-service";
import { tokenizeSearchQuery } from "@/lib/search-utils";

const PACK_ID = process.env.P8_PACK_ID?.trim() || "p431e2ems633k5n";
const OUT = path.join(process.cwd(), "tmp-p8-e2e");
const prisma = new PrismaClient();

type GroundTruth = {
  id: string;
  question: string;
  type: string;
  expectedTitles: string[];
  expectedSourcePathIncludes?: string[];
  expectedApis: string[];
  acceptableAlternatives: string[];
  mustNotReturn: string[];
  notes: string;
};

/** Ground truth derived from actual Docs/api + Samples in the Published pack. */
const GROUND_TRUTH: GroundTruth[] = [
  {
    id: "q01-cell-merge-ko",
    question: "셀 병합과 관련된 기능이나 API를 찾아줘",
    type: "기능/API 탐색 (KO)",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection", "SpanArrayCollection"],
    expectedSourcePathIncludes: ["SpanMergingField", "SpanSummary", "SpanArray"],
    expectedApis: ["SpanMergingField", "SpanSummaryCollection", "mergingFields"],
    acceptableAlternatives: [
      "SpanCellAttribute",
      "SpanGroupingField",
      "SpanGroupingCollection",
      "Summary MergeJsFunction",
      "Editing SpanSummaryCollection",
      "SpanGrouping Data",
    ],
    mustNotReturn: ["RealGrid", "Toast UI", "toastui"],
    notes: "P7 representative; OLAPAttribute is false positive for cell merge",
  },
  {
    id: "q02-span-merging-field",
    question: "SpanMergingField API",
    type: "속성/옵션 (EN)",
    expectedTitles: ["SpanMergingField"],
    expectedSourcePathIncludes: ["SpanMergingField"],
    expectedApis: ["SpanMergingField"],
    acceptableAlternatives: ["SpanSummaryCollection"],
    mustNotReturn: ["RealGrid"],
    notes: "Direct API name lookup",
  },
  {
    id: "q03-merge-fields-ko",
    question: "DataGrid에서 병합할 필드를 정의하려면?",
    type: "기능/API 탐색 (KO)",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection"],
    expectedSourcePathIncludes: ["SpanMerging"],
    expectedApis: ["SpanMergingField", "mergingFields"],
    acceptableAlternatives: ["SpanArrayCollection"],
    mustNotReturn: ["RealGrid"],
    notes: "Korean how-to for field merge definition",
  },
  {
    id: "q04-datagrid-en",
    question: "DataGrid properties horizontalScrollPolicy",
    type: "속성/옵션 (EN)",
    expectedTitles: ["DataGrid", "DataGridColumn", "DataGridColumn Properties"],
    expectedSourcePathIncludes: ["DataGrid"],
    expectedApis: ["DataGrid", "horizontalScrollPolicy"],
    acceptableAlternatives: ["DataGridColumn"],
    mustNotReturn: ["RealGrid"],
    notes: "Core grid component",
  },
  {
    id: "q05-itemclick-event",
    question: "itemClick 이벤트는 언제 발생하나요?",
    type: "이벤트 (KO)",
    expectedTitles: ["DataGrid", "itemClick"],
    expectedSourcePathIncludes: ["DataGrid", "Event"],
    expectedApis: ["itemClick"],
    acceptableAlternatives: ["itemDoubleClick", "change"],
    mustNotReturn: ["RealGrid"],
    notes: "Event discovery",
  },
  {
    id: "q06-excel-export",
    question: "Excel export 제목 행을 여러 줄로 넣는 방법",
    type: "코드 작성 (KO)",
    expectedTitles: ["DataGrid", "Excel Export TitleFooters"],
    expectedSourcePathIncludes: ["DataGrid", "Excel", "TitleFooter"],
    expectedApis: ["exportTitles", "exportTitleHeight"],
    acceptableAlternatives: ["DataGrid"],
    mustNotReturn: ["RealGrid"],
    notes: "exportTitles documented on DataGrid",
  },
  {
    id: "q07-olap-attribute",
    question: "OLAPAttribute displayName 속성은 무엇을 하나요?",
    type: "유사 개념 구분 (KO)",
    expectedTitles: ["OLAPAttribute"],
    expectedSourcePathIncludes: ["OLAPAttribute"],
    expectedApis: ["OLAPAttribute", "displayName"],
    acceptableAlternatives: ["OLAPDimension", "OLAPLevel"],
    mustNotReturn: ["SpanMergingField"],
    notes: "OLAP is correct when asking about OLAPAttribute specifically",
  },
  {
    id: "q08-span-vs-olap",
    question: "셀 병합 SpanMergingField와 OLAPAttribute 차이는?",
    type: "유사 개념 구분 (KO)",
    expectedTitles: ["SpanMergingField", "OLAPAttribute"],
    expectedSourcePathIncludes: ["SpanMergingField", "OLAPAttribute"],
    expectedApis: ["SpanMergingField", "OLAPAttribute"],
    acceptableAlternatives: ["SpanSummaryCollection", "OLAPDimension"],
    mustNotReturn: ["RealGrid"],
    notes: "Both may appear; merge API should rank for 병합 context",
  },
  {
    id: "q09-cell-attribute",
    question: "SpanCellAttribute rowSpan 설정 방법",
    type: "문제 해결 (KO/EN)",
    expectedTitles: ["SpanCellAttribute", "SpanArrayCollection"],
    expectedSourcePathIncludes: ["SpanCellAttribute", "SpanArray"],
    expectedApis: ["SpanCellAttribute", "rowSpan"],
    acceptableAlternatives: ["SpanRowAttribute"],
    mustNotReturn: ["RealGrid"],
    notes: "Cell attribute spanning",
  },
  {
    id: "q10-grouping-sample",
    question: "SpanGroupingCollection으로 그룹핑 합산행 예제",
    type: "코드 작성 (KO)",
    expectedTitles: ["SpanGrouping Data", "SpanGroupingField", "SpanGroupingCollection"],
    expectedSourcePathIncludes: ["SpanGrouping"],
    expectedApis: ["SpanGroupingCollection", "SpanGroupingField"],
    acceptableAlternatives: ["SpanSummaryCollection"],
    mustNotReturn: ["RealGrid"],
    notes: "Sample + API",
  },
  {
    id: "q11-how-to-merge-en",
    question: "How to merge cells in rMate Grid using SpanMergingField?",
    type: "기능/API 탐색 (EN)",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection"],
    expectedSourcePathIncludes: ["SpanMergingField"],
    expectedApis: ["SpanMergingField", "mergingFields"],
    acceptableAlternatives: ["SpanArrayCollection"],
    mustNotReturn: ["RealGrid", "Toast"],
    notes: "English merge how-to",
  },
  {
    id: "q12-number-formatter",
    question: "NumberFormatter useThousandsSeparator 기본값",
    type: "속성/옵션 (KO/EN)",
    expectedTitles: ["NumberFormatter"],
    expectedSourcePathIncludes: ["NumberFormatter"],
    expectedApis: ["NumberFormatter", "useThousandsSeparator"],
    acceptableAlternatives: ["PercentFormatter"],
    mustNotReturn: ["RealGrid"],
    notes: "Formatter API",
  },
];

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
    if (!draft) throw new Error("no generation");
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

function titleHit(titles: string[], expected: string[]): boolean {
  const lower = titles.map((t) => t.toLowerCase());
  return expected.some((e) => lower.some((t) => t.includes(e.toLowerCase())));
}

function pathHit(
  contexts: Array<{ metadata?: unknown }>,
  includes: string[] | undefined,
): boolean {
  if (!includes?.length) return false;
  return contexts.some((c) => {
    const meta = c.metadata && typeof c.metadata === "object" ? (c.metadata as Record<string, unknown>) : {};
    const sp = String(meta.sourcePath ?? "");
    return includes.some((inc) => sp.toLowerCase().includes(inc.toLowerCase()));
  });
}

function isRelevant(
  gt: GroundTruth,
  contexts: Array<{ title?: string | null; metadata?: unknown; content?: string | null }>,
  k: number,
): { hit: boolean; rank: number | null } {
  const slice = contexts.slice(0, k);
  const titles = slice.map((c) => c.title ?? "");
  const acceptable = [...gt.expectedTitles, ...gt.acceptableAlternatives];

  for (let i = 0; i < slice.length; i++) {
    const t = (slice[i]?.title ?? "").toLowerCase();
    const content = (slice[i]?.content ?? "").toLowerCase();
    const meta = slice[i]?.metadata && typeof slice[i].metadata === "object"
      ? (slice[i].metadata as Record<string, unknown>)
      : {};
    const sp = String(meta.sourcePath ?? "").toLowerCase();

    const byTitle = acceptable.some((e) => t.includes(e.toLowerCase()));
    const byPath = (gt.expectedSourcePathIncludes ?? []).some((e) => sp.includes(e.toLowerCase()));
    const byApi = gt.expectedApis.some(
      (api) => t.includes(api.toLowerCase()) || content.includes(api.toLowerCase()),
    );
    if (byTitle || byPath || byApi) {
      return { hit: true, rank: i + 1 };
    }
  }

  // soft: expected title family present anywhere in top-k titles
  if (titleHit(titles, acceptable) || pathHit(slice, gt.expectedSourcePathIncludes)) {
    const rank =
      slice.findIndex((c) => {
        const t = (c.title ?? "").toLowerCase();
        return acceptable.some((e) => t.includes(e.toLowerCase()));
      }) + 1;
    return { hit: true, rank: rank > 0 ? rank : null };
  }

  return { hit: false, rank: null };
}

function hasWrongPack(
  contexts: Array<{ knowledgePackId?: string }>,
  packId: string,
): boolean {
  return contexts.some((c) => c.knowledgePackId && c.knowledgePackId !== packId);
}

function hasMustNot(
  contexts: Array<{ title?: string | null; content?: string | null }>,
  mustNot: string[],
): boolean {
  return contexts.some((c) => {
    const blob = `${c.title ?? ""}\n${c.content ?? ""}`.toLowerCase();
    return mustNot.some((m) => blob.includes(m.toLowerCase()));
  });
}

async function runSuite(label: string) {
  const rows = [];
  for (const gt of GROUND_TRUTH) {
    console.log("[p8-eval]", label, gt.id, "...");
    const started = Date.now();
    const result = await executeRetrievalApiRequest({
      knowledgePackId: PACK_ID,
      query: gt.question,
      topK: 5,
      includeMetadata: true,
      retrievalMode: "keyword",
      requestId: `p8-${label}-${gt.id}`,
      serviceChannel: "API",
      executionMode: "PUBLIC",
    });
    const latencyMs = Date.now() - started;
    if (!result.ok) {
      rows.push({
        id: gt.id,
        question: gt.question,
        ok: false,
        error: `${result.code} ${result.message}`,
        latencyMs,
        tokens: tokenizeSearchQuery(gt.question),
      });
      continue;
    }
    const contexts = result.data.contexts ?? [];
    const at1 = isRelevant(gt, contexts, 1);
    const at3 = isRelevant(gt, contexts, 3);
    const at5 = isRelevant(gt, contexts, 5);
    const wrongPack = hasWrongPack(contexts, PACK_ID);
    const mustNot = hasMustNot(contexts, gt.mustNotReturn);
    const firstRank = at5.rank;
    rows.push({
      id: gt.id,
      type: gt.type,
      question: gt.question,
      ok: true,
      latencyMs,
      tokens: tokenizeSearchQuery(gt.question),
      hitAt1: at1.hit,
      hitAt3: at3.hit,
      hitAt5: at5.hit,
      firstHitRank: firstRank,
      reciprocalRank: firstRank ? 1 / firstRank : 0,
      noHit: !at5.hit,
      wrongPack,
      mustNotViolation: mustNot,
      topTitles: contexts.map((c) => c.title),
      topScores: contexts.map((c) => c.score),
      topPaths: contexts.map((c) => {
        const meta = c.metadata && typeof c.metadata === "object" ? (c.metadata as Record<string, unknown>) : {};
        return meta.sourcePath ?? null;
      }),
      matchReasons: contexts.map((c) => c.matchReasons),
    });
  }

  const scored = rows.filter((r) => r.ok);
  const n = scored.length || 1;
  const metrics = {
    label,
    n: scored.length,
    hitAt1: scored.filter((r) => r.hitAt1).length / n,
    hitAt3: scored.filter((r) => r.hitAt3).length / n,
    hitAt5: scored.filter((r) => r.hitAt5).length / n,
    mrr: scored.reduce((s, r) => s + (r.reciprocalRank ?? 0), 0) / n,
    noHit: scored.filter((r) => r.noHit).length,
    wrongPack: scored.filter((r) => r.wrongPack).length,
    mustNotViolations: scored.filter((r) => r.mustNotViolation).length,
  };
  return { metrics, rows };
}

async function analyzeOlap() {
  const result = await executeRetrievalApiRequest({
    knowledgePackId: PACK_ID,
    query: "셀 병합과 관련된 기능이나 API를 찾아줘",
    topK: 10,
    includeMetadata: true,
    retrievalMode: "keyword",
    requestId: `p8-olap-after-${Date.now()}`,
    serviceChannel: "API",
    executionMode: "PUBLIC",
  });
  if (!result.ok) return { error: result.code };
  return {
    tokens: tokenizeSearchQuery("셀 병합과 관련된 기능이나 API를 찾아줘"),
    top: result.data.contexts.map((c, i) => ({
      rank: i + 1,
      title: c.title,
      score: c.score,
      matchReasons: c.matchReasons,
      sourcePath:
        c.metadata && typeof c.metadata === "object"
          ? (c.metadata as Record<string, unknown>).sourcePath
          : null,
      preview: (c.content ?? "").slice(0, 220),
    })),
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { version, production } = await ensurePublished(PACK_ID);
  const scope = await resolvePublicRetrievalGenerationScope(version.id);

  const after = await runSuite("after");
  const olap = await analyzeOlap();

  // MCP channel smoke on representative question
  const mcp = await executeRetrievalApiRequest({
    knowledgePackId: PACK_ID,
    query: GROUND_TRUTH[0]!.question,
    topK: 5,
    includeMetadata: true,
    retrievalMode: "keyword",
    requestId: `p8-mcp-${Date.now()}`,
    serviceChannel: "MCP",
    executionMode: "PUBLIC",
  });

  const report = {
    startedAt: new Date().toISOString(),
    packId: PACK_ID,
    versionId: version.id,
    versionLabel: version.version,
    publishedRevision: production.id,
    publicResolverRevision: scope.searchIndexGenerationId,
    groundTruthCount: GROUND_TRUTH.length,
    groundTruth: GROUND_TRUTH,
    correction: {
      layer: "QUERY",
      change: "tokenizeSearchQuery strips Korean particles/adnominal endings; allow length-1 Hangul",
      file: "src/lib/search-utils.ts",
    },
    metricsAfter: after.metrics,
    rowsAfter: after.rows,
    olapAfter: olap,
    mcpSmoke: mcp.ok
      ? {
          ok: true,
          servedRevision: scope.searchIndexGenerationId,
          titles: mcp.data.contexts.map((c) => c.title),
          latencyMs: mcp.latencyMs,
        }
      : { ok: false, code: mcp.code, message: mcp.message },
    verdictP81:
      after.metrics.wrongPack === 0 &&
      after.metrics.n >= 10 &&
      after.metrics.hitAt5 >= 0.5
        ? "P8.1 RETRIEVAL SEMANTIC QUALITY PASSED"
        : "P8.1 RETRIEVAL SEMANTIC QUALITY NEEDS WORK",
  };

  writeFileSync(path.join(OUT, "p8-eval-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    verdict: report.verdictP81,
    metrics: report.metricsAfter,
    olapTop: Array.isArray((olap as { top?: unknown }).top)
      ? (olap as { top: Array<{ title: string }> }).top.map((t) => t.title)
      : olap,
    mcp: report.mcpSmoke,
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

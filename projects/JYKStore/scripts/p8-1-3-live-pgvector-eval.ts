/**
 * P8.1.3 — Live pgvector production retrieval hardening.
 * Requires Embedding Worker + pgvector (JYKSTORE_REQUIRE_PGVECTOR=true).
 * PASS only when usage.vectorBackend === "pgvector" for hybrid queries.
 *
 * Usage (from projects/JYKStore, worker on :8000):
 *   $env:JYKSTORE_REQUIRE_PGVECTOR="true"
 *   node --import tsx scripts/p8-1-3-live-pgvector-eval.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PackStatus, Prisma, PrismaClient } from "@prisma/client";
import { executeRetrievalApiRequest } from "@/lib/retrieval/retrieval-api-adapter";
import { resolvePublicRetrievalGenerationScope } from "@/lib/retrieval/retrieval-generation-scope";
import { collectRetrievalCandidates } from "@/lib/retrieval/retrieval-candidate-store";
import { retrieveContextsForVersionWithDiagnostics } from "@/lib/retrieval-service";
import { applyHybridVectorRanking } from "@/lib/retrieval/hybrid-ranking-service";
import { scoreRetrievalCandidates } from "@/lib/retrieval/retrieval-score-service";
import { promoteSearchGeneration } from "@/lib/search-generation/search-generation-service";
import { tokenizeSearchQueryDetailed, buildHybridQueryEmbeddingText } from "@/lib/search-utils";
import { embedSearchQuery } from "@/lib/embedding/runtime-query-embedding";
import { buildSearchVectorQuerySql } from "@/lib/search-vector/search-vector-query";
import {
  LEXICAL_CANDIDATE_LIMIT,
  UNION_CANDIDATE_LIMIT,
  VECTOR_CANDIDATE_LIMIT,
  resolveVectorCandidateTopK,
} from "@/lib/retrieval/retrieval-config";

const PACK_ID = process.env.P8_PACK_ID?.trim() || "p431e2ems633k5n";
const OUT = path.join(process.cwd(), "tmp-p8-1-3-e2e");
const prisma = new PrismaClient();

type GroundTruth = {
  id: string;
  suite: "p81" | "paraphrase" | "distractor";
  question: string;
  expectedTitles: string[];
  acceptableAlternatives: string[];
  falsePositiveTitles?: string[];
};

const P81_GT: GroundTruth[] = [
  {
    id: "q01-cell-merge-ko",
    suite: "p81",
    question: "셀 병합과 관련된 기능이나 API를 찾아줘",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection", "SpanArrayCollection"],
    acceptableAlternatives: [
      "Summary MergeJsFunction",
      "Editing SpanSummaryCollection",
      "SpanGrouping Data",
      "SpanCellAttribute",
    ],
  },
  {
    id: "q02-span-merging-field",
    suite: "p81",
    question: "SpanMergingField API",
    expectedTitles: ["SpanMergingField"],
    acceptableAlternatives: ["SpanSummaryCollection"],
  },
  {
    id: "q03-merge-fields-ko",
    suite: "p81",
    question: "DataGrid에서 병합할 필드를 정의하려면?",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection"],
    acceptableAlternatives: ["SpanArrayCollection", "Summary MergeJsFunction"],
  },
  {
    id: "q04-datagrid-en",
    suite: "p81",
    question: "DataGrid properties horizontalScrollPolicy",
    expectedTitles: ["DataGrid", "DataGridColumn"],
    acceptableAlternatives: ["DataGridColumn Properties"],
  },
  {
    id: "q05-itemclick-event",
    suite: "p81",
    question: "itemClick 이벤트는 언제 발생하나요?",
    expectedTitles: ["DataGrid", "itemClick"],
    acceptableAlternatives: ["itemDoubleClick"],
  },
  {
    id: "q06-excel-export",
    suite: "p81",
    question: "Excel export 제목 행을 여러 줄로 넣는 방법",
    expectedTitles: ["DataGrid", "Excel Export TitleFooters"],
    acceptableAlternatives: ["DataGrid"],
  },
  {
    id: "q07-olap-attribute",
    suite: "p81",
    question: "OLAPAttribute displayName 속성은 무엇을 하나요?",
    expectedTitles: ["OLAPAttribute"],
    acceptableAlternatives: ["OLAPDimension", "OLAPLevel"],
  },
  {
    id: "q08-span-vs-olap",
    suite: "p81",
    question: "셀 병합 SpanMergingField와 OLAPAttribute 차이는?",
    expectedTitles: ["SpanMergingField", "OLAPAttribute"],
    acceptableAlternatives: ["SpanSummaryCollection", "OLAPDimension"],
  },
  {
    id: "q09-cell-attribute",
    suite: "p81",
    question: "SpanCellAttribute rowSpan 설정 방법",
    expectedTitles: ["SpanCellAttribute", "SpanArrayCollection"],
    acceptableAlternatives: ["SpanRowAttribute"],
  },
  {
    id: "q10-grouping-sample",
    suite: "p81",
    question: "SpanGroupingCollection으로 그룹핑 합산행 예제",
    expectedTitles: ["SpanGrouping Data", "SpanGroupingField", "SpanGroupingCollection"],
    acceptableAlternatives: ["SpanSummaryCollection"],
  },
  {
    id: "q11-how-to-merge-en",
    suite: "p81",
    question: "How to merge cells in rMate Grid using SpanMergingField?",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection"],
    acceptableAlternatives: ["Summary MergeJsFunction", "SpanArrayCollection"],
  },
  {
    id: "q12-number-formatter",
    suite: "p81",
    question: "NumberFormatter useThousandsSeparator 기본값",
    expectedTitles: ["NumberFormatter"],
    acceptableAlternatives: ["PercentFormatter"],
  },
];

const PARAPHRASE_GT: GroundTruth[] = [
  {
    id: "p01-region-display",
    suite: "paraphrase",
    question: "여러 셀을 하나의 영역처럼 표시하려면?",
    expectedTitles: ["SpanMergingField", "SpanCellAttribute", "SpanArrayCollection"],
    acceptableAlternatives: ["Summary MergeJsFunction", "SpanSummaryCollection"],
  },
  {
    id: "p02-adjacent-combine",
    suite: "paraphrase",
    question: "인접한 칸을 합쳐서 보여주는 기능은?",
    expectedTitles: ["SpanMergingField", "SpanArrayCollection", "SpanCellAttribute"],
    acceptableAlternatives: ["Summary MergeJsFunction", "SpanSummaryCollection"],
  },
  {
    id: "p03-same-value-bundle",
    suite: "paraphrase",
    question: "같은 값 영역을 묶어서 보이게 하려면?",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection", "Summary MergeJsFunction"],
    acceptableAlternatives: ["SpanGroupingField", "SpanArrayCollection"],
  },
  {
    id: "p04-join-fields",
    suite: "paraphrase",
    question: "같은 값이 이어지는 칸들을 하나처럼 보이게 하려면?",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection", "Summary MergeJsFunction"],
    acceptableAlternatives: ["SpanArrayCollection", "SpanCellAttribute"],
  },
  {
    id: "p05-visual-span",
    suite: "paraphrase",
    question: "반복되는 셀을 묶어서 표시하는 기능은?",
    expectedTitles: ["SpanMergingField", "SpanCellAttribute", "SpanArrayCollection"],
    acceptableAlternatives: ["SpanSummaryCollection", "Summary MergeJsFunction"],
  },
  {
    id: "p06-no-merge-word-en",
    suite: "paraphrase",
    question: "연속된 동일 데이터를 화면에서 하나의 영역처럼 표현하고 싶어",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection", "Summary MergeJsFunction"],
    acceptableAlternatives: ["SpanArrayCollection", "SpanCellAttribute"],
  },
  {
    id: "p07-lump",
    suite: "paraphrase",
    question: "같은 내용이 반복되는 행을 합쳐 보이는 방법은?",
    expectedTitles: ["SpanMergingField", "Summary MergeJsFunction", "SpanSummaryCollection"],
    acceptableAlternatives: ["SpanArrayCollection", "SpanCellAttribute"],
  },
  {
    id: "p08-column-join",
    suite: "paraphrase",
    question: "컬럼 값을 기준으로 칸을 이어 주는 방법은?",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection"],
    acceptableAlternatives: ["Summary MergeJsFunction", "SpanArrayCollection"],
  },
  {
    id: "p09-span-collection",
    suite: "paraphrase",
    question: "병합 정보를 담는 배열형 데이터 공급자는?",
    expectedTitles: ["SpanArrayCollection", "SpanXMLListCollection"],
    acceptableAlternatives: ["SpanSummaryCollection", "Summary MergeJsFunction", "SpanMergingField"],
  },
  {
    id: "p10-rowspan-style",
    suite: "paraphrase",
    question: "셀에 줄 수와 스타일을 함께 넣는 속성 객체는?",
    expectedTitles: ["SpanCellAttribute"],
    // Pack sample title for the same cell attribute concept (not a query→API map).
    acceptableAlternatives: ["SpanRowAttribute", "SpanArrayCollection", "Span RowCellAttr"],
  },
];

const DISTRACTOR_GT: GroundTruth[] = [
  {
    id: "d01-olap-not-merge",
    suite: "distractor",
    question: "OLAP 큐브 flat data를 차원 level에 매핑하는 클래스는?",
    expectedTitles: ["OLAPAttribute", "OLAPDimension", "OLAPLevel"],
    acceptableAlternatives: ["OLAPCube", "OLAPHierarchy"],
    falsePositiveTitles: ["SpanMergingField"],
  },
  {
    id: "d02-summary-total",
    suite: "distractor",
    question: "합계 행 Summary Total 샘플은?",
    expectedTitles: ["Summary Total", "SpanSummaryCollection"],
    acceptableAlternatives: ["SpanGroupingSummaryField"],
    falsePositiveTitles: ["OLAPAttribute"],
  },
  {
    id: "d03-grouping",
    suite: "distractor",
    question: "그룹핑 필드 SpanGroupingField 설정은?",
    expectedTitles: ["SpanGroupingField", "SpanGroupingCollection"],
    acceptableAlternatives: ["SpanGrouping Data"],
    falsePositiveTitles: ["OLAPAttribute"],
  },
  {
    id: "d04-span-confusion",
    suite: "distractor",
    question: "Span과 OLAP 중 큐브 계층 attribute는 어느 쪽인가?",
    expectedTitles: ["OLAPAttribute", "OLAPHierarchy", "OLAPDimension"],
    acceptableAlternatives: ["OLAPLevel"],
  },
];

const ALL = [...P81_GT, ...PARAPHRASE_GT, ...DISTRACTOR_GT];

function titleMatch(titles: string[], needles: string[]) {
  const lower = titles.map((t) => t.toLowerCase());
  return needles.some((n) => lower.some((t) => t.includes(n.toLowerCase())));
}

function isRelevant(gt: GroundTruth, titles: string[], k: number) {
  const slice = titles.slice(0, k);
  const acceptable = [...gt.expectedTitles, ...gt.acceptableAlternatives];
  for (let i = 0; i < slice.length; i++) {
    if (acceptable.some((e) => (slice[i] ?? "").toLowerCase().includes(e.toLowerCase()))) {
      return { hit: true, rank: i + 1 };
    }
  }
  return { hit: false, rank: null as number | null };
}

function candidateSource(matchReasons: string[] | undefined): "lexical" | "vector" | "both" | "unknown" {
  const reasons = matchReasons ?? [];
  const hasVector = reasons.some((r) => r.startsWith("vector:"));
  const hasLexical = reasons.some((r) => r.startsWith("query:") || r.startsWith("metadata:"));
  if (hasVector && hasLexical) return "both";
  if (hasVector) return "vector";
  if (hasLexical) return "lexical";
  return "unknown";
}

function falsePositive(gt: GroundTruth, titles: string[]) {
  const fps = gt.falsePositiveTitles ?? [];
  if (!fps.length) return false;
  const top = titles.slice(0, 3);
  if (titleMatch(top, gt.expectedTitles)) return false;
  return titleMatch(top, fps);
}

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
  if (pack.status !== PackStatus.PUBLISHED && pack.status !== PackStatus.VERIFIED) {
    await prisma.knowledgePack.update({
      where: { packId },
      data: { status: PackStatus.PUBLISHED, publishedAt: pack.publishedAt ?? new Date() },
    });
  }
  return { version, production };
}

async function runHybridSuite(items: GroundTruth[], publishedRevision: string) {
  const rows = [];
  for (const gt of items) {
    console.log("[p813]", gt.suite, gt.id);
    const started = Date.now();
    const tokenized = tokenizeSearchQueryDetailed(gt.question);
    const result = await executeRetrievalApiRequest({
      knowledgePackId: PACK_ID,
      query: gt.question,
      topK: 5,
      includeMetadata: true,
      retrievalMode: "hybrid",
      requestId: `p813-${gt.id}-${Date.now()}`,
      serviceChannel: "API",
      executionMode: "PUBLIC",
    });
    const latencyMs = Date.now() - started;
    if (!result.ok) {
      rows.push({
        id: gt.id,
        suite: gt.suite,
        ok: false,
        error: `${result.code} ${result.message}`,
        latencyMs,
        tokenized,
      });
      continue;
    }
    const titles = result.data.contexts.map((c) => c.title ?? "");
    const at1 = isRelevant(gt, titles, 1);
    const at3 = isRelevant(gt, titles, 3);
    const at5 = isRelevant(gt, titles, 5);
    const sources = result.data.contexts.map((c) => candidateSource(c.matchReasons));
    const usage = result.data.usage;
    rows.push({
      id: gt.id,
      suite: gt.suite,
      ok: true,
      latencyMs,
      tokenized,
      hitAt1: at1.hit,
      hitAt3: at3.hit,
      hitAt5: at5.hit,
      firstHitRank: at5.rank,
      reciprocalRank: at5.rank ? 1 / at5.rank : 0,
      noHit: !at5.hit,
      wrongPack: result.data.contexts.some(
        (c) => c.knowledgePackId && c.knowledgePackId !== PACK_ID,
      ),
      falsePositive: falsePositive(gt, titles),
      servedRevision: publishedRevision,
      topTitles: titles,
      scores: result.data.contexts.map((c) => c.score),
      candidateSources: sources,
      matchReasons: result.data.contexts.map((c) => c.matchReasons),
      embeddingProvider: usage?.embeddingProvider ?? null,
      embeddingModel: usage?.embeddingModel ?? null,
      vectorBackend: usage?.vectorBackend ?? null,
      vectorCandidateCount: usage?.vectorCandidateCount ?? null,
      queryEmbeddingLatencyMs: usage?.queryEmbeddingLatencyMs ?? null,
      vectorQueryLatencyMs: usage?.vectorQueryLatencyMs ?? null,
    });
  }

  const scored = rows.filter((r) => r.ok);
  const n = scored.length || 1;
  const bySuite = (suite: string) => scored.filter((r) => r.suite === suite);
  const metricsOf = (subset: typeof scored) => {
    const m = subset.length || 1;
    return {
      n: subset.length,
      hitAt1: subset.filter((r) => r.hitAt1).length / m,
      hitAt3: subset.filter((r) => r.hitAt3).length / m,
      hitAt5: subset.filter((r) => r.hitAt5).length / m,
      mrr: subset.reduce((s, r) => s + (r.reciprocalRank ?? 0), 0) / m,
      noHit: subset.filter((r) => r.noHit).length,
      wrongPack: subset.filter((r) => r.wrongPack).length,
      falsePositive: subset.filter((r) => r.falsePositive).length,
    };
  };

  return {
    all: metricsOf(scored),
    p81: metricsOf(bySuite("p81")),
    paraphrase: metricsOf(bySuite("paraphrase")),
    distractor: metricsOf(bySuite("distractor")),
    rows,
  };
}

/**
 * Core P8.1.2 case: lexical miss + vector hit + hybrid hit for SpanMergingField.
 * Uses a low-overlap paraphrase and verifies candidate sets via live adapters.
 */
async function runVectorOnlyRecovery(input: {
  versionId: string;
  publishedRevision: string;
  indexGenerationId: string;
}) {
  // Low lexical overlap paraphrase: source tokens miss SpanMergingField titles,
  // while live vector + hybrid still recover it (independent vector recall proof).
  const query = "시각적으로 같은 이웃 값을 하나로 묶는 UI 처리는?";
  const expectedTitle = "SpanMergingField";
  const tokenized = tokenizeSearchQueryDetailed(query);

  const lexicalStarted = Date.now();
  const lexicalCollect = await collectRetrievalCandidates({
    versionId: input.versionId,
    filters: {},
    hasFilters: false,
    hasQuery: tokenized.lexicalPrefilterTokens.length > 0,
    queryTokens: tokenized.lexicalPrefilterTokens,
    indexGenerationId: input.indexGenerationId,
    excludeDraftScope: true,
  });
  const lexicalScored = scoreRetrievalCandidates({
    candidates: lexicalCollect.collected,
    // Source-only scoring: synonym expansions must not fake a lexical hit for VOR.
    tokens: tokenized.sourceTokens,
    filters: {},
  });
  const lexicalTitles = lexicalScored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.chunk.title);
  const lexicalHit = lexicalTitles.some((t) =>
    t.toLowerCase().includes(expectedTitle.toLowerCase()),
  );
  const lexicalLatencyMs = Date.now() - lexicalStarted;

  const vectorStarted = Date.now();
  const vectorOnly = await applyHybridVectorRanking({
    scored: [],
    searchQuery: query,
    searchIndexGenerationId: input.publishedRevision,
    versionId: input.versionId,
    filters: {},
    topK: 10,
    indexGenerationId: input.indexGenerationId,
    excludeDraftScope: true,
    tokens: tokenized.scoringTokens,
  });
  const vectorTitles = vectorOnly.scored.slice(0, 10).map((s) => s.chunk.title);
  const vectorHit = vectorTitles.some((t) =>
    t.toLowerCase().includes(expectedTitle.toLowerCase()),
  );
  const vectorLatencyMs = Date.now() - vectorStarted;

  const hybridStarted = Date.now();
  const hybrid = await retrieveContextsForVersionWithDiagnostics({
    packId: PACK_ID,
    versionId: input.versionId,
    query,
    filters: {},
    topK: 5,
    includeMetadata: true,
    retrievalMode: "hybrid",
    requestId: `p812-vor-${Date.now()}`,
    indexGenerationId: input.indexGenerationId,
    excludeDraftScope: true,
    searchIndexGenerationId: input.publishedRevision,
  });
  const hybridTitles = hybrid.response.contexts.map((c) => c.title ?? "");
  const hybridHit = hybridTitles.some((t) =>
    t.toLowerCase().includes(expectedTitle.toLowerCase()),
  );
  const hybridSources = hybrid.response.contexts.map((c) => candidateSource(c.matchReasons));
  const hybridLatencyMs = Date.now() - hybridStarted;

  const pass = !lexicalHit && vectorHit && hybridHit;

  return {
    query,
    expectedTitle,
    tokenized,
    lexicalHit,
    lexicalTitles,
    lexicalLatencyMs,
    vectorHit,
    vectorTitles,
    vectorLatencyMs,
    finalHybridHit: hybridHit,
    hybridTitles,
    hybridSources,
    hybridLatencyMs,
    servedRevision: input.publishedRevision,
    pass,
    classification: pass ? "PASS" : lexicalHit ? "GROUND_TRUTH_OR_LEXICAL_OVERLAP" : !vectorHit ? "VECTOR_SEARCH" : "RANKING",
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

function summarizeLatencies(values: number[]) {
  const sorted = [...values].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted.length ? sorted[sorted.length - 1]! : 0,
  };
}

async function inspectPgvectorPlan(input: {
  searchIndexGenerationId: string;
  provider: string;
  model: string;
  dimension: number;
  modelRevision: string;
}) {
  const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'SearchIndexVector'
    ORDER BY indexname
  `;
  const sivCount = await prisma.searchIndexVector.count({
    where: {
      searchIndexGenerationId: input.searchIndexGenerationId,
      provider: input.provider,
      model: input.model,
    },
  });
  const embCount = await prisma.knowledgeChunkEmbedding.count({
    where: {
      searchIndexGenerationId: input.searchIndexGenerationId,
      provider: input.provider,
      model: input.model,
    },
  });

  const embed = await embedSearchQuery({
    descriptor: {
      provider: input.provider,
      model: input.model,
      modelRevision: input.modelRevision,
      dimension: input.dimension,
    },
    text: buildHybridQueryEmbeddingText("셀 병합과 관련된 기능이나 API를 찾아줘"),
  });
  const sql = buildSearchVectorQuerySql({
    searchIndexGenerationId: input.searchIndexGenerationId,
    provider: input.provider,
    model: input.model,
    queryVector: embed.vector,
    dimension: input.dimension,
    limit: resolveVectorCandidateTopK(5),
  });
  // EXPLAIN ANALYZE on the same SQL the retrieval path builds.
  const explainSql = Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`;
  const planRows = await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>(explainSql);
  const planText = planRows.map((r) => r["QUERY PLAN"]).join("\n");

  return {
    searchIndexVectorCount: sivCount,
    knowledgeChunkEmbeddingCount: embCount,
    indexes,
    explainAnalyze: planText,
    usesIndexScan: /Index Scan|Bitmap Index Scan|Index Only Scan/i.test(planText),
    usesSeqScan: /Seq Scan on "SearchIndexVector"/i.test(planText),
    mentionsHnsw: /hnsw|SearchIndexVector_.*hnsw/i.test(planText) ||
      indexes.some((i) => /hnsw/i.test(i.indexname) || /hnsw/i.test(i.indexdef)),
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  if (!process.env.JYKSTORE_EMBEDDING_WORKER_URL) {
    throw new Error("JYKSTORE_EMBEDDING_WORKER_URL is required for P8.1.3");
  }
  process.env.JYKSTORE_REQUIRE_PGVECTOR = "true";
  delete process.env.JYKSTORE_ALLOW_JSON_VECTOR_FALLBACK;

  const { version, production } = await ensurePublished(PACK_ID);
  const scope = await resolvePublicRetrievalGenerationScope(version.id);
  if (scope.searchIndexGenerationId !== production.id) {
    throw new Error("public resolver revision mismatch");
  }

  const pgvectorPlan = await inspectPgvectorPlan({
    searchIndexGenerationId: production.id,
    provider: production.embeddingProvider,
    model: production.embeddingModel,
    dimension: production.embeddingDimension,
    modelRevision: production.embeddingModelRevision,
  });

  const vectorOnly = await runVectorOnlyRecovery({
    versionId: version.id,
    publishedRevision: production.id,
    indexGenerationId: production.chunkGenerationId,
  });

  const hybrid = await runHybridSuite(ALL, production.id);
  const okRows = hybrid.rows.filter((r) => r.ok);
  const backends = okRows.map((r) => (r as { vectorBackend?: string }).vectorBackend);
  const pgvectorPass =
    backends.length > 0 && backends.every((b) => b === "pgvector");
  const anyJson = backends.some((b) => b === "json_fallback");

  const p81Pass =
    hybrid.p81.hitAt1 >= 0.999 &&
    hybrid.p81.hitAt5 >= 0.999 &&
    hybrid.p81.wrongPack === 0 &&
    hybrid.p81.noHit === 0;
  const paraphrasePass = hybrid.paraphrase.hitAt5 >= 0.8;
  const distractorPass =
    hybrid.distractor.falsePositive === 0 && hybrid.distractor.wrongPack === 0;
  const vorPass = vectorOnly.pass;

  const latency = {
    totalMs: summarizeLatencies(okRows.map((r) => r.latencyMs)),
    queryEmbeddingMs: summarizeLatencies(
      okRows.map((r) => (r as { queryEmbeddingLatencyMs?: number }).queryEmbeddingLatencyMs ?? NaN),
    ),
    vectorQueryMs: summarizeLatencies(
      okRows.map((r) => (r as { vectorQueryLatencyMs?: number }).vectorQueryLatencyMs ?? NaN),
    ),
  };

  let verdict = "P8.1.3 PGVECTOR PRODUCTION RETRIEVAL PASSED";
  if (!pgvectorPass || anyJson || !p81Pass || !paraphrasePass || !distractorPass || !vorPass) {
    verdict = "P8.1.3 HARDENING REQUIRED";
  }

  const report = {
    startedAt: new Date().toISOString(),
    packId: PACK_ID,
    versionId: version.id,
    versionLabel: version.version,
    publishedRevision: production.id,
    publicResolverRevision: scope.searchIndexGenerationId,
    embeddingDescriptor: {
      provider: production.embeddingProvider,
      model: production.embeddingModel,
      revision: production.embeddingModelRevision,
      dimension: production.embeddingDimension,
    },
    candidateLimits: {
      lexical: LEXICAL_CANDIDATE_LIMIT,
      vector: VECTOR_CANDIDATE_LIMIT,
      union: UNION_CANDIDATE_LIMIT,
    },
    requirePgvector: true,
    workerUrlConfigured: Boolean(process.env.JYKSTORE_EMBEDDING_WORKER_URL),
    pgvectorPlan,
    vectorOnlyRecovery: vectorOnly,
    hybrid,
    latency,
    gates: {
      pgvectorPass,
      p81Pass,
      paraphrasePass,
      distractorPass,
      vorPass,
    },
    verdict,
  };

  writeFileSync(path.join(OUT, "p8-1-3-live-pgvector-report.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        verdict,
        gates: report.gates,
        latency,
        pgvector: {
          siv: pgvectorPlan.searchIndexVectorCount,
          emb: pgvectorPlan.knowledgeChunkEmbeddingCount,
          usesIndexScan: pgvectorPlan.usesIndexScan,
          usesSeqScan: pgvectorPlan.usesSeqScan,
          mentionsHnsw: pgvectorPlan.mentionsHnsw,
        },
        p81: hybrid.p81,
        paraphrase: hybrid.paraphrase,
        distractor: hybrid.distractor,
        vectorOnly: {
          lexicalHit: vectorOnly.lexicalHit,
          vectorHit: vectorOnly.vectorHit,
          finalHybridHit: vectorOnly.finalHybridHit,
          pass: vectorOnly.pass,
        },
        sampleBackend: backends.slice(0, 3),
      },
      null,
      2,
    ),
  );

  if (verdict !== "P8.1.3 PGVECTOR PRODUCTION RETRIEVAL PASSED") {
    process.exitCode = 2;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

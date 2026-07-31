/**
 * P8.1.4 — Stage-level hybrid retrieval profiler (warm queries).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { resolvePublicRetrievalGenerationScope } from "@/lib/retrieval/retrieval-generation-scope";
import { collectRetrievalCandidates } from "@/lib/retrieval/retrieval-candidate-store";
import { scoreRetrievalCandidates } from "@/lib/retrieval/retrieval-score-service";
import { applyHybridVectorRanking } from "@/lib/retrieval/hybrid-ranking-service";
import { selectRetrievalCandidatesWithStats } from "@/lib/retrieval/retrieval-response-mapper";
import { tokenizeSearchQueryDetailed } from "@/lib/search-utils";
import { executeRetrievalApiRequest } from "@/lib/retrieval/retrieval-api-adapter";

const PACK_ID = process.env.P8_PACK_ID?.trim() || "p431e2ems633k5n";
const OUT = path.join(process.cwd(), "tmp-p8-1-4-e2e");
const prisma = new PrismaClient();

const PROFILE_QUERIES = [
  { id: "ko-exact", q: "셀 병합과 관련된 기능이나 API를 찾아줘" },
  { id: "en-exact", q: "DataGrid properties horizontalScrollPolicy" },
  { id: "paraphrase", q: "반복되는 셀을 묶어서 표시하는 기능은?" },
  { id: "vor", q: "시각적으로 같은 이웃 값을 하나로 묶는 UI 처리는?" },
  { id: "distractor", q: "OLAP 큐브 flat data를 차원 level에 매핑하는 클래스는?" },
  { id: "long-nl", q: "연속된 동일 데이터를 화면에서 하나의 영역처럼 표현하고 싶어" },
  { id: "api-name", q: "SpanMergingField API" },
  { id: "rowspan", q: "셀에 줄 수와 스타일을 함께 넣는 속성 객체는?" },
];

function pct(xs: number[], p: number) {
  const s = [...xs].filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return 0;
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]!;
}

async function profileOne(versionId: string, indexGenerationId: string, searchIndexGenerationId: string, query: string) {
  const stages: Record<string, number> = {};
  const mark = (name: string, started: number) => {
    stages[name] = Date.now() - started;
  };

  const t0 = Date.now();
  let t = Date.now();
  const tokenized = tokenizeSearchQueryDetailed(query);
  mark("tokenize", t);

  t = Date.now();
  const lexical = await collectRetrievalCandidates({
    versionId,
    filters: {},
    hasFilters: false,
    hasQuery: tokenized.lexicalPrefilterTokens.length > 0,
    queryTokens: tokenized.lexicalPrefilterTokens,
    indexGenerationId,
    excludeDraftScope: true,
  });
  mark("lexicalCollect", t);

  t = Date.now();
  const scored = scoreRetrievalCandidates({
    candidates: lexical.collected,
    tokens: tokenized.scoringTokens,
    filters: {},
  });
  mark("keywordScore", t);

  t = Date.now();
  const hybrid = await applyHybridVectorRanking({
    scored,
    searchQuery: query,
    searchIndexGenerationId,
    versionId,
    filters: {},
    topK: 5,
    indexGenerationId,
    excludeDraftScope: true,
    tokens: tokenized.scoringTokens,
  });
  mark("hybridRanking", t);

  t = Date.now();
  const selected = selectRetrievalCandidatesWithStats({
    scored: hybrid.scored,
    hasFilters: false,
    hasQuery: true,
    topK: 5,
    query,
  });
  mark("rerank", t);

  stages.totalInstrumented = Date.now() - t0;

  const apiStarted = Date.now();
  const api = await executeRetrievalApiRequest({
    knowledgePackId: PACK_ID,
    query,
    topK: 5,
    includeMetadata: true,
    retrievalMode: "hybrid",
    requestId: `p814-prof-${Date.now()}`,
    serviceChannel: "API",
    executionMode: "PUBLIC",
  });
  const apiTotal = Date.now() - apiStarted;

  return {
    stages,
    lexicalCandidates: lexical.collected.length,
    scanned: lexical.scanned,
    hybridCandidates: hybrid.scored.length,
    vectorBackend: hybrid.vectorBackend,
    queryEmbeddingLatencyMs: hybrid.queryEmbeddingLatencyMs,
    vectorQueryLatencyMs: hybrid.vectorQueryLatencyMs,
    vectorCandidateCount: hybrid.vectorCandidateCount,
    rerankIn: hybrid.scored.filter((s) => s.score > 0).length,
    rerankOut: selected.selected.length,
    apiTotalMs: apiTotal,
    apiBackend: api.ok ? api.data.usage.vectorBackend : null,
    apiEmbedMs: api.ok ? api.data.usage.queryEmbeddingLatencyMs : null,
    apiVectorMs: api.ok ? api.data.usage.vectorQueryLatencyMs : null,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  process.env.JYKSTORE_REQUIRE_PGVECTOR = "true";
  delete process.env.JYKSTORE_ALLOW_JSON_VECTOR_FALLBACK;

  const version = await prisma.knowledgePackVersion.findFirst({
    where: { packId: PACK_ID },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!version) throw new Error("no version");
  const scope = await resolvePublicRetrievalGenerationScope(version.id);
  if (!scope.searchIndexGenerationId || !scope.indexGenerationId) {
    throw new Error("no published scope");
  }

  // Warm-up (discard)
  console.log("[p814] warm-up");
  await profileOne(
    version.id,
    scope.indexGenerationId,
    scope.searchIndexGenerationId,
    PROFILE_QUERIES[0]!.q,
  );

  const rows = [];
  for (const item of PROFILE_QUERIES) {
    console.log("[p814] profile", item.id);
    const r = await profileOne(
      version.id,
      scope.indexGenerationId,
      scope.searchIndexGenerationId,
      item.q,
    );
    rows.push({ ...item, ...r });
    console.log(
      JSON.stringify({
        id: item.id,
        stages: r.stages,
        hybridRanking: r.stages.hybridRanking,
        lexical: r.stages.lexicalCollect,
        rerank: r.stages.rerank,
        apiTotal: r.apiTotalMs,
        backend: r.vectorBackend,
        lexN: r.lexicalCandidates,
        hybN: r.hybridCandidates,
      }),
    );
  }

  const apiTotals = rows.map((r) => r.apiTotalMs);
  const hybrid = rows.map((r) => r.stages.hybridRanking);
  const lexical = rows.map((r) => r.stages.lexicalCollect);
  const rerank = rows.map((r) => r.stages.rerank);
  const summary = {
    apiTotal: { p50: pct(apiTotals, 50), p95: pct(apiTotals, 95), max: Math.max(...apiTotals) },
    hybridRanking: { p50: pct(hybrid, 50), p95: pct(hybrid, 95), max: Math.max(...hybrid) },
    lexicalCollect: { p50: pct(lexical, 50), p95: pct(lexical, 95), max: Math.max(...lexical) },
    rerank: { p50: pct(rerank, 50), p95: pct(rerank, 95), max: Math.max(...rerank) },
    embed: {
      p50: pct(rows.map((r) => r.queryEmbeddingLatencyMs ?? 0), 50),
      p95: pct(rows.map((r) => r.queryEmbeddingLatencyMs ?? 0), 95),
    },
    vectorQuery: {
      p50: pct(rows.map((r) => r.vectorQueryLatencyMs ?? 0), 50),
      p95: pct(rows.map((r) => r.vectorQueryLatencyMs ?? 0), 95),
    },
  };

  const report = {
    startedAt: new Date().toISOString(),
    packId: PACK_ID,
    publishedRevision: scope.searchIndexGenerationId,
    rows,
    summary,
  };
  writeFileSync(path.join(OUT, "p8-1-4-profile-before.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ summary }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

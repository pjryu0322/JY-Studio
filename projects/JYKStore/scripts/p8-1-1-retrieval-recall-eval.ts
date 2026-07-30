/**
 * P8.1.1 — recall hardening eval (P8.1 GT regression + paraphrase + distractor).
 * Usage: node --import tsx scripts/p8-1-1-retrieval-recall-eval.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PackStatus, PrismaClient } from "@prisma/client";
import { executeRetrievalApiRequest } from "@/lib/retrieval/retrieval-api-adapter";
import { resolvePublicRetrievalGenerationScope } from "@/lib/retrieval/retrieval-generation-scope";
import { promoteSearchGeneration } from "@/lib/search-generation/search-generation-service";
import { tokenizeSearchQueryDetailed } from "@/lib/search-utils";

const PACK_ID = process.env.P8_PACK_ID?.trim() || "p431e2ems633k5n";
const OUT = path.join(process.cwd(), "tmp-p8-1-1-e2e");
const prisma = new PrismaClient();

type GroundTruth = {
  id: string;
  suite: "p81" | "paraphrase" | "distractor";
  question: string;
  expectedTitles: string[];
  acceptableAlternatives: string[];
  mustNotReturn: string[];
  /** For distractors: titles that would be false positives if ranked too high for wrong concept */
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
    mustNotReturn: ["RealGrid", "Toast UI"],
  },
  {
    id: "q02-span-merging-field",
    suite: "p81",
    question: "SpanMergingField API",
    expectedTitles: ["SpanMergingField"],
    acceptableAlternatives: ["SpanSummaryCollection"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "q03-merge-fields-ko",
    suite: "p81",
    question: "DataGrid에서 병합할 필드를 정의하려면?",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection"],
    acceptableAlternatives: ["SpanArrayCollection", "Summary MergeJsFunction"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "q04-datagrid-en",
    suite: "p81",
    question: "DataGrid properties horizontalScrollPolicy",
    expectedTitles: ["DataGrid", "DataGridColumn"],
    acceptableAlternatives: ["DataGridColumn Properties"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "q05-itemclick-event",
    suite: "p81",
    question: "itemClick 이벤트는 언제 발생하나요?",
    expectedTitles: ["DataGrid", "itemClick"],
    acceptableAlternatives: ["itemDoubleClick"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "q06-excel-export",
    suite: "p81",
    question: "Excel export 제목 행을 여러 줄로 넣는 방법",
    expectedTitles: ["DataGrid", "Excel Export TitleFooters"],
    acceptableAlternatives: ["DataGrid"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "q07-olap-attribute",
    suite: "p81",
    question: "OLAPAttribute displayName 속성은 무엇을 하나요?",
    expectedTitles: ["OLAPAttribute"],
    acceptableAlternatives: ["OLAPDimension", "OLAPLevel"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "q08-span-vs-olap",
    suite: "p81",
    question: "셀 병합 SpanMergingField와 OLAPAttribute 차이는?",
    expectedTitles: ["SpanMergingField", "OLAPAttribute"],
    acceptableAlternatives: ["SpanSummaryCollection", "OLAPDimension"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "q09-cell-attribute",
    suite: "p81",
    question: "SpanCellAttribute rowSpan 설정 방법",
    expectedTitles: ["SpanCellAttribute", "SpanArrayCollection"],
    acceptableAlternatives: ["SpanRowAttribute"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "q10-grouping-sample",
    suite: "p81",
    question: "SpanGroupingCollection으로 그룹핑 합산행 예제",
    expectedTitles: ["SpanGrouping Data", "SpanGroupingField", "SpanGroupingCollection"],
    acceptableAlternatives: ["SpanSummaryCollection"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "q11-how-to-merge-en",
    suite: "p81",
    question: "How to merge cells in rMate Grid using SpanMergingField?",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection"],
    acceptableAlternatives: ["Summary MergeJsFunction", "SpanArrayCollection"],
    mustNotReturn: ["RealGrid", "Toast"],
  },
  {
    id: "q12-number-formatter",
    suite: "p81",
    question: "NumberFormatter useThousandsSeparator 기본값",
    expectedTitles: ["NumberFormatter"],
    acceptableAlternatives: ["PercentFormatter"],
    mustNotReturn: ["RealGrid"],
  },
];

const PARAPHRASE_GT: GroundTruth[] = [
  {
    id: "p01-region-display",
    suite: "paraphrase",
    question: "여러 셀을 하나의 영역처럼 표시하려면?",
    expectedTitles: ["SpanMergingField", "SpanCellAttribute", "SpanArrayCollection"],
    acceptableAlternatives: ["Summary MergeJsFunction", "SpanSummaryCollection"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "p02-adjacent-combine",
    suite: "paraphrase",
    question: "인접한 칸을 합쳐서 보여주는 기능은?",
    expectedTitles: ["SpanMergingField", "SpanArrayCollection", "SpanCellAttribute"],
    acceptableAlternatives: ["Summary MergeJsFunction"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "p03-same-value-bundle",
    suite: "paraphrase",
    question: "같은 값 영역을 묶어서 보이게 하려면?",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection", "Summary MergeJsFunction"],
    acceptableAlternatives: ["SpanGroupingField", "SpanArrayCollection"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "p04-join-fields",
    suite: "paraphrase",
    question: "그리드에서 같은 내용의 칸을 이어 붙이려면 어떤 설정을 쓰나?",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection"],
    acceptableAlternatives: ["Summary MergeJsFunction", "SpanArrayCollection"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "p05-visual-span",
    suite: "paraphrase",
    question: "행 방향으로 칸을 이어 보이게 만드는 컴포넌트는?",
    expectedTitles: ["SpanMergingField", "SpanCellAttribute", "SpanArrayCollection"],
    acceptableAlternatives: ["SpanRowAttribute", "SpanSummaryCollection"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "p06-no-merge-word-en",
    suite: "paraphrase",
    question: "How do I make identical values appear as one combined area in the grid?",
    expectedTitles: ["SpanMergingField", "SpanSummaryCollection", "Summary MergeJsFunction"],
    acceptableAlternatives: ["SpanArrayCollection", "SpanCellAttribute"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "p07-lump",
    suite: "paraphrase",
    question: "데이터 값이 같으면 한 덩어리로 보이게 하는 방법은?",
    expectedTitles: ["SpanMergingField", "Summary MergeJsFunction", "SpanSummaryCollection"],
    acceptableAlternatives: ["SpanArrayCollection"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "p08-column-join",
    suite: "paraphrase",
    question: "컬럼 값을 기준으로 칸을 이어 주는 API 이름을 찾아줘",
    expectedTitles: ["SpanMergingField"],
    acceptableAlternatives: ["SpanSummaryCollection", "Summary MergeJsFunction"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "p09-span-collection",
    suite: "paraphrase",
    question: "병합 정보를 담는 배열형 데이터 공급자는?",
    expectedTitles: ["SpanArrayCollection", "SpanXMLListCollection"],
    acceptableAlternatives: ["SpanSummaryCollection"],
    mustNotReturn: ["RealGrid"],
  },
  {
    id: "p10-rowspan-style",
    suite: "paraphrase",
    question: "셀에 줄 수와 스타일을 함께 넣는 속성 객체는?",
    expectedTitles: ["SpanCellAttribute"],
    acceptableAlternatives: ["SpanRowAttribute", "SpanArrayCollection"],
    mustNotReturn: ["RealGrid"],
  },
];

const DISTRACTOR_GT: GroundTruth[] = [
  {
    id: "d01-olap-not-merge",
    suite: "distractor",
    question: "OLAP 큐브 flat data를 차원 level에 매핑하는 클래스는?",
    expectedTitles: ["OLAPAttribute", "OLAPDimension", "OLAPLevel"],
    acceptableAlternatives: ["OLAPCube", "OLAPHierarchy"],
    mustNotReturn: ["RealGrid"],
    falsePositiveTitles: ["SpanMergingField"],
  },
  {
    id: "d02-summary-total",
    suite: "distractor",
    question: "합계 행 Summary Total 샘플은?",
    expectedTitles: ["Summary Total", "SpanSummaryCollection"],
    acceptableAlternatives: ["SpanGroupingSummaryField"],
    mustNotReturn: ["RealGrid"],
    falsePositiveTitles: ["OLAPAttribute"],
  },
  {
    id: "d03-grouping",
    suite: "distractor",
    question: "그룹핑 필드 SpanGroupingField 설정은?",
    expectedTitles: ["SpanGroupingField", "SpanGroupingCollection"],
    acceptableAlternatives: ["SpanGrouping Data"],
    mustNotReturn: ["RealGrid"],
    falsePositiveTitles: ["OLAPAttribute"],
  },
  {
    id: "d04-span-confusion",
    suite: "distractor",
    question: "Span과 OLAP 중 큐브 계층 attribute는 어느 쪽인가?",
    expectedTitles: ["OLAPAttribute", "OLAPHierarchy", "OLAPDimension"],
    acceptableAlternatives: ["OLAPLevel"],
    mustNotReturn: ["RealGrid"],
    falsePositiveTitles: [],
  },
];

const ALL = [...P81_GT, ...PARAPHRASE_GT, ...DISTRACTOR_GT];

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
  return { version, production };
}

function isRelevant(gt: GroundTruth, titles: string[], k: number) {
  const slice = titles.slice(0, k).map((t) => t.toLowerCase());
  const acceptable = [...gt.expectedTitles, ...gt.acceptableAlternatives];
  for (let i = 0; i < slice.length; i++) {
    if (acceptable.some((e) => slice[i]!.includes(e.toLowerCase()))) {
      return { hit: true, rank: i + 1 };
    }
  }
  return { hit: false, rank: null as number | null };
}

function falsePositive(gt: GroundTruth, titles: string[]) {
  const fps = gt.falsePositiveTitles ?? [];
  if (fps.length === 0) return false;
  const top = titles.slice(0, 3).map((t) => t.toLowerCase());
  const expected = gt.expectedTitles.map((e) => e.toLowerCase());
  const hitExpected = top.some((t) => expected.some((e) => t.includes(e)));
  if (hitExpected) return false;
  return top.some((t) => fps.some((f) => t.includes(f.toLowerCase())));
}

async function runSuite(
  label: string,
  items: GroundTruth[],
  mode: "keyword" | "hybrid",
) {
  const rows = [];
  for (const gt of items) {
    console.log("[p811]", label, mode, gt.id);
    const started = Date.now();
    const tokenized = tokenizeSearchQueryDetailed(gt.question);
    const result = await executeRetrievalApiRequest({
      knowledgePackId: PACK_ID,
      query: gt.question,
      topK: 5,
      includeMetadata: true,
      retrievalMode: mode,
      requestId: `p811-${label}-${gt.id}`,
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
    const wrongPack = result.data.contexts.some(
      (c) => c.knowledgePackId && c.knowledgePackId !== PACK_ID,
    );
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
      wrongPack,
      falsePositive: falsePositive(gt, titles),
      topTitles: titles,
      scores: result.data.contexts.map((c) => c.score),
      matchReasons: result.data.contexts.map((c) => c.matchReasons),
    });
  }

  const scored = rows.filter((r) => r.ok);
  const n = scored.length || 1;
  return {
    label,
    mode,
    n: scored.length,
    hitAt1: scored.filter((r) => r.hitAt1).length / n,
    hitAt3: scored.filter((r) => r.hitAt3).length / n,
    hitAt5: scored.filter((r) => r.hitAt5).length / n,
    mrr: scored.reduce((s, r) => s + (r.reciprocalRank ?? 0), 0) / n,
    noHit: scored.filter((r) => r.noHit).length,
    wrongPack: scored.filter((r) => r.wrongPack).length,
    falsePositive: scored.filter((r) => r.falsePositive).length,
    paraphraseHitAt5:
      scored.filter((r) => r.suite === "paraphrase" && r.hitAt5).length /
      Math.max(1, scored.filter((r) => r.suite === "paraphrase").length),
    rows,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { version, production } = await ensurePublished(PACK_ID);
  const scope = await resolvePublicRetrievalGenerationScope(version.id);

  const keyword = await runSuite("after", ALL, "keyword");

  let hybrid: unknown = null;
  if (process.env.P811_SKIP_HYBRID !== "1") {
    try {
      hybrid = await runSuite("after", ALL, "hybrid");
    } catch (e) {
      hybrid = { error: String(e) };
    }
  } else {
    hybrid = { skipped: true, reason: "P811_SKIP_HYBRID=1" };
  }

  const p81 = keyword.rows.filter((r) => r.suite === "p81" && r.ok);
  const p81n = p81.length || 1;
  const p81Metrics = {
    hitAt1: p81.filter((r) => r.hitAt1).length / p81n,
    hitAt3: p81.filter((r) => r.hitAt3).length / p81n,
    hitAt5: p81.filter((r) => r.hitAt5).length / p81n,
    mrr: p81.reduce((s, r) => s + (r.reciprocalRank ?? 0), 0) / p81n,
    noHit: p81.filter((r) => r.noHit).length,
    wrongPack: p81.filter((r) => r.wrongPack).length,
  };

  const verdict =
    p81Metrics.hitAt5 >= 0.99 &&
    p81Metrics.wrongPack === 0 &&
    keyword.wrongPack === 0 &&
    keyword.falsePositive === 0
      ? "P8.1.1 RETRIEVAL RECALL HARDENING PASSED"
      : "P8.1.1 RETRIEVAL RECALL HARDENING NEEDS WORK";

  const report = {
    packId: PACK_ID,
    versionId: version.id,
    publishedRevision: production.id,
    publicResolverRevision: scope.searchIndexGenerationId,
    counts: {
      p81: P81_GT.length,
      paraphrase: PARAPHRASE_GT.length,
      distractor: DISTRACTOR_GT.length,
    },
    p81Metrics,
    keyword,
    hybrid,
    verdict,
  };
  writeFileSync(path.join(OUT, "p8-1-1-eval-report.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        verdict,
        p81Metrics,
        keywordSummary: {
          hitAt1: keyword.hitAt1,
          hitAt5: keyword.hitAt5,
          mrr: keyword.mrr,
          paraphraseHitAt5: keyword.paraphraseHitAt5,
          falsePositive: keyword.falsePositive,
          wrongPack: keyword.wrongPack,
          noHit: keyword.noHit,
        },
        hybridOk: hybrid && !("error" in hybrid),
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
  .finally(() => prisma.$disconnect());

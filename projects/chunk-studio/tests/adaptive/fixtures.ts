import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DocumentFamilyResolverInput } from "../../src/lib/chunking/adaptive/documentFamilyResolver";
import type { StrategyResolverInput } from "../../src/lib/chunking/adaptive/strategyResolver";

interface SeedSignals {
  pageTypeDistribution?: Record<string, number>;
  headingDensity?: number;
  tableDensity?: number;
  formLikeScore?: number;
  clausePatternScore?: number;
  textDensity?: number;
  bulletDensity?: number;
}

export interface SeedCase {
  seedId: string;
  documentFamilyId: string;
  documentFamilyName: string;
  title: string;
  signals: SeedSignals;
  expectedStrategyId: string;
  reasoning: string[];
}

export function loadDocumentFamilySeeds(): SeedCase[] {
  const dir = dirname(fileURLToPath(import.meta.url));
  const seedPath = resolve(dir, "../../data/seeds/document-family-seeds.json");
  const raw = readFileSync(seedPath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw) as SeedCase[];
}

function toResolverPageTypeDistribution(raw: Record<string, number> | undefined): {
  cover?: number;
  toc?: number;
  table?: number;
  body?: number;
  revision_or_form?: number;
} {
  if (!raw) return {};
  return {
    cover: raw.cover ?? 0,
    toc: raw.toc ?? 0,
    table: (raw.table ?? 0) + (raw["table-heavy"] ?? 0),
    body: raw.body ?? 0,
    revision_or_form: (raw.form ?? 0) + (raw["revision-history"] ?? 0),
  };
}

export function toDocumentFamilyInput(seed: SeedCase): DocumentFamilyResolverInput {
  const textDensity = seed.signals.textDensity ?? 0;
  const title = seed.title.toLowerCase();
  const reasoning = seed.reasoning.map((r) => r.toLowerCase());
  const hasRequirementHint =
    /제안요청서|rfp|요구사항|requirement/.test(title) ||
    reasoning.some((r) => r.includes("requirement"));
  const hasEvaluationHint =
    /평가|evaluation|score|criteria/.test(title) ||
    reasoning.some((r) => r.includes("evaluation"));
  const hasSectionHint = reasoning.some((r) => r.includes("section"));
  const hasPageLocalHint = reasoning.some((r) => r.includes("page_local"));

  return {
    pageTypeDistribution: toResolverPageTypeDistribution(
      seed.signals.pageTypeDistribution
    ),
    headingDensity: seed.signals.headingDensity ?? 0,
    tableDensity: seed.signals.tableDensity ?? 0,
    formLikeSignals: seed.signals.formLikeScore ?? 0,
    clausePatternRatio: seed.signals.clausePatternScore ?? 0,
    textDensity,
    layoutStructureSignals: {
      bulletDensity: seed.signals.bulletDensity ?? 0,
      numberingStructure: hasSectionHint
        ? Math.max(0.3, seed.signals.clausePatternScore ?? 0)
        : seed.signals.clausePatternScore ?? 0,
      labelValueDensity: seed.signals.formLikeScore ?? 0,
      paragraphContinuity: textDensity,
      pageIndependence: hasPageLocalHint ? 0.8 : 0.2,
    },
    requirementKeywordRatio: hasRequirementHint ? 0.04 : 0,
    evaluationKeywordRatio: hasEvaluationHint ? 0.02 : 0,
  };
}

function dominantPageType(raw: Record<string, number> | undefined): string {
  if (!raw) return "body";
  const entries = Object.entries(raw).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? "body";
}

export function toStrategyInput(seed: SeedCase): StrategyResolverInput {
  return {
    documentFamilyId: seed.documentFamilyId,
    pageType: dominantPageType(seed.signals.pageTypeDistribution),
    layoutProfile: {
      headingDensity: seed.signals.headingDensity ?? 0,
      tableDensity: seed.signals.tableDensity ?? 0,
      formLikeScore: seed.signals.formLikeScore ?? 0,
      clausePatternScore: seed.signals.clausePatternScore ?? 0,
      textDensity: seed.signals.textDensity ?? 0,
      bulletDensity: seed.signals.bulletDensity ?? 0,
    },
  };
}

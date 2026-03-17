export type AdaptivePageType = "cover" | "toc" | "table" | "body" | "revision_or_form";

export interface DocumentFamilyResolverInput {
  pageTypeDistribution?: Partial<Record<AdaptivePageType, number>>;
  headingDensity?: number;
  tableDensity?: number;
  formLikeSignals?: number;
  clausePatternRatio?: number;
  textDensity?: number;
  layoutStructureSignals?: {
    bulletDensity?: number;
    numberingStructure?: number;
    labelValueDensity?: number;
    paragraphContinuity?: number;
    pageIndependence?: number;
  };
  requirementKeywordRatio?: number;
  evaluationKeywordRatio?: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeDistribution(
  pageTypeDistribution?: Partial<Record<AdaptivePageType, number>>
): Record<AdaptivePageType, number> {
  const raw: Record<AdaptivePageType, number> = {
    cover: Math.max(0, pageTypeDistribution?.cover ?? 0),
    toc: Math.max(0, pageTypeDistribution?.toc ?? 0),
    table: Math.max(0, pageTypeDistribution?.table ?? 0),
    body: Math.max(0, pageTypeDistribution?.body ?? 0),
    revision_or_form: Math.max(0, pageTypeDistribution?.revision_or_form ?? 0),
  };
  const total = raw.cover + raw.toc + raw.table + raw.body + raw.revision_or_form;
  if (total <= 0) {
    return { cover: 0, toc: 0, table: 0, body: 1, revision_or_form: 0 };
  }
  return {
    cover: raw.cover / total,
    toc: raw.toc / total,
    table: raw.table / total,
    body: raw.body / total,
    revision_or_form: raw.revision_or_form / total,
  };
}

function confidenceFromScore(top: number, gap: number): number {
  if (top >= 2.4 && gap >= 0.9) return 0.9;
  if (top >= 1.6) return 0.7;
  return 0.5;
}

export function resolveDocumentFamily(input: DocumentFamilyResolverInput): {
  documentFamilyId: string;
  confidence: number;
  reasoning: string[];
} {
  const pageType = normalizeDistribution(input.pageTypeDistribution);
  const headingDensity = clamp01(input.headingDensity ?? 0);
  const tableDensity = clamp01(input.tableDensity ?? 0);
  const formLikeSignals = clamp01(input.formLikeSignals ?? 0);
  const clausePatternRatio = clamp01(input.clausePatternRatio ?? 0);
  const textDensity = clamp01(input.textDensity ?? 0);
  const bulletDensity = clamp01(input.layoutStructureSignals?.bulletDensity ?? 0);
  const numberingStructure = clamp01(
    input.layoutStructureSignals?.numberingStructure ?? 0
  );
  const labelValueDensity = clamp01(input.layoutStructureSignals?.labelValueDensity ?? 0);
  const paragraphContinuity = clamp01(
    input.layoutStructureSignals?.paragraphContinuity ?? 0
  );
  const pageIndependence = clamp01(input.layoutStructureSignals?.pageIndependence ?? 0);
  const requirementKeywordRatio = clamp01(input.requirementKeywordRatio ?? 0);
  const evaluationKeywordRatio = clamp01(input.evaluationKeywordRatio ?? 0);

  const scores: Record<string, number> = {
    "DF-01": 0,
    "DF-03": 0,
    "DF-04": 0,
    "DF-06": 0,
    "DF-07": 0,
    "DF-02": 0,
  };
  const reasons: Record<string, string[]> = {
    "DF-01": [],
    "DF-03": [],
    "DF-04": [],
    "DF-06": [],
    "DF-07": [],
    "DF-02": [],
  };

  const add = (family: string, points: number, reason: string): void => {
    if (points <= 0) return;
    scores[family] += points;
    reasons[family].push(reason);
  };

  // DF-04 (Standard / Guide)
  if (headingDensity >= 0.1) add("DF-04", 0.9, "heading_density_high");
  if (bulletDensity >= 0.15) add("DF-04", 0.8, "bullet_detected");
  if (tableDensity >= 0.08) add("DF-04", 0.7, "table_present");

  // DF-03 (Contract / Regulation)
  if (clausePatternRatio >= 0.02) add("DF-03", 1.2, "clause_pattern_detected");
  if (numberingStructure >= 0.25) add("DF-03", 1.0, "numbering_structure_strong");

  // DF-06 (Form)
  if (formLikeSignals >= 0.45) add("DF-06", 1.0, "form_like_layout_detected");
  if (labelValueDensity >= 0.2) add("DF-06", 0.8, "label_value_structure_detected");
  if (paragraphContinuity < 0.45) add("DF-06", 0.8, "low_paragraph_continuity");
  if (pageType.revision_or_form >= 0.2) {
    add("DF-06", 0.7, "revision_or_form_page_ratio_high");
  }

  // DF-07 (Slide / PPT PDF)
  if (pageIndependence >= 0.45) add("DF-07", 0.9, "page_based_layout_detected");
  if (textDensity <= 0.35) add("DF-07", 0.9, "low_text_density");
  if (textDensity <= 0.35 && pageIndependence >= 0.45) {
    add("DF-07", 1.8, "slide_profile_dominant");
  }
  if (pageType.cover + pageType.toc + pageType.table >= 0.55) {
    add("DF-07", 0.7, "independent_pages_detected");
  }

  // DF-01 (RFP)
  if (headingDensity >= 0.08 && numberingStructure >= 0.2) {
    add("DF-01", 0.8, "section_structure_detected");
  }
  if (requirementKeywordRatio >= 0.02) add("DF-01", 1.0, "requirement_pattern_detected");
  if (evaluationKeywordRatio >= 0.015) add("DF-01", 0.9, "evaluation_keyword_detected");

  const ranking = Object.entries(scores)
    .filter(([family]) => family !== "DF-02")
    .sort((a, b) => b[1] - a[1]);

  const [topFamily = "DF-02", topScore = 0] = ranking[0] ?? [];
  const secondScore = ranking[1]?.[1] ?? 0;
  const gap = Math.max(0, topScore - secondScore);

  if (topScore <= 0) {
    return {
      documentFamilyId: "DF-02",
      confidence: 0.5,
      reasoning: ["fallback_report"],
    };
  }

  return {
    documentFamilyId: topFamily,
    confidence: confidenceFromScore(topScore, gap),
    reasoning: reasons[topFamily].length > 0 ? reasons[topFamily] : ["fallback_report"],
  };
}

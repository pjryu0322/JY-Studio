export interface StrategyResolverInput {
  documentFamilyId: string;
  pageType: string;
  pageSubtype?: string;
  layoutProfile?: {
    headingDensity?: number;
    tableDensity?: number;
    formLikeScore?: number;
    clausePatternScore?: number;
    textDensity?: number;
    bulletDensity?: number;
  };
}

export interface StrategyResolverResult {
  strategyId: string;
  config: {
    preserveHeading: boolean;
    preserveClauseBoundary: boolean;
    mergeShortParagraphs: boolean;
    splitLongBlocks: boolean;
    separateTables: boolean;
    preferPageLocalChunk: boolean;
    removeHeaderFooterNoise: boolean;
    minTokens: number;
    maxTokens: number;
    allowCrossPageMerge: boolean;
  };
  reasoning: string[];
}

const STRATEGY_CONFIGS: Record< string, StrategyResolverResult["config"] > = {
  heading_paragraph_hybrid: {
    preserveHeading: true,
    preserveClauseBoundary: false,
    mergeShortParagraphs: true,
    splitLongBlocks: true,
    separateTables: true,
    preferPageLocalChunk: false,
    removeHeaderFooterNoise: true,
    minTokens: 60,
    maxTokens: 450,
    allowCrossPageMerge: false,
  },
  section_requirement_hybrid: {
    preserveHeading: true,
    preserveClauseBoundary: false,
    mergeShortParagraphs: false,
    splitLongBlocks: true,
    separateTables: true,
    preferPageLocalChunk: false,
    removeHeaderFooterNoise: true,
    minTokens: 80,
    maxTokens: 500,
    allowCrossPageMerge: false,
  },
  clause_preserving: {
    preserveHeading: true,
    preserveClauseBoundary: true,
    mergeShortParagraphs: false,
    splitLongBlocks: false,
    separateTables: true,
    preferPageLocalChunk: false,
    removeHeaderFooterNoise: true,
    minTokens: 50,
    maxTokens: 500,
    allowCrossPageMerge: false,
  },
  form_block: {
    preserveHeading: false,
    preserveClauseBoundary: false,
    mergeShortParagraphs: false,
    splitLongBlocks: false,
    separateTables: false,
    preferPageLocalChunk: true,
    removeHeaderFooterNoise: true,
    minTokens: 20,
    maxTokens: 250,
    allowCrossPageMerge: false,
  },
  page_block: {
    preserveHeading: false,
    preserveClauseBoundary: false,
    mergeShortParagraphs: false,
    splitLongBlocks: false,
    separateTables: false,
    preferPageLocalChunk: true,
    removeHeaderFooterNoise: true,
    minTokens: 30,
    maxTokens: 400,
    allowCrossPageMerge: false,
  },
  heading_bullet_table_hybrid: {
    preserveHeading: true,
    preserveClauseBoundary: false,
    mergeShortParagraphs: true,
    splitLongBlocks: true,
    separateTables: true,
    preferPageLocalChunk: false,
    removeHeaderFooterNoise: true,
    minTokens: 60,
    maxTokens: 450,
    allowCrossPageMerge: false,
  },
};

function fromStrategy(strategyId: string, reasoning: string[]): StrategyResolverResult {
  return {
    strategyId,
    config: STRATEGY_CONFIGS[strategyId] ?? STRATEGY_CONFIGS.heading_paragraph_hybrid,
    reasoning,
  };
}

export function resolveChunkStrategy(input: StrategyResolverInput): {
  strategyId: string;
  config: {
    preserveHeading: boolean;
    preserveClauseBoundary: boolean;
    mergeShortParagraphs: boolean;
    splitLongBlocks: boolean;
    separateTables: boolean;
    preferPageLocalChunk: boolean;
    removeHeaderFooterNoise: boolean;
    minTokens: number;
    maxTokens: number;
    allowCrossPageMerge: boolean;
  };
  reasoning: string[];
} {
  const family = input.documentFamilyId;
  const pageType = input.pageType.toLowerCase();
  const headingDensity = input.layoutProfile?.headingDensity ?? 0;
  const tableDensity = input.layoutProfile?.tableDensity ?? 0;
  const formLikeScore = input.layoutProfile?.formLikeScore ?? 0;
  const clausePatternScore = input.layoutProfile?.clausePatternScore ?? 0;
  const textDensity = input.layoutProfile?.textDensity ?? 0;
  const bulletDensity = input.layoutProfile?.bulletDensity ?? 0;

  // Page type override (simple and traceable)
  if (pageType === "cover") {
    return fromStrategy("page_block", ["page_type_cover", "page_local_structure"]);
  }
  if (pageType === "form") {
    return fromStrategy("form_block", ["page_type_form", "label_value_structure"]);
  }
  if (pageType === "table-heavy") {
    return fromStrategy("heading_bullet_table_hybrid", [
      "page_type_table_heavy",
      "table_structure_present",
    ]);
  }

  if (family === "DF-01") {
    return fromStrategy("section_requirement_hybrid", [
      "document_family_rfp",
      "requirement_like_structure",
      "section_based_content",
    ]);
  }

  if (family === "DF-03") {
    return fromStrategy("clause_preserving", [
      "document_family_contract",
      clausePatternScore > 0.05 ? "clause_boundary_required" : "clause_pattern_present",
      "numbering_hierarchy_strong",
    ]);
  }

  if (family === "DF-04") {
    return fromStrategy("heading_bullet_table_hybrid", [
      "document_family_guide",
      bulletDensity > 0.1 ? "heading_and_bullet_mix" : "heading_structure_present",
      tableDensity > 0.08 ? "table_structure_present" : "table_structure_light",
    ]);
  }

  if (family === "DF-06") {
    return fromStrategy("form_block", [
      "document_family_form",
      "label_value_structure",
      formLikeScore > 0.3 ? "form_layout_detected" : "form_layout_assumed",
    ]);
  }

  if (family === "DF-07") {
    return fromStrategy("page_block", [
      "document_family_slide",
      "page_local_structure",
      "cross_page_merge_not_preferred",
    ]);
  }

  // Weak-signal fallback
  if (
    headingDensity < 0.04 &&
    tableDensity < 0.03 &&
    formLikeScore < 0.2 &&
    clausePatternScore < 0.02 &&
    bulletDensity < 0.05 &&
    textDensity < 0.2
  ) {
    return fromStrategy("heading_paragraph_hybrid", [
      "fallback_report_strategy",
      "strategy_fallback_used",
    ]);
  }

  return fromStrategy("heading_paragraph_hybrid", [
    "fallback_report_strategy",
    "default_semantic_structure",
  ]);
}

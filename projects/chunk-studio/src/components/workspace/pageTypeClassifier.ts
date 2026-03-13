export type PageType = "cover" | "toc" | "table" | "body" | "revision_or_form";

export interface PageTextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface PageLayoutProfile {
  pageNumber: number;
  textBlockCount: number;
  averageLineLength: number;
  longLineRatio: number;
  shortLineRatio: number;
  numericRatio: number;
  dottedLeaderRatio: number;
  sectionNumberRatio: number;
  largeTextBlockCount: number;
  centerAlignmentRatio: number;
  gridStructureScore: number;
  topMarginTextRatio: number;
  bottomMarginTextRatio: number;
}

export interface PageTypeScores {
  coverScore: number;
  tocScore: number;
  tableScore: number;
  bodyScore: number;
  revisionScore: number;
}

export interface ClassifiedPageResult {
  profile: PageLayoutProfile;
  scores: PageTypeScores;
  pageType: PageType;
}

export function classifyPageType(
  blocks: PageTextBlock[],
  pageNumber: number
): ClassifiedPageResult {
  const profile = buildPageLayoutProfile(blocks, pageNumber);
  const scores = scorePage(profile, blocks);
  const pageType = resolvePageType(scores, profile);
  return { profile, scores, pageType };
}

export function buildPageLayoutProfile(
  blocks: PageTextBlock[],
  pageNumber: number
): PageLayoutProfile {
  if (blocks.length === 0) {
    return {
      pageNumber,
      textBlockCount: 0,
      averageLineLength: 0,
      longLineRatio: 0,
      shortLineRatio: 0,
      numericRatio: 0,
      dottedLeaderRatio: 0,
      sectionNumberRatio: 0,
      largeTextBlockCount: 0,
      centerAlignmentRatio: 0,
      gridStructureScore: 0,
      topMarginTextRatio: 0,
      bottomMarginTextRatio: 0,
    };
  }

  const lines = blocks.map((block) => block.text.trim()).filter(Boolean);
  const lengths = lines.map((line) => line.length);
  const textBlockCount = blocks.length;
  const averageLineLength =
    lengths.reduce((acc, value) => acc + value, 0) / Math.max(1, lengths.length);
  const longLineRatio = lengths.filter((value) => value >= 42).length / Math.max(1, lengths.length);
  const shortLineRatio = lengths.filter((value) => value <= 16).length / Math.max(1, lengths.length);

  const mergedText = lines.join(" ");
  const numericChars = (mergedText.match(/[0-9]/g) ?? []).length;
  const totalChars = Math.max(1, mergedText.replace(/\s+/g, "").length);
  const numericRatio = numericChars / totalChars;

  const dottedLeaderRatio =
    lines.filter((line) => /(\.{3,}\s*\d+$)|(\·{3,}\s*\d+$)/.test(line)).length /
    Math.max(1, lines.length);
  const sectionNumberRatio =
    lines.filter((line) => /^(\d+(\.\d+)*[\)\.]?|\([0-9]+\)|[가-힣A-Z]\.)/.test(line)).length /
    Math.max(1, lines.length);

  const averageArea =
    blocks.reduce((acc, block) => acc + block.width * block.height, 0) / Math.max(1, blocks.length);
  const largeTextBlockCount = blocks.filter((block) => block.width * block.height >= averageArea * 1.8).length;

  const minX = Math.min(...blocks.map((block) => block.x));
  const maxX = Math.max(...blocks.map((block) => block.x + block.width));
  const pageWidth = Math.max(1, maxX - minX);
  const centerX = minX + pageWidth / 2;
  const centerAlignmentRatio =
    blocks.filter((block) => {
      const blockCenter = block.x + block.width / 2;
      return Math.abs(blockCenter - centerX) <= pageWidth * 0.11;
    }).length / Math.max(1, blocks.length);

  const xBuckets = bucketize(blocks.map((block) => block.x), pageWidth * 0.06);
  const yBuckets = bucketize(blocks.map((block) => block.y), Math.max(8, avg(blocks.map((block) => block.height)) * 0.9));
  const gridStructureScore = clamp01(
    (Math.min(1, xBuckets.length / 6) + Math.min(1, yBuckets.length / 12) + shortLineRatio) / 3
  );

  const minY = Math.min(...blocks.map((block) => block.y));
  const maxY = Math.max(...blocks.map((block) => block.y + block.height));
  const pageHeight = Math.max(1, maxY - minY);
  const topMarginTextRatio =
    blocks.filter((block) => block.y <= minY + pageHeight * 0.2).length / Math.max(1, blocks.length);
  const bottomMarginTextRatio =
    blocks.filter((block) => block.y + block.height >= maxY - pageHeight * 0.2).length /
    Math.max(1, blocks.length);

  return {
    pageNumber,
    textBlockCount,
    averageLineLength,
    longLineRatio,
    shortLineRatio,
    numericRatio,
    dottedLeaderRatio,
    sectionNumberRatio,
    largeTextBlockCount,
    centerAlignmentRatio,
    gridStructureScore,
    topMarginTextRatio,
    bottomMarginTextRatio,
  };
}

export function scorePage(profile: PageLayoutProfile, blocks: PageTextBlock[]): PageTypeScores {
  const lines = blocks.map((block) => block.text.trim()).filter(Boolean);
  const normalized = lines.join(" ").toLowerCase();
  const repeatedNumericEndingRatio =
    lines.filter((line) => /\d+$/.test(line)).length / Math.max(1, lines.length);
  const punctuationDensity = (normalized.match(/[.!?]/g) ?? []).length / Math.max(1, normalized.length);
  const datePatternRatio =
    lines.filter((line) => /\b(20\d{2}|19\d{2})[./-]?\d{1,2}[./-]?\d{0,2}\b/.test(line)).length /
    Math.max(1, lines.length);
  const versionPatternRatio =
    lines.filter((line) => /\b(ver|version|개정|revision)\b/i.test(line)).length /
    Math.max(1, lines.length);

  const firstPageCoverPrior = profile.pageNumber === 1 ? 0.12 : 0;
  const firstPageLikelyCoverBoost =
    profile.pageNumber === 1 &&
    profile.textBlockCount <= 52 &&
    profile.centerAlignmentRatio >= 0.3 &&
    profile.longLineRatio <= 0.6
      ? 0.18
      : 0;

  const coverScore = clamp01(
    (profile.textBlockCount <= 30 ? 0.28 : 0) +
      scaleRange(profile.centerAlignmentRatio, 0.45, 0.95, 0.3) +
      scaleRange(profile.largeTextBlockCount, 2, 10, 0.2) +
      scaleRange(1 - profile.gridStructureScore, 0.2, 1, 0.12) +
      scaleRange(1 - profile.longLineRatio, 0.2, 1, 0.1) +
      firstPageCoverPrior +
      firstPageLikelyCoverBoost
  );

  const tocScore = clamp01(
    scaleRange(profile.dottedLeaderRatio, 0.04, 0.6, 0.38) +
      scaleRange(profile.sectionNumberRatio, 0.06, 0.6, 0.22) +
      scaleRange(profile.shortLineRatio, 0.3, 0.9, 0.2) +
      scaleRange(repeatedNumericEndingRatio, 0.2, 0.9, 0.14) +
      (/(목차|table of contents|contents)/i.test(normalized) ? 0.16 : 0)
  );

  const firstPageTablePenalty =
    profile.pageNumber === 1
      ? scaleRange(profile.centerAlignmentRatio, 0.35, 0.95, 0.12) +
        (profile.textBlockCount < 60 ? 0.08 : 0)
      : 0;

  const tableScore = clamp01(
    scaleRange(profile.gridStructureScore, 0.32, 1, 0.34) +
      scaleRange(profile.numericRatio, 0.08, 0.7, 0.22) +
      scaleRange(profile.shortLineRatio, 0.25, 0.9, 0.16) +
      (/(표|table|단위|비고|항목|구분)/i.test(normalized) ? 0.16 : 0) +
      scaleRange(profile.textBlockCount, 40, 260, 0.12) -
      firstPageTablePenalty
  );

  const bodyScore = clamp01(
    scaleRange(profile.longLineRatio, 0.3, 0.95, 0.34) +
      scaleRange(profile.averageLineLength, 20, 90, 0.24) +
      scaleRange(punctuationDensity, 0.012, 0.08, 0.14) +
      scaleRange(1 - profile.gridStructureScore, 0.15, 0.9, 0.1) +
      scaleRange(profile.textBlockCount, 20, 220, 0.12)
  );

  const revisionScore = clamp01(
    scaleRange(profile.shortLineRatio, 0.3, 0.95, 0.22) +
      scaleRange(datePatternRatio, 0.05, 0.5, 0.22) +
      scaleRange(versionPatternRatio, 0.04, 0.45, 0.22) +
      scaleRange(profile.gridStructureScore, 0.2, 0.95, 0.14) +
      scaleRange(profile.numericRatio, 0.04, 0.45, 0.12) +
      (/(revision|version|개정|승인|검토|작성|이력|form)/i.test(normalized) ? 0.14 : 0)
  );

  return {
    coverScore,
    tocScore,
    tableScore,
    bodyScore,
    revisionScore,
  };
}

function resolvePageType(scores: PageTypeScores, profile: PageLayoutProfile): PageType {
  if (profile.pageNumber === 1) {
    const maxNonCover = Math.max(scores.tocScore, scores.tableScore, scores.bodyScore, scores.revisionScore);
    if (scores.coverScore >= 0.42 && scores.coverScore + 0.06 >= maxNonCover) {
      return "cover";
    }
  }
  const entries: Array<{ type: PageType; score: number }> = [
    { type: "cover", score: scores.coverScore },
    { type: "toc", score: scores.tocScore },
    { type: "table", score: scores.tableScore },
    { type: "body", score: scores.bodyScore },
    { type: "revision_or_form", score: scores.revisionScore },
  ];
  entries.sort((a, b) => b.score - a.score);
  return entries[0]?.type ?? "body";
}

function bucketize(values: number[], tolerance: number): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const buckets: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    if (Math.abs(sorted[i] - buckets[buckets.length - 1]) > tolerance) {
      buckets.push(sorted[i]);
    }
  }
  return buckets;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function scaleRange(value: number, min: number, max: number, weight: number): number {
  if (max <= min) return 0;
  const scaled = (value - min) / (max - min);
  return clamp01(scaled) * weight;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

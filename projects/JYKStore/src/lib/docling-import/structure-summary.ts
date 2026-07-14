import type {
  NormalizedFigure,
  NormalizedSection,
  NormalizedTable,
} from "@/lib/adapters/docling/docling-types";
import { isHeadingTextLabel } from "@/lib/adapters/docling/docling-label-utils";

export type StructureSummary = {
  headingCount: number;
  paragraphCount: number;
  listCount: number;
  tableCount: number;
  contentTableCount: number;
  tocTableCount: number;
  figureCount: number;
  contentFigureCount: number;
  /** Figures classified as UNKNOWN — provider should review. */
  unknownFigureCount: number;
  decorativeFigureCount: number;
  figurePreviewSuccessCount: number;
  figurePreviewFailCount: number;
  captionCount: number;
  readingOrderCount: number;
  /** Backward-compatible total section-like nodes. */
  sectionCount: number;
  warnings: string[];
};

function walkSections(
  sections: NormalizedSection[],
  visit: (section: NormalizedSection) => void,
): void {
  for (const section of sections) {
    visit(section);
    if (Array.isArray(section.children) && section.children.length > 0) {
      walkSections(section.children as NormalizedSection[], visit);
    }
  }
}

function isListLabel(label: string | null | undefined): boolean {
  const l = (label ?? "").toLowerCase();
  return l.includes("list") || l.includes("bullet") || l.includes("ordered");
}

/** True headings only — never group/list shells with a short title. */
export function isHeadingSection(section: NormalizedSection): boolean {
  if (isListLabel(section.label)) return false;
  return isHeadingTextLabel(section.label);
}

export function isBodySection(section: NormalizedSection): boolean {
  if (isHeadingSection(section)) return false;
  if (isListLabel(section.label)) return true;
  return Boolean(section.text?.trim());
}

export function buildStructureSummary(input: {
  sections: NormalizedSection[];
  tables: Array<{ caption?: string | null; data?: unknown }>;
  figures: Array<{ caption?: string | null; classification?: string | null }>;
  readingOrder: unknown[];
}): StructureSummary {
  let headingCount = 0;
  let paragraphCount = 0;
  let listCount = 0;
  let sectionCount = 0;
  const warnings: string[] = [];

  walkSections(input.sections, (section) => {
    sectionCount += 1;
    if (isListLabel(section.label)) {
      listCount += 1;
      // List items with text still count as readable body for emptiness checks downstream;
      // structure summary keeps listCount separate and also increments paragraphCount when text exists.
      if (section.text?.trim()) paragraphCount += 1;
      return;
    }
    if (isHeadingSection(section)) {
      headingCount += 1;
      return;
    }
    if (section.text?.trim()) {
      paragraphCount += 1;
    }
  });

  const tableCount = input.tables.length;
  let contentTableCount = 0;
  let tocTableCount = 0;
  for (const table of input.tables) {
    const data =
      table.data && typeof table.data === "object"
        ? (table.data as { classification?: string })
        : null;
    const c = data?.classification ?? "UNKNOWN";
    if (c === "CONTENT_TABLE" || c === "UNKNOWN") contentTableCount += 1;
    else if (c === "TOC_LAYOUT" || c === "TABLE_INDEX" || c === "FIGURE_INDEX") tocTableCount += 1;
  }
  const figureCount = input.figures.length;
  let contentFigureCount = 0;
  let unknownFigureCount = 0;
  let decorativeFigureCount = 0;
  let figurePreviewSuccessCount = 0;
  let figurePreviewFailCount = 0;
  for (const fig of input.figures) {
    const c = fig.classification ?? "UNKNOWN";
    if (c === "CONTENT_FIGURE") contentFigureCount += 1;
    else if (c === "UNKNOWN") unknownFigureCount += 1;
    else if (c === "COVER_IMAGE" || c === "LOGO" || c === "DECORATIVE" || c === "PAGE_RENDER") {
      decorativeFigureCount += 1;
    }
    if (fig.previewObjectKey?.trim()) figurePreviewSuccessCount += 1;
    else figurePreviewFailCount += 1;
  }
  if (figureCount === 0) {
    figurePreviewFailCount = 0;
  }
  const captionCount =
    input.tables.filter((t) => Boolean(t.caption?.trim())).length +
    input.figures.filter((f) => Boolean(f.caption?.trim())).length;
  const readingOrderCount = input.readingOrder.length;

  if (headingCount === 0) {
    warnings.push("Heading이 없습니다. 문서 구조 품질을 확인하세요.");
  }
  if (paragraphCount === 0) {
    warnings.push("본문 문단이 추출되지 않았습니다.");
  }
  if (paragraphCount > 0 && headingCount > 0 && paragraphCount / Math.max(headingCount, 1) > 40) {
    warnings.push("Paragraph가 Section으로 과다 분류되었을 수 있습니다.");
  }
  if (readingOrderCount === 0 && sectionCount > 0) {
    warnings.push("Reading Order가 비어 있습니다.");
  }
  if (figureCount > 0) {
    const missing = figureCount - input.figures.filter((f) => Boolean(f.caption?.trim())).length;
    if (missing / figureCount >= 0.5) {
      warnings.push("Caption이 없는 Figure 비율이 높습니다.");
    }
  }
  if (tableCount > 0) {
    const missing = tableCount - input.tables.filter((t) => Boolean(t.caption?.trim())).length;
    if (missing / tableCount >= 0.5) {
      warnings.push("Caption이 없는 Table 비율이 높습니다.");
    }
  }

  return {
    headingCount,
    paragraphCount,
    listCount,
    tableCount,
    contentTableCount,
    tocTableCount,
    figureCount,
    contentFigureCount,
    unknownFigureCount,
    decorativeFigureCount,
    figurePreviewSuccessCount,
    figurePreviewFailCount,
    captionCount,
    readingOrderCount,
    sectionCount,
    warnings,
  };
}

export function collectHeadingSamples(
  sections: NormalizedSection[],
  max = 20,
): Array<{ title: string; label: string | null; page: number | null }> {
  const out: Array<{ title: string; label: string | null; page: number | null }> = [];
  walkSections(sections, (section) => {
    if (out.length >= max) return;
    if (!isHeadingSection(section)) return;
    const title = section.title?.trim() || section.text?.trim();
    if (!title) return;
    out.push({
      title,
      label: section.label,
      page: typeof (section as { page?: number }).page === "number"
        ? (section as { page?: number }).page!
        : null,
    });
  });
  return out;
}

export function collectBodySamples(
  sections: NormalizedSection[],
): Array<{ text: string; label: string | null; page: number | null; position: string }> {
  const bodies: Array<{ text: string; label: string | null; page: number | null }> = [];
  walkSections(sections, (section) => {
    if (!isBodySection(section)) return;
    const text = section.text?.trim();
    if (!text) return;
    bodies.push({
      text,
      label: section.label,
      page: typeof (section as { page?: number }).page === "number"
        ? (section as { page?: number }).page!
        : null,
    });
  });
  if (bodies.length === 0) return [];
  const pickIndexes = (count: number, startRatio: number, endRatio: number) => {
    const start = Math.floor(bodies.length * startRatio);
    const end = Math.min(bodies.length, Math.ceil(bodies.length * endRatio));
    const slice = bodies.slice(start, Math.max(start + 1, end));
    return slice.slice(0, count);
  };
  const front = pickIndexes(3, 0, 0.15).map((b) => ({ ...b, position: "앞부분" }));
  const mid = pickIndexes(3, 0.4, 0.6).map((b) => ({ ...b, position: "중간" }));
  const back = pickIndexes(3, 0.85, 1).map((b) => ({ ...b, position: "마지막" }));
  const seen = new Set<string>();
  const merged: Array<{
    text: string;
    label: string | null;
    page: number | null;
    position: string;
  }> = [];
  for (const row of [...front, ...mid, ...back]) {
    const key = row.text.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}

export function collectContentTableSamples(
  tables: NormalizedTable[],
  max = 5,
): NormalizedTable[] {
  const content = tables.filter((table) => {
    const data =
      table.data && typeof table.data === "object"
        ? (table.data as { classification?: string })
        : null;
    const c = data?.classification ?? "CONTENT_TABLE";
    return c === "CONTENT_TABLE" || c === "UNKNOWN";
  });
  return content.slice(0, max);
}

export type FigureSampleCard = {
  id: string;
  title: string;
  caption: string | null;
  altText: string | null;
  page: number | null;
  previewObjectKey: string | null;
  classification: string | null;
  /** True when this card is a review candidate, not a confirmed content figure. */
  isFallbackCandidate?: boolean;
};

function figurePage(fig: NormalizedFigure): number | null {
  if (typeof fig.pageNumber === "number") return fig.pageNumber;
  if (typeof fig.page === "number") return fig.page;
  return null;
}

function figureArea(fig: NormalizedFigure): number {
  const w = typeof fig.width === "number" ? fig.width : 0;
  const h = typeof fig.height === "number" ? fig.height : 0;
  return w > 0 && h > 0 ? w * h : 0;
}

function toFigureSampleCard(
  fig: NormalizedFigure,
  index: number,
  isFallbackCandidate: boolean,
): FigureSampleCard {
  return {
    id: fig.id,
    title: fig.caption?.trim() || `그림 ${index + 1}`,
    caption: fig.caption ?? null,
    altText: fig.altText ?? null,
    page: figurePage(fig),
    previewObjectKey: fig.previewObjectKey ?? null,
    classification: fig.classification ?? null,
    isFallbackCandidate,
  };
}

/**
 * Primary figure samples for Provider review.
 * Prefers CONTENT_FIGURE / UNKNOWN. When every figure was classified decorative,
 * falls back to mid-document DECORATIVE candidates (does not mutate classification).
 */
export function collectFigureSamples(
  figures: NormalizedFigure[],
  max = 5,
): FigureSampleCard[] {
  const content = figures.filter((fig) => {
    const c = fig.classification ?? "CONTENT_FIGURE";
    return c === "CONTENT_FIGURE" || c === "UNKNOWN";
  });
  if (content.length > 0) {
    return content
      .slice(0, max)
      .map((fig, i) => toFigureSampleCard(fig, i, false));
  }

  if (figures.length === 0) return [];

  // Fallback: all figures are COVER/LOGO/DECORATIVE/PAGE_RENDER — surface mid-doc candidates.
  const fallbackMax = Math.min(3, max);
  const candidates = figures
    .filter((fig) => {
      const c = fig.classification ?? "";
      if (c === "LOGO" || c === "COVER_IMAGE" || c === "PAGE_RENDER") return false;
      const page = figurePage(fig);
      if (page != null && page <= 1) return false;
      return c === "DECORATIVE" || c === "";
    })
    .sort((a, b) => {
      const pageA = figurePage(a) ?? 10_000;
      const pageB = figurePage(b) ?? 10_000;
      const midA = pageA >= 2 ? 0 : 1;
      const midB = pageB >= 2 ? 0 : 1;
      if (midA !== midB) return midA - midB;
      const previewA = a.previewObjectKey?.trim() ? 0 : 1;
      const previewB = b.previewObjectKey?.trim() ? 0 : 1;
      if (previewA !== previewB) return previewA - previewB;
      const areaDiff = figureArea(b) - figureArea(a);
      if (areaDiff !== 0) return areaDiff;
      const capA = a.caption?.trim() ? 0 : 1;
      const capB = b.caption?.trim() ? 0 : 1;
      if (capA !== capB) return capA - capB;
      return pageA - pageB;
    });

  // Prefer items with preview; if none have preview, still show mid-doc candidates.
  const withPreview = candidates.filter((f) => f.previewObjectKey?.trim());
  const pool = withPreview.length > 0 ? withPreview : candidates;
  return pool
    .slice(0, fallbackMax)
    .map((fig, i) => toFigureSampleCard(fig, i, true));
}

export function collectAdvancedFigureSamples(
  figures: NormalizedFigure[],
  max = 8,
): NormalizedFigure[] {
  return figures
    .filter((fig) => {
      const c = fig.classification ?? "";
      return c === "COVER_IMAGE" || c === "LOGO" || c === "DECORATIVE" || c === "PAGE_RENDER";
    })
    .slice(0, max);
}

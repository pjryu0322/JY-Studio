import type { NormalizedSection } from "@/lib/adapters/docling/docling-types";

export type StructureSummary = {
  headingCount: number;
  paragraphCount: number;
  listCount: number;
  tableCount: number;
  figureCount: number;
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

function isHeadingLabel(label: string | null | undefined, title: string | null | undefined): boolean {
  const l = (label ?? "").toLowerCase();
  if (
    l.includes("title") ||
    l.includes("heading") ||
    l.includes("section_header") ||
    l.includes("header")
  ) {
    return true;
  }
  // Untitled plain text blocks are paragraphs.
  if (title && title.trim().length > 0 && title.trim().length <= 120 && !l.includes("list")) {
    return Boolean(l) || title.trim().length < 80;
  }
  return false;
}

function isListLabel(label: string | null | undefined): boolean {
  const l = (label ?? "").toLowerCase();
  return l.includes("list") || l.includes("bullet") || l.includes("ordered");
}

export function buildStructureSummary(input: {
  sections: NormalizedSection[];
  tables: Array<{ caption?: string | null }>;
  figures: Array<{ caption?: string | null }>;
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
      return;
    }
    if (isHeadingLabel(section.label, section.title)) {
      headingCount += 1;
      return;
    }
    paragraphCount += 1;
  });

  const tableCount = input.tables.length;
  const figureCount = input.figures.length;
  const captionCount =
    input.tables.filter((t) => Boolean(t.caption?.trim())).length +
    input.figures.filter((f) => Boolean(f.caption?.trim())).length;
  const readingOrderCount = input.readingOrder.length;

  if (headingCount === 0) {
    warnings.push("Heading이 없습니다. 문서 구조 품질을 확인하세요.");
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
    figureCount,
    captionCount,
    readingOrderCount,
    sectionCount,
    warnings,
  };
}

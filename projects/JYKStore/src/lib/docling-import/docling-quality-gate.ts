import type { KnowledgePackFileRole } from "@prisma/client";
import type {
  NormalizedFigure,
  NormalizedReadingOrderItem,
  NormalizedSection,
  NormalizedTable,
} from "@/lib/adapters/docling/docling-types";
import {
  buildStructureSummary,
  isBodySection,
  isHeadingSection,
} from "@/lib/docling-import/structure-summary";

export type QualityIssueSeverity = "blocker" | "warning" | "info";

export type QualityIssue = {
  code: string;
  severity: QualityIssueSeverity;
  message: string;
};

export type DoclingQualityGateResult = {
  ok: boolean;
  blockers: QualityIssue[];
  warnings: QualityIssue[];
  info: QualityIssue[];
  summary: {
    headingCount: number;
    paragraphCount: number;
    tableCount: number;
    figureCount: number;
    readingOrderCount: number;
    title: string | null;
    language: string | null;
  };
};

const DATA_URI_RE = /data:image\/[a-z0-9.+-]+;base64,/i;
const LONG_BASE64_RE = /[A-Za-z0-9+/]{200,}={0,2}/;

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

export function markdownPreviewContainsBinary(markdown: string | null | undefined): boolean {
  if (!markdown) return false;
  return DATA_URI_RE.test(markdown) || LONG_BASE64_RE.test(markdown);
}

export function evaluateNormalizedDocumentQuality(input: {
  title: string | null | undefined;
  language: string | null | undefined;
  sections: NormalizedSection[];
  tables: NormalizedTable[];
  figures: NormalizedFigure[];
  readingOrder: NormalizedReadingOrderItem[];
  files: Array<{
    role: KnowledgePackFileRole | string;
    checksumSha256?: string | null;
  }>;
  markdownPreview?: string | null;
  originMismatch?: boolean;
  hasNormalizedDocument: boolean;
  normalizationErrorCount?: number;
}): DoclingQualityGateResult {
  const blockers: QualityIssue[] = [];
  const warnings: QualityIssue[] = [];
  const info: QualityIssue[] = [];

  const structure = buildStructureSummary({
    sections: input.sections,
    tables: input.tables,
    figures: input.figures,
    readingOrder: input.readingOrder,
  });

  const roles = new Set(input.files.map((f) => f.role));
  if (!roles.has("SOURCE_ORIGINAL") || !roles.has("DOCLING_JSON")) {
    blockers.push({
      code: "REQUIRED_FILES_MISSING",
      severity: "blocker",
      message: "원본문서와 Docling JSON이 모두 필요합니다.",
    });
  }
  for (const file of input.files) {
    if (!file.checksumSha256?.trim()) {
      blockers.push({
        code: "FILE_CHECKSUM_MISSING",
        severity: "blocker",
        message: "파일 무결성(체크섬)이 없습니다.",
      });
      break;
    }
  }

  if (!input.hasNormalizedDocument) {
    blockers.push({
      code: "NORMALIZED_DOCUMENT_MISSING",
      severity: "blocker",
      message: "정규화 문서가 없습니다.",
    });
  }
  if ((input.normalizationErrorCount ?? 0) > 0) {
    blockers.push({
      code: "NORMALIZATION_ERRORS_PRESENT",
      severity: "blocker",
      message: "정규화 오류가 남아 있습니다.",
    });
  }
  if (!input.title?.trim()) {
    blockers.push({
      code: "DOCUMENT_TITLE_MISSING",
      severity: "blocker",
      message: "문서 제목이 없습니다.",
    });
  }

  const tablesWithSourceCells = input.tables.filter((t) => {
    const data = t.data as { sourceHadTableCells?: boolean } | null;
    return Boolean(data?.sourceHadTableCells);
  });
  const tablesMapped = tablesWithSourceCells.filter((t) => {
    const data = t.data as { cellTextCount?: number } | null;
    return (data?.cellTextCount ?? 0) > 0;
  });
  if (tablesWithSourceCells.length > 0 && tablesMapped.length === 0) {
    blockers.push({
      code: "TABLE_CELLS_UNMAPPED",
      severity: "blocker",
      message: "표 셀 데이터가 있으나 하나도 매핑되지 않았습니다.",
    });
  } else {
    const failedPartial = tablesWithSourceCells.filter((t) => {
      const data = t.data as { cellTextCount?: number; hasOnlyCoords?: boolean } | null;
      return data?.hasOnlyCoords || (data?.cellTextCount ?? 0) === 0;
    });
    if (failedPartial.length > 0) {
      warnings.push({
        code: "TABLE_CELL_PARTIAL_FAIL",
        severity: "warning",
        message: "일부 표의 셀 매핑에 실패했습니다.",
      });
    }
  }

  const missingFigurePreview = input.figures.filter((f) => !f.previewObjectKey?.trim());
  if (input.figures.length > 0 && missingFigurePreview.length === input.figures.length) {
    warnings.push({
      code: "FIGURE_PREVIEW_ALL_MISSING",
      severity: "warning",
      message: "그림 미리보기를 생성하지 못했습니다.",
    });
  } else if (missingFigurePreview.length > 0) {
    warnings.push({
      code: "FIGURE_PREVIEW_PARTIAL",
      severity: "warning",
      message: "일부 그림 미리보기 생성에 실패했습니다.",
    });
  }

  const tocTables = input.tables.filter((t) => {
    const data = t.data as { classification?: string } | null;
    return (
      data?.classification === "TOC_LAYOUT" ||
      data?.classification === "TABLE_INDEX" ||
      data?.classification === "FIGURE_INDEX"
    );
  });
  if (tocTables.length > 0) {
    warnings.push({
      code: "TOC_TABLE_RECLASSIFIED",
      severity: "warning",
      message: "목차·색인용 표가 자동으로 재분류되었습니다.",
    });
  }

  const decorativeFigures = input.figures.filter((f) => {
    const c = f.classification ?? "";
    return c === "COVER_IMAGE" || c === "LOGO" || c === "DECORATIVE";
  });
  if (decorativeFigures.length > 0) {
    warnings.push({
      code: "DECORATIVE_FIGURE_EXCLUDED",
      severity: "warning",
      message: "표지·로고·장식 이미지는 기본 그림 샘플에서 제외됩니다.",
    });
  }
  if (structure.paragraphCount === 0) {
    blockers.push({
      code: "NORMALIZED_BODY_EMPTY",
      severity: "blocker",
      message: "본문 텍스트가 추출되지 않았습니다.",
    });
  }
  if (structure.readingOrderCount === 0) {
    blockers.push({
      code: "READING_ORDER_EMPTY",
      severity: "blocker",
      message: "문서 읽기 순서가 생성되지 않았습니다.",
    });
  } else {
    const contentIds = new Set<string>();
    walkSections(input.sections, (s) => contentIds.add(s.id));
    for (const t of input.tables) contentIds.add(t.id);
    for (const f of input.figures) contentIds.add(f.id);
    const orderRefs = input.readingOrder.filter((item) => Boolean(item.ref?.trim()));
    const dangling = orderRefs.filter(
      (item) => item.ref && !contentIds.has(item.ref) && !item.ref.includes("/groups/"),
    );
    const ratio = orderRefs.length > 0 ? dangling.length / orderRefs.length : 0;
    if (ratio > 0.1) {
      blockers.push({
        code: "READING_ORDER_DANGLING",
        severity: "blocker",
        message: "읽기 순서에 존재하지 않는 블록 참조가 과도합니다.",
      });
    } else if (dangling.length > 0) {
      warnings.push({
        code: "READING_ORDER_DANGLING_PARTIAL",
        severity: "warning",
        message: "읽기 순서의 일부 무효 참조를 제외했습니다.",
      });
    }
  }

  if (markdownPreviewContainsBinary(input.markdownPreview)) {
    blockers.push({
      code: "MARKDOWN_BASE64_PRESENT",
      severity: "blocker",
      message: "Markdown 미리보기에 이미지 바이너리(Base64)가 포함되어 있습니다.",
    });
  }

  for (const table of input.tables) {
    const data = table.data as { hasOnlyCoords?: boolean } | null;
    if (data && typeof data === "object" && DATA_URI_RE.test(JSON.stringify(data))) {
      blockers.push({
        code: "TABLE_BINARY_PAYLOAD",
        severity: "blocker",
        message: "표 데이터에 바이너리/Base64가 포함되어 있습니다.",
      });
      break;
    }
  }
  for (const fig of input.figures) {
    if (DATA_URI_RE.test(JSON.stringify(fig))) {
      blockers.push({
        code: "FIGURE_BINARY_PAYLOAD",
        severity: "blocker",
        message: "그림 데이터에 바이너리/Base64가 포함되어 있습니다.",
      });
      break;
    }
  }

  if (input.originMismatch) {
    blockers.push({
      code: "ORIGIN_MISMATCH",
      severity: "blocker",
      message: "Docling Origin과 원본문서가 일치하지 않습니다.",
    });
  }

  if (structure.headingCount === 0) {
    warnings.push({
      code: "HEADINGS_EMPTY",
      severity: "warning",
      message: "목차(Heading)가 추출되지 않았습니다.",
    });
  }

  let structuralHeading = 0;
  walkSections(input.sections, (section) => {
    const label = (section.label ?? "").toLowerCase();
    if (
      (label.includes("group") || label === "list") &&
      section.title &&
      !isHeadingSection(section)
    ) {
      structuralHeading += 1;
    }
  });
  if (structuralHeading > 0) {
    warnings.push({
      code: "STRUCTURAL_HEADINGS",
      severity: "warning",
      message: "실제 제목 대신 group/list 구조가 목차에 포함되어 있습니다.",
    });
  }

  if (structure.tableCount > 0) {
    const missing =
      structure.tableCount - input.tables.filter((t) => Boolean(t.caption?.trim())).length;
    if (missing / structure.tableCount >= 0.5) {
      warnings.push({
        code: "TABLE_CAPTION_SPARSE",
        severity: "warning",
        message: "설명이 없는 표의 비율이 높습니다.",
      });
    }
  }
  if (structure.figureCount > 0) {
    const missing =
      structure.figureCount - input.figures.filter((f) => Boolean(f.caption?.trim())).length;
    if (missing / structure.figureCount >= 0.5) {
      warnings.push({
        code: "FIGURE_CAPTION_SPARSE",
        severity: "warning",
        message: "설명이 없는 그림의 비율이 높습니다.",
      });
    }
  }

  if (!input.language?.trim()) {
    warnings.push({
      code: "LANGUAGE_UNSET",
      severity: "warning",
      message: "문서 언어가 선택되지 않았습니다.",
    });
  }

  const lowCellTables = input.tables.filter((t) => {
    const data = t.data as { cellTextCount?: number; rows?: number } | null;
    return data && (data.rows ?? 0) > 0 && (data.cellTextCount ?? 0) === 0;
  });
  if (input.tables.length > 0 && lowCellTables.length / input.tables.length >= 0.5) {
    warnings.push({
      code: "TABLE_CELL_TEXT_LOW",
      severity: "warning",
      message: "표 내용(셀 텍스트) 해석률이 낮습니다.",
    });
  }

  // Deduplicate blocker codes
  const seen = new Set<string>();
  const uniq = (list: QualityIssue[]) =>
    list.filter((i) => {
      if (seen.has(i.code)) return false;
      seen.add(i.code);
      return true;
    });

  const blockersU = uniq(blockers);
  const warningsU = uniq(warnings);

  return {
    ok: blockersU.length === 0,
    blockers: blockersU,
    warnings: warningsU,
    info,
    summary: {
      headingCount: structure.headingCount,
      paragraphCount: structure.paragraphCount,
      tableCount: structure.tableCount,
      figureCount: structure.figureCount,
      readingOrderCount: structure.readingOrderCount,
      title: input.title?.trim() || null,
      language: input.language?.trim() || null,
    },
  };
}

/** Count body sections (for sample / gate helpers). */
export function countBodyBlocks(sections: NormalizedSection[]): number {
  let n = 0;
  walkSections(sections, (s) => {
    if (isBodySection(s)) n += 1;
  });
  return n;
}

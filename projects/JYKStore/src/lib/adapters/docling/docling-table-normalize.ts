/**
 * Docling 1.10 table_cells → normalized preview structure.
 */

export type NormalizedTableCell = {
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  text: string;
  isColumnHeader?: boolean;
  isRowHeader?: boolean;
  isSectionCell?: boolean;
};

export type TableClassification =
  | "CONTENT_TABLE"
  | "TOC_LAYOUT"
  | "TABLE_INDEX"
  | "FIGURE_INDEX"
  | "DECORATIVE_LAYOUT"
  | "UNKNOWN";

export type NormalizedTableData = {
  rowCount: number;
  columnCount: number;
  cells: NormalizedTableCell[];
  previewRows: string[][];
  cellTextCount: number;
  hasOnlyCoords: boolean;
  /** True when source Docling data included `table_cells` (even if mapping failed). */
  sourceHadTableCells: boolean;
  pageNumber: number | null;
  classification: TableClassification;
  classificationConfidence: number;
  classificationReasons: string[];
  /** @deprecated Prefer rowCount — kept for older UI. */
  rows: number;
  /** @deprecated Prefer columnCount */
  cols: number;
  page: number | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readOffset(cell: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = cell[key];
    if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  }
  return null;
}

function mapTableCell(raw: unknown): NormalizedTableCell | null {
  if (!isPlainObject(raw)) return null;
  const startRow =
    readOffset(raw, ["start_row_offset_idx", "start_row_offset", "row_start", "row"]) ?? 0;
  const endRow =
    readOffset(raw, ["end_row_offset_idx", "end_row_offset", "row_end"]) ?? startRow + 1;
  const startCol =
    readOffset(raw, ["start_col_offset_idx", "start_col_offset", "col_start", "column", "col"]) ??
    0;
  const endCol =
    readOffset(raw, ["end_col_offset_idx", "end_col_offset", "col_end"]) ?? startCol + 1;

  let rowSpan = Math.max(1, endRow - startRow);
  let columnSpan = Math.max(1, endCol - startCol);
  if (
    typeof raw.row_span === "number" &&
    Number.isFinite(raw.row_span) &&
    raw.row_span >= 1
  ) {
    rowSpan = Math.floor(raw.row_span);
  }
  if (
    typeof raw.col_span === "number" &&
    Number.isFinite(raw.col_span) &&
    raw.col_span >= 1
  ) {
    columnSpan = Math.floor(raw.col_span);
  }

  const text =
    typeof raw.text === "string"
      ? raw.text
      : typeof raw.content === "string"
        ? raw.content
        : "";

  return {
    row: Math.max(0, startRow),
    column: Math.max(0, startCol),
    rowSpan,
    columnSpan,
    text,
    isColumnHeader: Boolean(raw.column_header),
    isRowHeader: Boolean(raw.row_header),
    isSectionCell: Boolean(raw.row_section),
  };
}

function buildPreviewFromCells(
  cells: NormalizedTableCell[],
  rowCount: number,
  columnCount: number,
  maxPreviewRows = 5,
): string[][] {
  const grid: string[][] = [];
  const limitRows = Math.min(rowCount, maxPreviewRows);
  for (let r = 0; r < limitRows; r += 1) {
    grid.push(Array.from({ length: columnCount }, () => ""));
  }
  for (const cell of cells) {
    if (cell.row >= limitRows || cell.column >= columnCount) continue;
    const existing = grid[cell.row]![cell.column]!;
    if (!existing || (cell.text.trim() && !existing.trim())) {
      grid[cell.row]![cell.column] = cell.text.trim();
    }
  }
  return grid;
}

function extractFromGridArray(grid: unknown[]): {
  rowCount: number;
  columnCount: number;
  cells: NormalizedTableCell[];
  cellTextCount: number;
  previewRows: string[][];
} {
  const cells: NormalizedTableCell[] = [];
  let columnCount = 0;
  let cellTextCount = 0;
  const previewRows: string[][] = [];
  for (let r = 0; r < grid.length; r += 1) {
    const row = grid[r];
    if (!Array.isArray(row)) continue;
    columnCount = Math.max(columnCount, row.length);
    const preview: string[] = [];
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c];
      let text = "";
      if (typeof cell === "string") text = cell;
      else if (isPlainObject(cell) && typeof cell.text === "string") text = cell.text;
      else if (isPlainObject(cell) && typeof cell.content === "string") text = cell.content;
      if (text.trim()) cellTextCount += 1;
      cells.push({
        row: r,
        column: c,
        rowSpan: 1,
        columnSpan: 1,
        text,
        isColumnHeader: r === 0,
      });
      if (r < 5) preview.push(text.trim());
    }
    if (r < 5) previewRows.push(preview);
  }
  return {
    rowCount: grid.length,
    columnCount,
    cells,
    cellTextCount,
    previewRows,
  };
}

export function normalizeDoclingTableData(
  data: unknown,
  options?: {
    pageNumber?: number | null;
    caption?: string | null;
    nearbyHeading?: string | null;
    tableIndex?: number;
    totalTables?: number;
  },
): NormalizedTableData {
  const empty: NormalizedTableData = {
    rowCount: 0,
    columnCount: 0,
    cells: [],
    previewRows: [],
    cellTextCount: 0,
    hasOnlyCoords: false,
    sourceHadTableCells: false,
    pageNumber: options?.pageNumber ?? null,
    classification: "UNKNOWN",
    classificationConfidence: 0.2,
    classificationReasons: ["empty_or_unreadable"],
    rows: 0,
    cols: 0,
    page: options?.pageNumber ?? null,
  };

  if (!isPlainObject(data) && !Array.isArray(data)) {
    return empty;
  }

  // Prefer Docling 1.10 table_cells
  if (isPlainObject(data) && Array.isArray(data.table_cells)) {
    const cells: NormalizedTableCell[] = [];
    const seen = new Set<string>();
    let warningsSpan = 0;
    for (const raw of data.table_cells) {
      const mapped = mapTableCell(raw);
      if (!mapped) continue;
      if (mapped.rowSpan < 1 || mapped.columnSpan < 1) {
        mapped.rowSpan = 1;
        mapped.columnSpan = 1;
        warningsSpan += 1;
      }
      const key = `${mapped.row}:${mapped.column}`;
      const existing = cells.find((c) => `${c.row}:${c.column}` === key);
      if (existing) {
        if (!existing.text.trim() && mapped.text.trim()) {
          Object.assign(existing, mapped);
        }
        continue;
      }
      if (seen.has(key) && !mapped.text.trim()) continue;
      seen.add(key);
      cells.push(mapped);
    }

    const declaredRows =
      typeof data.num_rows === "number" && Number.isFinite(data.num_rows)
        ? Math.max(0, Math.floor(data.num_rows))
        : 0;
    const declaredCols =
      typeof data.num_cols === "number" && Number.isFinite(data.num_cols)
        ? Math.max(0, Math.floor(data.num_cols))
        : 0;
    const maxRow = cells.reduce((m, c) => Math.max(m, c.row + c.rowSpan), 0);
    const maxCol = cells.reduce((m, c) => Math.max(m, c.column + c.columnSpan), 0);
    const rowCount = Math.max(declaredRows, maxRow);
    const columnCount = Math.max(declaredCols, maxCol);
    const cellTextCount = cells.filter((c) => c.text.trim()).length;
    const previewRows = buildPreviewFromCells(cells, rowCount, columnCount);
    const classification = classifyTable({
      cells,
      rowCount,
      columnCount,
      caption: options?.caption ?? null,
      nearbyHeading: options?.nearbyHeading ?? null,
      pageNumber: options?.pageNumber ?? null,
      tableIndex: options?.tableIndex ?? 0,
      totalTables: options?.totalTables ?? 1,
    });
    return {
      rowCount,
      columnCount,
      cells,
      previewRows,
      cellTextCount,
      hasOnlyCoords: cellTextCount === 0,
      sourceHadTableCells: true,
      pageNumber: options?.pageNumber ?? null,
      classification: classification.classification,
      classificationConfidence: classification.confidence,
      classificationReasons: [
        ...classification.reasons,
        ...(warningsSpan > 0 ? [`span_corrected:${warningsSpan}`] : []),
      ],
      rows: rowCount,
      cols: columnCount,
      page: options?.pageNumber ?? null,
    };
  }

  // Fallback: grid array
  const grid = isPlainObject(data) ? data.grid : data;
  if (Array.isArray(grid)) {
    const fromGrid = extractFromGridArray(grid);
    const classification = classifyTable({
      cells: fromGrid.cells,
      rowCount: fromGrid.rowCount,
      columnCount: fromGrid.columnCount,
      caption: options?.caption ?? null,
      nearbyHeading: options?.nearbyHeading ?? null,
      pageNumber: options?.pageNumber ?? null,
      tableIndex: options?.tableIndex ?? 0,
      totalTables: options?.totalTables ?? 1,
    });
    return {
      rowCount: fromGrid.rowCount,
      columnCount: fromGrid.columnCount,
      cells: fromGrid.cells,
      previewRows: fromGrid.previewRows,
      cellTextCount: fromGrid.cellTextCount,
      hasOnlyCoords:
        fromGrid.cellTextCount === 0 &&
        isPlainObject(data) &&
        /bbox|coord_origin/.test(JSON.stringify(data)),
      sourceHadTableCells: false,
      pageNumber: options?.pageNumber ?? null,
      classification: classification.classification,
      classificationConfidence: classification.confidence,
      classificationReasons: classification.reasons,
      rows: fromGrid.rowCount,
      cols: fromGrid.columnCount,
      page: options?.pageNumber ?? null,
    };
  }

  if (isPlainObject(data)) {
    const json = JSON.stringify(data);
    const hasBbox = /bbox|coord_origin/.test(json);
    const hasText = /"text"\s*:/.test(json);
    return {
      ...empty,
      hasOnlyCoords: hasBbox && !hasText,
      classificationReasons: ["no_table_cells_or_grid"],
    };
  }

  return empty;
}

function scoreDotLeaders(texts: string[]): number {
  if (texts.length === 0) return 0;
  const hit = texts.filter((t) => /[·.\u2022…]{2,}|…|\.{3,}/.test(t)).length;
  return hit / texts.length;
}

function scoreTrailingPageNumbers(texts: string[]): number {
  if (texts.length === 0) return 0;
  const hit = texts.filter((t) => /\s\d{1,4}\s*$/.test(t.trim()) || /^\d{1,4}$/.test(t.trim()))
    .length;
  return hit / texts.length;
}

function looksLikeTitlePagePair(cells: NormalizedTableCell[]): number {
  if (cells.length === 0) return 0;
  const byRow = new Map<number, NormalizedTableCell[]>();
  for (const c of cells) {
    const list = byRow.get(c.row) ?? [];
    list.push(c);
    byRow.set(c.row, list);
  }
  let match = 0;
  for (const row of byRow.values()) {
    if (row.length < 2) continue;
    const sorted = [...row].sort((a, b) => a.column - b.column);
    const last = sorted[sorted.length - 1]!;
    const first = sorted[0]!;
    if (first.text.trim() && /^\d{1,4}$/.test(last.text.trim())) match += 1;
  }
  return match / Math.max(byRow.size, 1);
}

export function classifyTable(input: {
  cells: NormalizedTableCell[];
  rowCount: number;
  columnCount: number;
  caption: string | null;
  nearbyHeading: string | null;
  pageNumber: number | null;
  tableIndex: number;
  totalTables: number;
}): {
  classification: TableClassification;
  confidence: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  const texts = input.cells.map((c) => c.text).filter((t) => t.trim());
  const caption = (input.caption ?? "").trim();
  const heading = (input.nearbyHeading ?? "").trim();
  const ctx = `${caption} ${heading}`;

  let tocScore = 0;
  let contentScore = 0;

  if (/표\s*목차|그림\s*목차|list of (tables|figures)/i.test(ctx)) {
    tocScore += 0.45;
    reasons.push("index_heading_or_caption");
  }
  if (/^목차$|table of contents|^toc$/i.test(ctx) || /목차/.test(heading)) {
    tocScore += 0.4;
    reasons.push("toc_heading");
  }

  const early =
    (input.pageNumber != null && input.pageNumber <= 5) ||
    input.tableIndex <= Math.max(2, Math.floor(input.totalTables * 0.15));
  if (early) {
    tocScore += 0.1;
    reasons.push("early_document_position");
  }

  const dots = scoreDotLeaders(texts);
  if (dots >= 0.35) {
    tocScore += 0.35;
    reasons.push(`dot_leaders:${dots.toFixed(2)}`);
  }
  const pages = scoreTrailingPageNumbers(texts);
  if (pages >= 0.4) {
    tocScore += 0.25;
    reasons.push(`trailing_page_numbers:${pages.toFixed(2)}`);
  }
  const titlePage = looksLikeTitlePagePair(input.cells);
  if (titlePage >= 0.5) {
    tocScore += 0.25;
    reasons.push(`title_page_pair:${titlePage.toFixed(2)}`);
  }

  if (/이력|개정|점검|항목|금액|산정|단가|기준|절차|역할/.test(ctx)) {
    contentScore += 0.5;
    reasons.push("business_caption_keywords");
  }
  if (input.columnCount >= 3 && input.rowCount >= 5 && dots < 0.2) {
    contentScore += 0.25;
    reasons.push("wide_dense_table");
  }
  const numericCells = texts.filter((t) => /\d/.test(t) && !/^\d{1,4}$/.test(t.trim())).length;
  if (texts.length > 0 && numericCells / texts.length >= 0.2) {
    contentScore += 0.15;
    reasons.push("business_numeric_cells");
  }

  if (/그림\s*목차|list of figures/i.test(ctx)) {
    return {
      classification: "FIGURE_INDEX",
      confidence: Math.min(0.95, 0.55 + tocScore * 0.4),
      reasons: [...reasons, "figure_index"],
    };
  }
  if (/표\s*목차|list of tables/i.test(ctx)) {
    return {
      classification: "TABLE_INDEX",
      confidence: Math.min(0.95, 0.55 + tocScore * 0.4),
      reasons: [...reasons, "table_index"],
    };
  }

  if (tocScore >= 0.55 && tocScore > contentScore) {
    return {
      classification: "TOC_LAYOUT",
      confidence: Math.min(0.92, tocScore),
      reasons,
    };
  }
  if (contentScore >= 0.35 && contentScore >= tocScore) {
    return {
      classification: "CONTENT_TABLE",
      confidence: Math.min(0.95, 0.5 + contentScore * 0.4),
      reasons,
    };
  }
  if (input.rowCount <= 2 && input.columnCount <= 2 && texts.length <= 2) {
    return {
      classification: "DECORATIVE_LAYOUT",
      confidence: 0.45,
      reasons: [...reasons, "tiny_layout"],
    };
  }
  if (contentScore > 0.15) {
    return {
      classification: "CONTENT_TABLE",
      confidence: 0.45,
      reasons: [...reasons, "weak_content_bias"],
    };
  }
  return {
    classification: tocScore > 0.25 ? "TOC_LAYOUT" : "UNKNOWN",
    confidence: 0.35,
    reasons: [...reasons, "low_confidence"],
  };
}

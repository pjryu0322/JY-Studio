/**
 * ND section/table/figure helpers → Knowledge Unit draft inputs.
 * Does not change planDoclingBodyKnowledgeUnits algorithm.
 */
import {
  bumpExclusionReason,
  type ExclusionReasonMap,
} from "@/lib/docling-knowledge/docling-knowledge-unit-plan";
import { MAX_UNIT_CHARS, clampTitle } from "@/lib/docling-knowledge/docling-nd-token-split-policy";
import { fixLoneSurrogates, sliceUtf16Safe } from "@/lib/text-encoding-safe";

export type NdSection = {
  id?: string;
  title?: string | null;
  text?: string | null;
  label?: string | null;
  page?: number | null;
  children?: NdSection[];
};

export type NdTableCell = {
  row: number;
  column: number;
  text: string;
  isColumnHeader?: boolean;
};

export type NdTable = {
  id?: string;
  caption?: string | null;
  data?: unknown;
};

export type NdFigure = {
  id?: string;
  caption?: string | null;
  altText?: string | null;
  page?: number | null;
  pageNumber?: number | null;
  classification?: string | null;
  previewObjectKey?: string | null;
};

export type TextSlice = {
  text: string;
  startOffset: number;
  endOffset: number;
};

export type UnitDraft = {
  unitType: string;
  title: string;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  sourceChars: number;
  metadata: Record<string, unknown>;
};

export function asSections(value: unknown): NdSection[] {
  return Array.isArray(value) ? (value as NdSection[]) : [];
}

export function asTables(value: unknown): NdTable[] {
  return Array.isArray(value) ? (value as NdTable[]) : [];
}

export function asFigures(value: unknown): NdFigure[] {
  return Array.isArray(value) ? (value as NdFigure[]) : [];
}

export { clampTitle };

/** Split long section text on structural boundaries before size clamp. */
export function splitSectionIntoUnitTexts(
  text: string,
  maxUnitChars = MAX_UNIT_CHARS,
): TextSlice[] {
  const normalized = fixLoneSurrogates(text.replace(/\r\n/g, "\n").trim());
  if (!normalized) return [];
  if (normalized.length <= maxUnitChars) {
    return [{ text: normalized, startOffset: 0, endOffset: normalized.length }];
  }

  const blocks = normalized
    .split(/\n{2,}|(?=^#{1,6}\s)|(?=^[-*•]\s)|(?=^\d+[.)]\s)|(?=^(주의|경고|참고|Note|Warning|Caution)[:：])/gim)
    .map((b) => (typeof b === "string" ? b.trim() : ""))
    .filter(Boolean);

  const units: TextSlice[] = [];
  let current = "";
  let currentStart = 0;
  let searchFrom = 0;

  const flush = () => {
    const t = current.trim();
    if (t) {
      const start = Math.max(0, normalized.indexOf(t, currentStart));
      const end = start + t.length;
      units.push({ text: t, startOffset: start, endOffset: end });
      searchFrom = end;
    }
    current = "";
  };

  for (const block of blocks) {
    const blockStart = normalized.indexOf(block, searchFrom);
    if (block.length > maxUnitChars) {
      flush();
      let remaining = block;
      let localOffset = blockStart >= 0 ? blockStart : searchFrom;
      while (remaining.length > maxUnitChars) {
        const piece = sliceUtf16Safe(remaining, maxUnitChars).trim();
        if (piece) {
          units.push({
            text: piece,
            startOffset: localOffset,
            endOffset: localOffset + piece.length,
          });
          localOffset += piece.length;
        }
        remaining = remaining.slice(piece.length || maxUnitChars).trim();
      }
      if (remaining) {
        current = remaining;
        currentStart = localOffset;
      }
      searchFrom = localOffset + remaining.length;
      continue;
    }
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length > maxUnitChars) {
      flush();
      current = block;
      currentStart = blockStart >= 0 ? blockStart : searchFrom;
    } else {
      if (!current) currentStart = blockStart >= 0 ? blockStart : searchFrom;
      current = candidate;
    }
  }
  flush();
  return units.length > 0
    ? units
    : [
        {
          text: sliceUtf16Safe(normalized, maxUnitChars),
          startOffset: 0,
          endOffset: Math.min(maxUnitChars, normalized.length),
        },
      ];
}

export function buildGridFromCells(
  cells: NdTableCell[],
  rowCount: number,
  columnCount: number,
): string[][] {
  const grid: string[][] = [];
  for (let r = 0; r < rowCount; r += 1) {
    grid.push(Array.from({ length: columnCount }, () => ""));
  }
  for (const cell of cells) {
    if (cell.row < 0 || cell.row >= rowCount || cell.column < 0 || cell.column >= columnCount) {
      continue;
    }
    const existing = grid[cell.row]![cell.column]!;
    if (!existing || (cell.text.trim() && !existing.trim())) {
      grid[cell.row]![cell.column] = cell.text.trim();
    }
  }
  return grid;
}

/** Extract full table rows (not previewRows). */
export function extractFullTableRows(data: unknown): {
  headers: string[];
  rows: string[][];
  page: number | null;
  sourceChars: number;
} {
  if (!data || typeof data !== "object") {
    return { headers: [], rows: [], page: null, sourceChars: 0 };
  }
  const record = data as {
    cells?: NdTableCell[];
    rowCount?: number;
    columnCount?: number;
    pageNumber?: number | null;
    page?: number | null;
    previewRows?: string[][];
  };

  const page =
    typeof record.pageNumber === "number"
      ? record.pageNumber
      : typeof record.page === "number"
        ? record.page
        : null;

  if (Array.isArray(record.cells) && record.cells.length > 0) {
    const rowCount =
      typeof record.rowCount === "number" && record.rowCount > 0
        ? record.rowCount
        : Math.max(...record.cells.map((c) => c.row)) + 1;
    const columnCount =
      typeof record.columnCount === "number" && record.columnCount > 0
        ? record.columnCount
        : Math.max(...record.cells.map((c) => c.column)) + 1;
    const grid = buildGridFromCells(record.cells, rowCount, columnCount);
    const headerCells = record.cells.filter((c) => c.isColumnHeader);
    let headers: string[] = [];
    if (headerCells.length > 0) {
      const headerRow = Math.min(...headerCells.map((c) => c.row));
      headers = grid[headerRow] ?? [];
      const body = grid.filter((_, i) => i !== headerRow);
      const sourceChars = grid.flat().join("").length;
      return {
        headers,
        rows: body.filter((r) => r.some((c) => c.trim())),
        page,
        sourceChars,
      };
    }
    if (grid.length === 0) return { headers: [], rows: [], page, sourceChars: 0 };
    headers = grid[0] ?? [];
    const body = grid.slice(1);
    return {
      headers,
      rows: body.filter((r) => r.some((c) => c.trim())),
      page,
      sourceChars: grid.flat().join("").length,
    };
  }

  // Fallback: preview only if no cells (degraded source) — still better than empty.
  const preview = Array.isArray(record.previewRows) ? record.previewRows : [];
  if (preview.length === 0) return { headers: [], rows: [], page, sourceChars: 0 };
  const headers = preview[0] ?? [];
  const rows = preview.slice(1);
  return {
    headers,
    rows,
    page,
    sourceChars: preview.flat().join("").length,
  };
}

export function formatTableChunk(caption: string, headers: string[], rows: string[][]): string {
  const headerLine = headers.length > 0 ? headers.join(" | ") : "(헤더 없음)";
  const body = rows.map((r) => r.join(" | ")).join("\n");
  return [`표 캡션: ${caption}`, `컬럼: ${headerLine}`, body].filter(Boolean).join("\n\n");
}

export function bump(map: ExclusionReasonMap, key: string, text = "", charCount?: number) {
  bumpExclusionReason(map, key, text, charCount ?? text.length);
}

import type { TableStruct } from "@/lib/chunking/types";

function splitCells(line: string): string[] {
  if (line.includes("|")) {
    return line
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (line.includes("\t")) {
    return line
      .split("\t")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [line.trim()];
}

export function isTableLikeLine(line: string): boolean {
  const pipeCount = (line.match(/\|/g) ?? []).length;
  if (pipeCount >= 1) return true;
  return line.includes("\t");
}

export function detectTableCaption(line: string): string | null {
  const trimmed = line.trim();
  if (/^(표|도표|table)\s*[\d-]+/i.test(trimmed)) return trimmed;
  return null;
}

export function buildTableStruct(
  tableId: string,
  lines: string[],
  caption?: string
): TableStruct {
  const rows = lines.map((line) => splitCells(line));
  const header = rows[0] && rows[0].length > 1 ? rows[0] : undefined;
  return {
    tableId,
    caption,
    header,
    rows,
    rowsText: rows.map((cells) => cells.join(" | ")),
  };
}


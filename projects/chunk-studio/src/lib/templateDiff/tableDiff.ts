import type { TemplateSchema } from "@/lib/template/schema";

export interface TableDiffItem {
  tableId: string;
  headerLabels: string[];
  addedRows: string[];
  removedRows: string[];
  modifiedRows: Array<{ oldRow: string; newRow: string }>;
}

function collectTableRows(text: string, headers: string[]): string[] {
  if (headers.length === 0) return [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.filter((line) => headers.some((h) => line.includes(h))).slice(0, 120);
}

export function diffTables(
  docA: string,
  docB: string,
  template: TemplateSchema
): TableDiffItem[] {
  return template.tables.map((table) => {
    const oldRows = collectTableRows(docA, table.headerLabels);
    const newRows = collectTableRows(docB, table.headerLabels);
    const oldSet = new Set(oldRows);
    const newSet = new Set(newRows);
    const removedRows = oldRows.filter((row) => !newSet.has(row));
    const addedRows = newRows.filter((row) => !oldSet.has(row));
    const modifiedRows = removedRows
      .slice(0, Math.min(removedRows.length, addedRows.length))
      .map((oldRow, idx) => ({ oldRow, newRow: addedRows[idx] }));
    return {
      tableId: table.id,
      headerLabels: table.headerLabels,
      addedRows,
      removedRows,
      modifiedRows,
    };
  });
}

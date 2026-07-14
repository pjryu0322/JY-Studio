import type { DoclingIssue } from "./docling-errors";
import {
  DOCLING_ADAPTER_TYPE,
  DOCLING_ADAPTER_VERSION,
  DOCLING_SCHEMA_NAME,
  type AdapterFileMeta,
  type DoclingDocument,
  type DoclingPictureItem,
  type DoclingTableItem,
  type DoclingTextItem,
  type NormalizedDocumentDraft,
  type NormalizedFigure,
  type NormalizedReadingOrderItem,
  type NormalizedSection,
  type NormalizedTable,
} from "./docling-types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function refOf(node: unknown): string | null {
  if (typeof node === "string" && node.startsWith("#/")) return node;
  if (!isPlainObject(node)) return null;
  for (const key of ["$ref", "cref", "ref", "self_ref"] as const) {
    const v = node[key];
    if (typeof v === "string" && v.startsWith("#/")) return v;
  }
  return null;
}

export function resolveByRef(
  doc: DoclingDocument,
  ref: string,
): { kind: string; item: Record<string, unknown>; index: number } | null {
  const match = /^#\/([A-Za-z_][\w]*)(?:\/(\d+))?$/.exec(ref);
  if (!match) return null;
  const collection = match[1]!;
  const indexStr = match[2];
  if (collection === "body") {
    return doc.body
      ? { kind: "body", item: doc.body as Record<string, unknown>, index: -1 }
      : null;
  }
  const arr = (doc as Record<string, unknown>)[collection];
  if (!Array.isArray(arr) || indexStr === undefined) return null;
  const index = Number(indexStr);
  const item = arr[index];
  if (!isPlainObject(item)) return null;
  return { kind: collection, item, index };
}

function captionText(doc: DoclingDocument, caption: unknown): string | null {
  if (typeof caption === "string" && caption.trim()) return caption.trim();
  if (Array.isArray(caption)) {
    const parts: string[] = [];
    for (const c of caption) {
      const r = refOf(c);
      if (r) {
        const resolved = resolveByRef(doc, r);
        if (resolved && typeof resolved.item.text === "string") {
          parts.push(String(resolved.item.text));
        }
      } else if (isPlainObject(c) && typeof c.text === "string") {
        parts.push(c.text);
      }
    }
    return parts.length ? parts.join(" ").trim() || null : null;
  }
  if (isPlainObject(caption)) {
    if (typeof caption.text === "string" && caption.text.trim()) return caption.text.trim();
    const r = refOf(caption);
    if (r) {
      const resolved = resolveByRef(doc, r);
      if (resolved && typeof resolved.item.text === "string") {
        return String(resolved.item.text).trim() || null;
      }
    }
  }
  return null;
}

/** Labels that must never be treated as document headings. */
const NON_HEADING_LABELS = new Set([
  "group",
  "list",
  "picture",
  "table",
  "paragraph",
  "text",
  "list_item",
  "code",
  "caption",
  "footnote",
  "formula",
  "checkbox",
  "page_header",
  "page_footer",
]);

const HEADING_LABEL_RE = /^(section_header|title|heading)$|heading|section_header/;

const BODY_LABEL_RE =
  /^(paragraph|text|list_item|code|caption|footnote|formula)$|paragraph|list_item|footnote|formula/;

export function isHeadingTextLabel(label: string | null | undefined): boolean {
  const l = (label ?? "").toLowerCase().trim();
  if (!l || NON_HEADING_LABELS.has(l)) return false;
  if (l.includes("list") || l.includes("group") || l.includes("picture") || l.includes("table")) {
    return false;
  }
  return HEADING_LABEL_RE.test(l) || l.includes("title");
}

export function isBodyTextLabel(label: string | null | undefined): boolean {
  const l = (label ?? "").toLowerCase().trim();
  if (!l) return true;
  if (isHeadingTextLabel(l)) return false;
  if (l.includes("picture") || l.includes("table") || l === "group") return false;
  return BODY_LABEL_RE.test(l) || l.includes("list");
}

function textItemTitle(item: DoclingTextItem): string | null {
  if (typeof item.text !== "string") return null;
  if (!isHeadingTextLabel(typeof item.label === "string" ? item.label : null)) return null;
  return item.text.trim() || null;
}

function findFirstHeading(doc: DoclingDocument): string | null {
  if (!Array.isArray(doc.texts)) return null;
  for (const item of doc.texts) {
    if (!item) continue;
    const title = textItemTitle(item);
    if (title) return title;
  }
  return null;
}

function pageOf(item: Record<string, unknown>): number | null {
  const prov = item.prov;
  if (!Array.isArray(prov) || prov.length === 0) return null;
  const first = prov[0];
  if (!isPlainObject(first)) return null;
  const page = first.page_no ?? first.page;
  return typeof page === "number" ? page : null;
}

function bboxTop(item: Record<string, unknown>): number | null {
  const prov = item.prov;
  if (!Array.isArray(prov) || prov.length === 0) return null;
  const first = prov[0];
  if (!isPlainObject(first) || !isPlainObject(first.bbox)) return null;
  const t = first.bbox.t ?? first.bbox.top;
  return typeof t === "number" ? t : null;
}

/**
 * Build flat sections from real text items — never promote group/list shells to headings.
 */
function buildSections(doc: DoclingDocument): NormalizedSection[] {
  if (!Array.isArray(doc.texts) || doc.texts.length === 0) return [];

  const headingTexts = new Set<string>();
  const sections: NormalizedSection[] = [];

  for (let index = 0; index < doc.texts.length; index += 1) {
    const item = doc.texts[index];
    if (!item || typeof item.text !== "string") continue;
    const text = item.text.trim();
    if (!text) continue;
    const label = typeof item.label === "string" ? item.label : null;
    const labelLower = (label ?? "").toLowerCase().trim();
    // Never turn structural shells into content sections.
    if (labelLower === "group" || labelLower === "list" || labelLower === "picture" || labelLower === "table") {
      continue;
    }
    const id =
      typeof item.self_ref === "string" ? item.self_ref : `#/texts/${index}`;

    if (isHeadingTextLabel(label)) {
      headingTexts.add(text);
      sections.push({
        id,
        title: text,
        level: null,
        text: null,
        label,
        sourceRef: id,
        children: [],
        page: pageOf(item as Record<string, unknown>),
      } as NormalizedSection & { page?: number | null });
      continue;
    }

    if (isBodyTextLabel(label)) {
      // Skip body blocks that exactly duplicate a heading title.
      if (headingTexts.has(text)) continue;
      sections.push({
        id,
        title: null,
        level: null,
        text,
        label: label ?? "paragraph",
        sourceRef: id,
        children: [],
        page: pageOf(item as Record<string, unknown>),
      } as NormalizedSection & { page?: number | null });
    }
  }

  return sections;
}

function extractTableGrid(data: unknown): {
  rows: number;
  cols: number;
  previewRows: string[][];
  cellTextCount: number;
  hasOnlyCoords: boolean;
} {
  const empty = {
    rows: 0,
    cols: 0,
    previewRows: [] as string[][],
    cellTextCount: 0,
    hasOnlyCoords: false,
  };
  if (!isPlainObject(data)) return empty;

  let grid: unknown = data.grid;
  if (!Array.isArray(grid) && Array.isArray(data.table_cells)) {
    // Docling sometimes stores flat cells — treat as no preview grid.
    grid = null;
  }
  if (!Array.isArray(grid)) {
    // Heuristic: only bbox-like payload.
    const json = JSON.stringify(data);
    const hasBbox = /bbox|coord_origin/.test(json);
    const hasText = /"text"\s*:/.test(json);
    return {
      ...empty,
      hasOnlyCoords: hasBbox && !hasText,
    };
  }

  const previewRows: string[][] = [];
  let cols = 0;
  let cellTextCount = 0;
  for (let r = 0; r < grid.length; r += 1) {
    const row = grid[r];
    if (!Array.isArray(row)) continue;
    cols = Math.max(cols, row.length);
    const cells: string[] = [];
    for (const cell of row) {
      let text = "";
      if (typeof cell === "string") text = cell;
      else if (isPlainObject(cell) && typeof cell.text === "string") text = cell.text;
      else if (isPlainObject(cell) && typeof cell.content === "string") text = cell.content;
      if (text.trim()) cellTextCount += 1;
      cells.push(text.trim());
    }
    if (r < 3) previewRows.push(cells);
  }
  const hasOnlyCoords =
    cellTextCount === 0 && /bbox|coord_origin/.test(JSON.stringify(data));
  return {
    rows: grid.length,
    cols,
    previewRows,
    cellTextCount,
    hasOnlyCoords,
  };
}

function buildTables(doc: DoclingDocument): NormalizedTable[] {
  if (!Array.isArray(doc.tables)) return [];
  return doc.tables.map((table: DoclingTableItem, index) => {
    const id =
      typeof table.self_ref === "string" ? table.self_ref : `#/tables/${index}`;
    const gridInfo = extractTableGrid(table.data);
    const page = pageOf(table as Record<string, unknown>);
    return {
      id,
      caption: captionText(doc, table.caption),
      label: typeof table.label === "string" ? table.label : null,
      sourceRef: id,
      data: {
        rows: gridInfo.rows,
        cols: gridInfo.cols,
        previewRows: gridInfo.previewRows,
        cellTextCount: gridInfo.cellTextCount,
        hasOnlyCoords: gridInfo.hasOnlyCoords,
        page,
      },
    };
  });
}

function buildFigures(doc: DoclingDocument): NormalizedFigure[] {
  if (!Array.isArray(doc.pictures)) return [];
  return doc.pictures.map((pic: DoclingPictureItem, index) => {
    const id =
      typeof pic.self_ref === "string" ? pic.self_ref : `#/pictures/${index}`;
    const alt =
      typeof pic.alt_text === "string"
        ? pic.alt_text
        : typeof (pic as Record<string, unknown>).alt === "string"
          ? String((pic as Record<string, unknown>).alt)
          : null;
    return {
      id,
      caption: captionText(doc, pic.caption),
      label: typeof pic.label === "string" ? pic.label : null,
      sourceRef: id,
      altText: alt,
      page: pageOf(pic as Record<string, unknown>),
    } as NormalizedFigure & { altText?: string | null; page?: number | null };
  });
}

function selfRefNumeric(ref: string): number {
  const m = /\/(\d+)$/.exec(ref);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

/**
 * Reading order: recurse body.children / group.children, then page+bbox fallback.
 */
function buildReadingOrder(
  doc: DoclingDocument,
  contentRefs: Set<string>,
): NormalizedReadingOrderItem[] {
  const order: NormalizedReadingOrderItem[] = [];
  const seen = new Set<string>();

  const visitRefs = (children: unknown[] | undefined) => {
    if (!Array.isArray(children)) return;
    for (const child of children) {
      const r = refOf(child);
      if (!r || seen.has(r)) continue;
      const resolved = resolveByRef(doc, r);
      if (resolved?.kind === "groups") {
        seen.add(r);
        const groupChildren = resolved.item.children;
        if (Array.isArray(groupChildren)) visitRefs(groupChildren);
        continue;
      }
      if (resolved?.kind === "body") {
        seen.add(r);
        const bodyChildren = resolved.item.children;
        if (Array.isArray(bodyChildren)) visitRefs(bodyChildren);
        continue;
      }
      seen.add(r);
      order.push({
        index: order.length,
        ref: r,
        kind: resolved?.kind ?? null,
      });
    }
  };

  visitRefs(doc.body?.children as unknown[] | undefined);

  if (order.length > 0) return order;

  // Fallback: page number → bbox top → self_ref numeric.
  const candidates: Array<{
    ref: string;
    kind: string;
    page: number;
    top: number;
    num: number;
  }> = [];

  const pushFrom = (kind: string, arr: unknown[] | undefined) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((raw, index) => {
      if (!isPlainObject(raw)) return;
      const ref =
        typeof raw.self_ref === "string" ? raw.self_ref : `#/${kind}/${index}`;
      if (contentRefs.size > 0 && !contentRefs.has(ref) && kind !== "tables" && kind !== "pictures") {
        // Prefer refs that map to normalized content when available.
      }
      candidates.push({
        ref,
        kind,
        page: pageOf(raw) ?? 10_000,
        top: bboxTop(raw) ?? 10_000,
        num: selfRefNumeric(ref),
      });
    });
  };

  pushFrom("texts", doc.texts as unknown[]);
  pushFrom("tables", doc.tables as unknown[]);
  pushFrom("pictures", doc.pictures as unknown[]);

  candidates.sort((a, b) => a.page - b.page || a.top - b.top || a.num - b.num);
  return candidates.map((c, index) => ({
    index,
    ref: c.ref,
    kind: c.kind,
  }));
}

export function normalizeDoclingDocument(
  doc: DoclingDocument,
  options?: {
    files?: AdapterFileMeta;
    warnings?: DoclingIssue[];
  },
): NormalizedDocumentDraft {
  const named =
    typeof doc.name === "string" && doc.name.trim().length > 0
      ? doc.name.trim()
      : null;
  const title = named ?? findFirstHeading(doc);

  const warnings = [...(options?.warnings ?? [])];
  if (!title) {
    warnings.push({
      code: "DOCLING_SCHEMA_INVALID",
      severity: "WARNING",
      field: "name",
      message: "Could not determine document title from name or headings.",
    });
  }

  const sections = buildSections(doc);
  const tables = buildTables(doc);
  const figures = buildFigures(doc);
  const contentRefs = new Set(sections.map((s) => s.id));
  for (const t of tables) contentRefs.add(t.id);
  for (const f of figures) contentRefs.add(f.id);
  const readingOrder = buildReadingOrder(doc, contentRefs);

  for (const table of tables) {
    const data = table.data as { hasOnlyCoords?: boolean; cellTextCount?: number } | null;
    if (data?.hasOnlyCoords || (data && data.cellTextCount === 0 && (data as { rows?: number }).rows)) {
      warnings.push({
        code: "DOCLING_SCHEMA_INVALID",
        severity: "WARNING",
        field: table.id,
        message: "표 내용 해석 실패",
      });
    }
  }

  return {
    title,
    language: null,
    adapter: {
      type: DOCLING_ADAPTER_TYPE,
      version: DOCLING_ADAPTER_VERSION,
      sourceSchema: DOCLING_SCHEMA_NAME,
      sourceSchemaVersion:
        typeof doc.version === "string" ? doc.version : "unknown",
    },
    files: {
      sourceFileId: options?.files?.sourceFileId ?? null,
      jsonPayloadFileId: options?.files?.jsonPayloadFileId ?? null,
      markdownPayloadFileId: options?.files?.markdownPayloadFileId ?? null,
    },
    sections,
    tables,
    figures,
    readingOrder,
    warnings,
  };
}

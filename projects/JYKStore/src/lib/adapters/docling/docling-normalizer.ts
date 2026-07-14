import type { DoclingIssue } from "./docling-errors";
import {
  classifyFigure,
  extractImageUriFromPicture,
  parseDataUriImage,
} from "./docling-figure-preview";
import { normalizeDoclingTableData } from "./docling-table-normalize";
import { selectNormalizedDocumentTitle } from "./docling-title";
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

const BODY_EXCLUDE_LABELS = new Set([
  "page_header",
  "page_footer",
  "furniture",
  "page_number",
]);

export function isBodyTextLabel(label: string | null | undefined): boolean {
  const l = (label ?? "").toLowerCase().trim();
  if (!l) return true;
  if (isHeadingTextLabel(l)) return false;
  if (BODY_EXCLUDE_LABELS.has(l)) return false;
  if (l.includes("picture") || l.includes("table") || l === "group") return false;
  return BODY_LABEL_RE.test(l) || l.includes("list");
}

function textItemTitle(item: DoclingTextItem): string | null {
  if (typeof item.text !== "string") return null;
  if (!isHeadingTextLabel(typeof item.label === "string" ? item.label : null)) return null;
  return item.text.trim() || null;
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
      if (/^https?:\/\/|^www\./i.test(text)) continue;
      if (/^\d{1,4}$/.test(text)) continue;
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

function nearbyHeadingForPage(
  sections: NormalizedSection[],
  page: number | null,
): string | null {
  if (page == null) {
    const first = sections.find((s) => s.title?.trim());
    return first?.title ?? null;
  }
  let best: string | null = null;
  for (const s of sections) {
    if (!s.title?.trim()) continue;
    if (s.page != null && s.page <= page) best = s.title;
  }
  return best;
}

function buildTables(
  doc: DoclingDocument,
  sections: NormalizedSection[],
): NormalizedTable[] {
  if (!Array.isArray(doc.tables)) return [];
  const total = doc.tables.length;
  return doc.tables.map((table: DoclingTableItem, index) => {
    const id =
      typeof table.self_ref === "string" ? table.self_ref : `#/tables/${index}`;
    const caption = captionText(doc, table.caption);
    const page = pageOf(table as Record<string, unknown>);
    const data = normalizeDoclingTableData(table.data, {
      pageNumber: page,
      caption,
      nearbyHeading: nearbyHeadingForPage(sections, page),
      tableIndex: index,
      totalTables: total,
    });
    return {
      id,
      caption,
      label: typeof table.label === "string" ? table.label : null,
      sourceRef: id,
      data,
    };
  });
}

function buildFigures(doc: DoclingDocument): NormalizedFigure[] {
  if (!Array.isArray(doc.pictures)) return [];
  const hashCounts = new Map<string, number>();
  const figures: NormalizedFigure[] = [];

  for (let index = 0; index < doc.pictures.length; index += 1) {
    const pic = doc.pictures[index] as DoclingPictureItem & Record<string, unknown>;
    if (!pic) continue;
    const id =
      typeof pic.self_ref === "string" ? pic.self_ref : `#/pictures/${index}`;
    const caption = captionText(doc, pic.caption);
    const page = pageOf(pic);
    const alt =
      typeof pic.alt_text === "string"
        ? pic.alt_text
        : typeof pic.alt === "string"
          ? String(pic.alt)
          : null;

    let previewBytes: Uint8Array | undefined;
    let previewSha: string | undefined;
    let mimeType: string | null = null;
    let width: number | null = null;
    let height: number | null = null;

    const uri = extractImageUriFromPicture(pic);
    if (uri) {
      const parsed = parseDataUriImage(uri);
      if (!("error" in parsed)) {
        previewBytes = parsed.bytes;
        previewSha = parsed.sha256;
        mimeType = parsed.mimeType;
        width = parsed.width;
        height = parsed.height;
        hashCounts.set(parsed.sha256, (hashCounts.get(parsed.sha256) ?? 0) + 1);
      }
    }

    figures.push({
      id,
      caption,
      label: typeof pic.label === "string" ? pic.label : null,
      sourceRef: id,
      altText: alt,
      page,
      pageNumber: page,
      width,
      height,
      mimeType,
      previewObjectKey: null,
      _previewBytes: previewBytes,
      _previewSha256: previewSha,
      classification: "UNKNOWN",
      classificationConfidence: 0.3,
      classificationReasons: [],
    });
  }

  return figures.map((fig, pictureIndex) => {
    const dup = fig._previewSha256 ? (hashCounts.get(fig._previewSha256) ?? 1) : 1;
    const classified = classifyFigure({
      pageNumber: fig.pageNumber ?? fig.page ?? null,
      caption: fig.caption,
      width: fig.width ?? null,
      height: fig.height ?? null,
      sha256: fig._previewSha256 ?? null,
      duplicateCount: dup,
      pictureIndex,
    });
    return {
      ...fig,
      classification: classified.classification,
      classificationConfidence: classified.confidence,
      classificationReasons: classified.reasons,
    };
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
    markdownText?: string | null;
    extractedPictureImages?: Array<{
      selfRef: string;
      mimeType: string;
      bytes: Uint8Array;
      sha256: string;
      width: number | null;
      height: number | null;
    }>;
  },
): NormalizedDocumentDraft {
  const warnings = [...(options?.warnings ?? [])];
  const headingCandidates: string[] = [];
  if (Array.isArray(doc.texts)) {
    for (const item of doc.texts) {
      if (!item) continue;
      const t = textItemTitle(item);
      if (t) headingCandidates.push(t);
    }
  }
  const selected = selectNormalizedDocumentTitle({
    headingCandidates,
    originFilename: doc.origin?.filename ?? null,
    jsonName: typeof doc.name === "string" ? doc.name : null,
    markdownText: options?.markdownText ?? null,
  });
  const title = selected.title;
  if (!title) {
    warnings.push({
      code: "DOCLING_SCHEMA_INVALID",
      severity: "WARNING",
      field: "name",
      message: "Could not determine document title from name or headings.",
    });
  } else if (selected.source === "filename") {
    warnings.push({
      code: "DOCLING_SCHEMA_INVALID",
      severity: "WARNING",
      field: "name",
      message: "파일명 기반 제목 fallback을 사용했습니다.",
    });
  }

  const sections = buildSections(doc);
  const tables = buildTables(doc, sections);
  let figures = buildFigures(doc);
  if (options?.extractedPictureImages?.length) {
    const byRef = new Map(options.extractedPictureImages.map((e) => [e.selfRef, e]));
    figures = figures.map((fig) => {
      const hit = byRef.get(fig.id) ?? byRef.get(fig.sourceRef ?? "");
      if (!hit) return fig;
      return {
        ...fig,
        mimeType: hit.mimeType,
        width: hit.width,
        height: hit.height,
        _previewBytes: hit.bytes,
        _previewSha256: hit.sha256,
      };
    });
  }
  const contentRefs = new Set(sections.map((s) => s.id));
  for (const t of tables) contentRefs.add(t.id);
  for (const f of figures) contentRefs.add(f.id);
  const readingOrder = buildReadingOrder(doc, contentRefs);

  let tablesWithCells = 0;
  let tablesMapped = 0;
  for (const table of tables) {
    const data = table.data as {
      hasOnlyCoords?: boolean;
      cellTextCount?: number;
      rowCount?: number;
      rows?: number;
    } | null;
    const rowCount = data?.rowCount ?? data?.rows ?? 0;
    if (rowCount > 0) tablesWithCells += 1;
    if ((data?.cellTextCount ?? 0) > 0) tablesMapped += 1;
    if (data?.hasOnlyCoords || (data && (data.cellTextCount ?? 0) === 0 && rowCount > 0)) {
      warnings.push({
        code: "DOCLING_SCHEMA_INVALID",
        severity: "WARNING",
        field: table.id,
        message: "표 내용 해석 실패",
      });
    }
  }
  if (tablesWithCells > 0 && tablesMapped === 0) {
    warnings.push({
      code: "DOCLING_SCHEMA_INVALID",
      severity: "WARNING",
      field: "tables",
      message: "전체 표 cell 매핑에 실패했습니다.",
    });
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

import type { DoclingIssue } from "./docling-errors";
import {
  DOCLING_ADAPTER_TYPE,
  DOCLING_ADAPTER_VERSION,
  DOCLING_SCHEMA_NAME,
  type AdapterFileMeta,
  type DoclingDocument,
  type DoclingGroupItem,
  type DoclingPictureItem,
  type DoclingRef,
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

function captionText(caption: unknown): string | null {
  if (typeof caption === "string" && caption.trim()) return caption.trim();
  if (Array.isArray(caption)) {
    const parts: string[] = [];
    for (const c of caption) {
      const r = refOf(c);
      if (r) parts.push(r);
      else if (isPlainObject(c) && typeof c.text === "string") parts.push(c.text);
    }
    return parts.length ? parts.join(" ") : null;
  }
  if (isPlainObject(caption)) {
    if (typeof caption.text === "string") return caption.text;
    const r = refOf(caption);
    return r;
  }
  return null;
}

function resolveByRef(
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

function textItemTitle(item: DoclingTextItem): string | null {
  if (typeof item.text !== "string") return null;
  const label = typeof item.label === "string" ? item.label.toLowerCase() : "";
  if (
    label.includes("title") ||
    label.includes("heading") ||
    label === "section_header"
  ) {
    return item.text.trim() || null;
  }
  return null;
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

function buildSectionsFromGroups(doc: DoclingDocument): NormalizedSection[] {
  if (!Array.isArray(doc.groups) || doc.groups.length === 0) {
    // Fall back to flat paragraphs as leaf sections without inventing hierarchy.
    if (!Array.isArray(doc.texts)) return [];
    return doc.texts
      .map((item, index): NormalizedSection | null => {
        if (!item || typeof item.text !== "string") return null;
        const id =
          typeof item.self_ref === "string"
            ? item.self_ref
            : `#/texts/${index}`;
        return {
          id,
          title: textItemTitle(item),
          level: null,
          text: item.text,
          label: typeof item.label === "string" ? item.label : null,
          sourceRef: id,
          children: [],
        };
      })
      .filter((s): s is NormalizedSection => s !== null);
  }

  return doc.groups.map((group: DoclingGroupItem, index) => {
    const id =
      typeof group.self_ref === "string" ? group.self_ref : `#/groups/${index}`;
    const childSections: NormalizedSection[] = [];
    if (Array.isArray(group.children)) {
      for (const child of group.children) {
        const r = refOf(child);
        if (!r) continue;
        const resolved = resolveByRef(doc, r);
        if (!resolved) continue;
        if (resolved.kind === "texts") {
          const item = resolved.item as DoclingTextItem;
          childSections.push({
            id: r,
            title: textItemTitle(item),
            level: null,
            text: typeof item.text === "string" ? item.text : null,
            label: typeof item.label === "string" ? item.label : null,
            sourceRef: r,
            children: [],
          });
        } else if (resolved.kind === "groups") {
          // Nested group: represent as section shell without inventing content.
          const g = resolved.item as DoclingGroupItem;
          childSections.push({
            id: r,
            title: typeof g.name === "string" ? g.name : null,
            level: null,
            text: null,
            label: typeof g.label === "string" ? g.label : null,
            sourceRef: r,
            children: [],
          });
        }
      }
    }
    return {
      id,
      title: typeof group.name === "string" ? group.name : null,
      level: null,
      text: null,
      label: typeof group.label === "string" ? group.label : null,
      sourceRef: id,
      children: childSections,
    };
  });
}

function buildTables(doc: DoclingDocument): NormalizedTable[] {
  if (!Array.isArray(doc.tables)) return [];
  return doc.tables.map((table: DoclingTableItem, index) => {
    const id =
      typeof table.self_ref === "string" ? table.self_ref : `#/tables/${index}`;
    return {
      id,
      caption: captionText(table.caption),
      label: typeof table.label === "string" ? table.label : null,
      sourceRef: id,
      data: table.data ?? null,
    };
  });
}

function buildFigures(doc: DoclingDocument): NormalizedFigure[] {
  if (!Array.isArray(doc.pictures)) return [];
  return doc.pictures.map((pic: DoclingPictureItem, index) => {
    const id =
      typeof pic.self_ref === "string" ? pic.self_ref : `#/pictures/${index}`;
    return {
      id,
      caption: captionText(pic.caption),
      label: typeof pic.label === "string" ? pic.label : null,
      sourceRef: id,
    };
  });
}

function buildReadingOrder(doc: DoclingDocument): NormalizedReadingOrderItem[] {
  const children = doc.body?.children;
  if (!Array.isArray(children) || children.length === 0) return [];

  const order: NormalizedReadingOrderItem[] = [];
  children.forEach((child: DoclingRef | string, index) => {
    const r = refOf(child);
    if (!r) return;
    const resolved = resolveByRef(doc, r);
    order.push({
      index,
      ref: r,
      kind: resolved?.kind ?? null,
    });
  });
  return order;
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
    sections: buildSectionsFromGroups(doc),
    tables: buildTables(doc),
    figures: buildFigures(doc),
    readingOrder: buildReadingOrder(doc),
    warnings,
  };
}

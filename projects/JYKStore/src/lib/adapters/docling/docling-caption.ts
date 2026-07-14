import type { DoclingIssue } from "./docling-errors";
import type { DoclingDocument } from "./docling-types";

const CAPTION_MAX_CHARS = 500;

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

function resolveByRef(
  doc: DoclingDocument,
  ref: string,
): { kind: string; item: Record<string, unknown> } | null {
  const match = /^#\/([A-Za-z_][\w]*)(?:\/(\d+))?$/.exec(ref);
  if (!match) return null;
  const collection = match[1]!;
  const indexStr = match[2];
  if (collection === "body") {
    return doc.body ? { kind: "body", item: doc.body as Record<string, unknown> } : null;
  }
  const arr = (doc as Record<string, unknown>)[collection];
  if (!Array.isArray(arr) || indexStr === undefined) return null;
  const index = Number(indexStr);
  const item = arr[index];
  if (isPlainObject(item)) return { kind: collection, item };
  // Fallback when fixture/self_ref order differs from array index.
  for (const candidate of arr) {
    if (isPlainObject(candidate) && candidate.self_ref === ref) {
      return { kind: collection, item: candidate };
    }
  }
  return null;
}

function pushCaptionPart(
  parts: string[],
  seen: Set<string>,
  text: string | null | undefined,
): void {
  const t = text?.trim();
  if (!t) return;
  const key = t.replace(/\s+/g, " ");
  if (seen.has(key)) return;
  seen.add(key);
  parts.push(key);
}

function collectFromCaptionValue(
  doc: DoclingDocument,
  value: unknown,
  parts: string[],
  seen: Set<string>,
  failedRefs: string[],
): void {
  if (typeof value === "string") {
    pushCaptionPart(parts, seen, value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectFromCaptionValue(doc, entry, parts, seen, failedRefs);
    return;
  }
  if (!isPlainObject(value)) return;
  if (typeof value.text === "string") {
    pushCaptionPart(parts, seen, value.text);
  }
  const r = refOf(value);
  if (r) {
    const resolved = resolveByRef(doc, r);
    if (resolved && typeof resolved.item.text === "string") {
      pushCaptionPart(parts, seen, resolved.item.text);
    } else {
      failedRefs.push(r);
    }
  }
}

/**
 * Resolve Docling table/picture caption text.
 * Prefer plural `captions`, then singular `caption`.
 */
export function resolveCaptionText(
  doc: DoclingDocument,
  item: { captions?: unknown; caption?: unknown; text?: unknown } | null | undefined,
  options?: { warnings?: DoclingIssue[]; field?: string },
): string | null {
  if (!item) return null;
  const parts: string[] = [];
  const seen = new Set<string>();
  const failedRefs: string[] = [];

  if (item.captions !== undefined) {
    collectFromCaptionValue(doc, item.captions, parts, seen, failedRefs);
  }
  if (item.caption !== undefined) {
    collectFromCaptionValue(doc, item.caption, parts, seen, failedRefs);
  }
  if (typeof item.text === "string") {
    pushCaptionPart(parts, seen, item.text);
  }

  if (failedRefs.length > 0 && options?.warnings) {
    options.warnings.push({
      code: "DOCLING_SCHEMA_INVALID",
      severity: "WARNING",
      field: options.field ?? "caption",
      message: `Caption 참조를 해석하지 못했습니다: ${failedRefs.slice(0, 3).join(", ")}`,
    });
  }

  if (parts.length === 0) return null;
  let joined = parts.join(" ").trim();
  if (joined.length > CAPTION_MAX_CHARS) {
    joined = joined.slice(0, CAPTION_MAX_CHARS).trimEnd();
  }
  return joined || null;
}

import {
  DOCLING_ERROR_CODES,
  issue,
  type DoclingIssue,
} from "./docling-errors";
import type { DoclingDocument, DoclingRef } from "./docling-types";

export const MAX_ENTITY_COUNT = 50_000;
/** Structural/ref walk ceiling for large Docling exports (was 32 — too low for long manuals). */
export const MAX_REF_DEPTH = 256;

const REF_PATH_RE = /^#\/([A-Za-z_][\w]*)(?:\/(\d+))?$/;

export type ReferenceResolveResult = {
  issues: DoclingIssue[];
  knownRefs: Set<string>;
  entityCount: number;
  maxDepthSeen: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function extractRefString(node: unknown): string | null {
  if (typeof node === "string" && node.startsWith("#/")) return node;
  if (!isPlainObject(node)) return null;
  const candidates = [node.$ref, node.cref, node.ref];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("#/")) return c;
  }
  return null;
}

function collectSelfRefs(
  doc: DoclingDocument,
  known: Set<string>,
): number {
  let count = 0;
  const collections: Array<{ key: string; items: unknown }> = [
    { key: "texts", items: doc.texts },
    { key: "tables", items: doc.tables },
    { key: "pictures", items: doc.pictures },
    { key: "groups", items: doc.groups },
  ];

  if (doc.body && isPlainObject(doc.body)) {
    const self = doc.body.self_ref;
    if (typeof self === "string") known.add(self);
    known.add("#/body");
  }

  for (const { key, items } of collections) {
    if (!Array.isArray(items)) continue;
    for (let i = 0; i < items.length; i++) {
      count += 1;
      const item = items[i];
      known.add(`#/${key}/${i}`);
      if (isPlainObject(item) && typeof item.self_ref === "string") {
        known.add(item.self_ref);
      }
    }
  }

  return count;
}

function resolveRefTarget(
  ref: string,
  doc: DoclingDocument,
  known: Set<string>,
): "ok" | "unknown" | "malformed" {
  if (!REF_PATH_RE.test(ref) && !known.has(ref)) {
    // Allow known self_refs that may use non-index paths
    if (known.has(ref)) return "ok";
    if (!ref.startsWith("#/")) return "malformed";
  }
  if (known.has(ref)) return "ok";

  const match = REF_PATH_RE.exec(ref);
  if (!match) return ref.startsWith("#/") ? "unknown" : "malformed";

  const collection = match[1]!;
  const indexStr = match[2];

  if (collection === "body" && indexStr === undefined) {
    return doc.body ? "ok" : "unknown";
  }

  const arr = (doc as Record<string, unknown>)[collection];
  if (!Array.isArray(arr)) return "unknown";
  if (indexStr === undefined) return "unknown";
  const index = Number(indexStr);
  if (!Number.isInteger(index) || index < 0 || index >= arr.length) {
    return "unknown";
  }
  return "ok";
}

function walkRefs(
  node: unknown,
  doc: DoclingDocument,
  known: Set<string>,
  issues: DoclingIssue[],
  depth: number,
  seen: Set<string>,
  stats: { maxDepthSeen: number },
): void {
  if (depth > stats.maxDepthSeen) stats.maxDepthSeen = depth;

  if (depth > MAX_REF_DEPTH) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_ENTITY_LIMIT_EXCEEDED,
        "ERROR",
        `Reference depth exceeded maximum of ${MAX_REF_DEPTH}.`,
        {
          field: "body",
          hint: "문서 구조 depth를 줄이거나 Docling export 설정을 확인하세요.",
        },
      ),
    );
    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      walkRefs(child, doc, known, issues, depth + 1, seen, stats);
    }
    return;
  }

  if (!isPlainObject(node)) return;

  const ref = extractRefString(node);
  if (ref) {
    if (!seen.has(ref)) {
      seen.add(ref);
      const status = resolveRefTarget(ref, doc, known);
      if (status === "malformed") {
        issues.push(
          issue(
            DOCLING_ERROR_CODES.DOCLING_REFERENCE_INVALID,
            "ERROR",
            `Malformed reference "${ref}".`,
            { field: "ref", hint: "참조는 #/collection/index 형식이어야 합니다." },
          ),
        );
      } else if (status === "unknown") {
        issues.push(
          issue(
            DOCLING_ERROR_CODES.DOCLING_REFERENCE_INVALID,
            "WARNING",
            `Unknown reference "${ref}".`,
            { field: "ref" },
          ),
        );
      } else {
        // Follow into target for depth accounting when children exist on target
        const match = REF_PATH_RE.exec(ref);
        if (match) {
          const collection = match[1]!;
          const indexStr = match[2];
          if (collection === "body") {
            walkRefs(doc.body, doc, known, issues, depth + 1, seen, stats);
          } else if (indexStr !== undefined) {
            const arr = (doc as Record<string, unknown>)[collection];
            if (Array.isArray(arr)) {
              walkRefs(arr[Number(indexStr)], doc, known, issues, depth + 1, seen, stats);
            }
          }
        }
      }
    }
  }

  // Walk structural children without treating every field as a ref graph edge
  if (Array.isArray(node.children)) {
    walkRefs(node.children, doc, known, issues, depth + 1, seen, stats);
  }
  for (const key of ["parent", "caption", "prov"] as const) {
    if (key in node) {
      const val = node[key];
      const nestedRef = extractRefString(val);
      if (nestedRef && !seen.has(`soft:${nestedRef}`)) {
        seen.add(`soft:${nestedRef}`);
        const status = resolveRefTarget(nestedRef, doc, known);
        if (status === "unknown") {
          issues.push(
            issue(
              DOCLING_ERROR_CODES.DOCLING_REFERENCE_INVALID,
              "WARNING",
              `Unknown reference "${nestedRef}" in ${key}.`,
              { field: key },
            ),
          );
        } else if (status === "malformed") {
          issues.push(
            issue(
              DOCLING_ERROR_CODES.DOCLING_REFERENCE_INVALID,
              "ERROR",
              `Malformed reference "${nestedRef}" in ${key}.`,
              { field: key },
            ),
          );
        }
      } else if (Array.isArray(val)) {
        for (const item of val) {
          const r = extractRefString(item);
          if (!r) continue;
          if (seen.has(`soft:${r}`)) continue;
          seen.add(`soft:${r}`);
          const status = resolveRefTarget(r, doc, known);
          if (status === "unknown") {
            issues.push(
              issue(
                DOCLING_ERROR_CODES.DOCLING_REFERENCE_INVALID,
                "WARNING",
                `Unknown reference "${r}" in ${key}.`,
                { field: key },
              ),
            );
          }
        }
      }
    }
  }
}

export function resolveDoclingReferences(
  doc: DoclingDocument,
): ReferenceResolveResult {
  const issues: DoclingIssue[] = [];
  const knownRefs = new Set<string>();
  const entityCount = collectSelfRefs(doc, knownRefs);

  if (entityCount > MAX_ENTITY_COUNT) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_ENTITY_LIMIT_EXCEEDED,
        "ERROR",
        `Entity count ${entityCount} exceeds maximum of ${MAX_ENTITY_COUNT}.`,
        {
          field: "texts|tables|pictures|groups",
          hint: "문서 entity 수를 줄이거나 분할하세요.",
        },
      ),
    );
  }

  const stats = { maxDepthSeen: 0 };
  const seen = new Set<string>();

  if (doc.body) {
    walkRefs(doc.body, doc, knownRefs, issues, 0, seen, stats);
  }

  // Also validate top-level parent refs on entities
  for (const key of ["texts", "tables", "pictures", "groups"] as const) {
    const arr = doc[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!isPlainObject(item)) continue;
      walkRefs(item as DoclingRef, doc, knownRefs, issues, 0, seen, stats);
    }
  }

  // Deduplicate identical issues
  const deduped: DoclingIssue[] = [];
  const keys = new Set<string>();
  for (const i of issues) {
    const k = `${i.code}|${i.severity}|${i.field ?? ""}|${i.message}`;
    if (keys.has(k)) continue;
    keys.add(k);
    deduped.push(i);
  }

  return {
    issues: deduped,
    knownRefs,
    entityCount,
    maxDepthSeen: stats.maxDepthSeen,
  };
}

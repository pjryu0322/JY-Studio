import { Readable } from "node:stream";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { ignore } from "stream-json/filters/ignore.js";
import { streamValues } from "stream-json/streamers/stream-values.js";
import {
  DOCLING_ERROR_CODES,
  issue,
  type DoclingIssue,
} from "./docling-errors";
import type { DoclingDocument } from "./docling-types";

/** Files at or below this size may use the legacy full-buffer validate path. */
export const DOCLING_JSON_FULL_BUFFER_MAX_BYTES = 16 * 1024 * 1024;

export const DOCLING_STREAM_PROJECTOR_LIMITS = {
  maxTexts: 50_000,
  maxTextChars: 8_000,
  maxTables: 5_000,
  maxPictures: 10_000,
  maxGroups: 20_000,
  maxBodyChildren: 50_000,
} as const;

const HEAVY_FIELD_KEYS = new Set([
  "uri",
  "image",
  "base64",
  "bytes",
  "binary",
  "data_uri",
  "content_bytes",
  "pil_image",
  "img",
]);

export type DoclingJsonStreamProjectorStats = {
  bytesRead: number;
  textsKept: number;
  textsTruncated: number;
  textsDropped: number;
  tablesKept: number;
  tablesDropped: number;
  picturesKept: number;
  picturesDropped: number;
  groupsKept: number;
  groupsDropped: number;
  heavyFieldsStripped: boolean;
};

export type DoclingJsonStreamProjectorResult = {
  ok: boolean;
  document?: DoclingDocument;
  issues: DoclingIssue[];
  stats: DoclingJsonStreamProjectorStats;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function emptyStats(): DoclingJsonStreamProjectorStats {
  return {
    bytesRead: 0,
    textsKept: 0,
    textsTruncated: 0,
    textsDropped: 0,
    tablesKept: 0,
    tablesDropped: 0,
    picturesKept: 0,
    picturesDropped: 0,
    groupsKept: 0,
    groupsDropped: 0,
    heavyFieldsStripped: false,
  };
}

function isHeavyFieldKey(key: string | number | null | undefined): boolean {
  return typeof key === "string" && HEAVY_FIELD_KEYS.has(key.toLowerCase());
}

/**
 * Drop entire subtrees for binary/base64/image/uri payloads so they never enter
 * the assembled document.
 */
function heavyFieldIgnoreFilter(
  stack: (string | number | null)[],
): boolean {
  const leaf = stack[stack.length - 1];
  if (isHeavyFieldKey(leaf)) return true;
  // Nested under an `image` object (e.g. pictures.0.image.mimetype / dpi): keep structure
  // stripped by ignoring the whole `image` key above.
  return false;
}

function truncateText(
  text: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}

function projectTextItem(
  item: unknown,
  stats: DoclingJsonStreamProjectorStats,
  issues: DoclingIssue[],
  limits: typeof DOCLING_STREAM_PROJECTOR_LIMITS,
): Record<string, unknown> | null {
  if (!isPlainObject(item)) return null;
  const out: Record<string, unknown> = {};
  if (typeof item.self_ref === "string") out.self_ref = item.self_ref;
  if (typeof item.label === "string") out.label = item.label;
  if (item.parent !== undefined) out.parent = item.parent;
  if (typeof item.text === "string") {
    const { text, truncated } = truncateText(item.text, limits.maxTextChars);
    out.text = text;
    if (truncated) {
      stats.textsTruncated += 1;
      if (stats.textsTruncated === 1) {
        issues.push(
          issue(
            DOCLING_ERROR_CODES.DOCLING_ENTITY_LIMIT_EXCEEDED,
            "WARNING",
            `Text items truncated to ${limits.maxTextChars} characters during stream projection.`,
            { field: "texts" },
          ),
        );
      }
    }
  }
  // Explicitly drop uri/image/base64/binary even if ignore filter missed them.
  return out;
}

function projectTableItem(item: unknown): Record<string, unknown> | null {
  if (!isPlainObject(item)) return null;
  const out: Record<string, unknown> = {};
  if (typeof item.self_ref === "string") out.self_ref = item.self_ref;
  if (typeof item.label === "string") out.label = item.label;
  if (item.parent !== undefined) out.parent = item.parent;
  if (item.caption !== undefined) out.caption = item.caption;
  // Keep cell text metadata only — strip embedded images from table data.
  if (item.data !== undefined) {
    out.data = scrubTableData(item.data);
  }
  return out;
}

function scrubTableData(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((cell) => scrubTableData(cell));
  }
  if (!isPlainObject(data)) return data;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isHeavyFieldKey(key)) continue;
    if (key === "text" && typeof value === "string") {
      out.text = value.length > 2_000 ? value.slice(0, 2_000) : value;
      continue;
    }
    out[key] = scrubTableData(value);
  }
  return out;
}

function projectPictureItem(item: unknown): Record<string, unknown> | null {
  if (!isPlainObject(item)) return null;
  const out: Record<string, unknown> = {};
  if (typeof item.self_ref === "string") out.self_ref = item.self_ref;
  if (typeof item.label === "string") out.label = item.label;
  if (item.parent !== undefined) out.parent = item.parent;
  if (item.caption !== undefined) out.caption = item.caption;
  if (item.prov !== undefined) out.prov = scrubProv(item.prov);
  // Never keep base64 / image / uri payloads.
  return out;
}

function scrubProv(prov: unknown): unknown {
  if (Array.isArray(prov)) return prov.map((p) => scrubProv(p));
  if (!isPlainObject(prov)) return prov;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(prov)) {
    if (isHeavyFieldKey(key)) continue;
    if (key === "bbox" || key === "page_no" || key === "charspan") {
      out[key] = value;
      continue;
    }
    if (isPlainObject(value) || Array.isArray(value)) {
      out[key] = scrubProv(value);
    } else if (typeof value !== "string" || value.length < 10_000) {
      out[key] = value;
    }
  }
  return out;
}

function projectGroupItem(item: unknown): Record<string, unknown> | null {
  if (!isPlainObject(item)) return null;
  const out: Record<string, unknown> = {};
  if (typeof item.self_ref === "string") out.self_ref = item.self_ref;
  if (typeof item.name === "string") out.name = item.name;
  if (typeof item.label === "string") out.label = item.label;
  if (item.parent !== undefined) out.parent = item.parent;
  if (Array.isArray(item.children)) out.children = item.children;
  return out;
}

function projectOrigin(origin: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(origin)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(origin)) {
    if (isHeavyFieldKey(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    } else if (value === null) {
      out[key] = null;
    }
  }
  return out;
}

function projectBody(body: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(body)) return undefined;
  const out: Record<string, unknown> = {};
  if (typeof body.self_ref === "string") out.self_ref = body.self_ref;
  if (Array.isArray(body.children)) {
    out.children = body.children.slice(
      0,
      DOCLING_STREAM_PROJECTOR_LIMITS.maxBodyChildren,
    );
  }
  return out;
}

/**
 * Compact a fully-assembled Docling-shaped object for normalizeDoclingDocument.
 * Intended for documents that already had heavy fields stripped by the ignore filter.
 */
export function compactDoclingDocument(
  raw: unknown,
  options?: {
    issues?: DoclingIssue[];
    stats?: DoclingJsonStreamProjectorStats;
    limits?: typeof DOCLING_STREAM_PROJECTOR_LIMITS;
  },
): DoclingDocument {
  const issues = options?.issues ?? [];
  const stats = options?.stats ?? emptyStats();
  const limits = options?.limits ?? DOCLING_STREAM_PROJECTOR_LIMITS;

  if (!isPlainObject(raw)) {
    return {};
  }

  const doc: DoclingDocument = {};
  if (typeof raw.schema_name === "string") doc.schema_name = raw.schema_name;
  if (typeof raw.version === "string") doc.version = raw.version;
  if (typeof raw.name === "string") doc.name = raw.name;

  const origin = projectOrigin(raw.origin);
  if (origin) doc.origin = origin;

  const body = projectBody(raw.body);
  if (body) doc.body = body;

  if (Array.isArray(raw.texts)) {
    const kept: Record<string, unknown>[] = [];
    for (let i = 0; i < raw.texts.length; i++) {
      if (kept.length >= limits.maxTexts) {
        stats.textsDropped = raw.texts.length - i;
        issues.push(
          issue(
            DOCLING_ERROR_CODES.DOCLING_ENTITY_LIMIT_EXCEEDED,
            "WARNING",
            `texts capped at ${limits.maxTexts} items during stream projection.`,
            { field: "texts" },
          ),
        );
        break;
      }
      const projected = projectTextItem(raw.texts[i], stats, issues, limits);
      if (projected) {
        kept.push(projected);
        stats.textsKept += 1;
      }
    }
    doc.texts = kept;
  }

  if (Array.isArray(raw.tables)) {
    const kept: Record<string, unknown>[] = [];
    for (let i = 0; i < raw.tables.length; i++) {
      if (kept.length >= limits.maxTables) {
        stats.tablesDropped = raw.tables.length - i;
        issues.push(
          issue(
            DOCLING_ERROR_CODES.DOCLING_ENTITY_LIMIT_EXCEEDED,
            "WARNING",
            `tables capped at ${limits.maxTables} items during stream projection.`,
            { field: "tables" },
          ),
        );
        break;
      }
      const projected = projectTableItem(raw.tables[i]);
      if (projected) {
        kept.push(projected);
        stats.tablesKept += 1;
      }
    }
    doc.tables = kept;
  }

  if (Array.isArray(raw.pictures)) {
    const kept: Record<string, unknown>[] = [];
    for (let i = 0; i < raw.pictures.length; i++) {
      if (kept.length >= limits.maxPictures) {
        stats.picturesDropped = raw.pictures.length - i;
        issues.push(
          issue(
            DOCLING_ERROR_CODES.DOCLING_ENTITY_LIMIT_EXCEEDED,
            "WARNING",
            `pictures capped at ${limits.maxPictures} items during stream projection.`,
            { field: "pictures" },
          ),
        );
        break;
      }
      const projected = projectPictureItem(raw.pictures[i]);
      if (projected) {
        kept.push(projected);
        stats.picturesKept += 1;
      }
    }
    doc.pictures = kept;
  }

  if (Array.isArray(raw.groups)) {
    const kept: Record<string, unknown>[] = [];
    for (let i = 0; i < raw.groups.length; i++) {
      if (kept.length >= limits.maxGroups) {
        stats.groupsDropped = raw.groups.length - i;
        issues.push(
          issue(
            DOCLING_ERROR_CODES.DOCLING_ENTITY_LIMIT_EXCEEDED,
            "WARNING",
            `groups capped at ${limits.maxGroups} items during stream projection.`,
            { field: "groups" },
          ),
        );
        break;
      }
      const projected = projectGroupItem(raw.groups[i]);
      if (projected) {
        kept.push(projected);
        stats.groupsKept += 1;
      }
    }
    doc.groups = kept;
  }

  return doc;
}

function countBytesRead(readable: Readable, stats: DoclingJsonStreamProjectorStats): Readable {
  return readable.on("data", (chunk: Buffer | string) => {
    stats.bytesRead +=
      typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.byteLength;
  });
}

/**
 * Stream-parse Docling JSON without JSON.parse of the full string.
 * Heavy binary/base64 fields are stripped at the token level before assembly.
 */
export async function projectDoclingJsonStream(
  input: NodeJS.ReadableStream | Readable,
  options?: {
    contentLength?: number;
    limits?: typeof DOCLING_STREAM_PROJECTOR_LIMITS;
  },
): Promise<DoclingJsonStreamProjectorResult> {
  const issues: DoclingIssue[] = [];
  const stats = emptyStats();
  const limits = options?.limits ?? DOCLING_STREAM_PROJECTOR_LIMITS;

  const source = countBytesRead(Readable.from(input as AsyncIterable<unknown>), stats);

  let assembled: unknown;
  let parseError: Error | null = null;

  try {
    const pipeline = chain([
      source,
      parser({ packKeys: true, packValues: true, streamValues: false }),
      // packKeys must be true so stackDiffer emits keyValue tokens Assembler understands.
      ignore({
        filter: heavyFieldIgnoreFilter,
        packKeys: true,
        streamKeys: false,
      }),
      streamValues({
        reviver(key: string, value: unknown) {
          if (isHeavyFieldKey(key)) {
            stats.heavyFieldsStripped = true;
            return undefined;
          }
          return value;
        },
      }),
    ]);

    for await (const item of pipeline as AsyncIterable<{ key: number; value: unknown }>) {
      assembled = item.value;
      stats.heavyFieldsStripped = true;
      break;
    }
  } catch (error) {
    parseError = error instanceof Error ? error : new Error(String(error));
  }

  if (parseError) {
    const message = parseError.message.toLowerCase();
    const utf8 =
      message.includes("utf") ||
      message.includes("encoding") ||
      message.includes("invalid byte");
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_JSON_PARSE_FAILED,
        "ERROR",
        utf8
          ? "Docling JSON is not valid UTF-8."
          : "Docling JSON could not be parsed.",
        {
          field: "json",
          hint: utf8
            ? undefined
            : "유효한 JSON 파일인지 확인하세요.",
        },
      ),
    );
    return { ok: false, issues, stats };
  }

  if (assembled === undefined) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_JSON_EMPTY,
        "ERROR",
        "Docling JSON is empty.",
        { field: "json" },
      ),
    );
    return { ok: false, issues, stats };
  }

  if (!isPlainObject(assembled)) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_SCHEMA_INVALID,
        "ERROR",
        "Docling JSON root must be an object.",
        { field: "json" },
      ),
    );
    return { ok: false, issues, stats };
  }

  stats.heavyFieldsStripped = true;
  const document = compactDoclingDocument(assembled, { issues, stats, limits });

  // Help GC of the pre-compact assembly (may still be large for text-heavy docs).
  assembled = undefined;

  const ok = !issues.some((i) => i.severity === "ERROR");
  return { ok, document, issues, stats };
}

/**
 * True when content length requires the stream projector (never full Buffer).
 */
export function shouldUseDoclingJsonStreamProjector(
  contentLength: number | null | undefined,
): boolean {
  if (contentLength == null || !Number.isFinite(contentLength)) {
    // Unknown size: prefer stream path to avoid accidental OOM.
    return true;
  }
  return contentLength > DOCLING_JSON_FULL_BUFFER_MAX_BYTES;
}

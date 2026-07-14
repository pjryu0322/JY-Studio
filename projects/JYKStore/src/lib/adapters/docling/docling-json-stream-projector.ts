import { PassThrough, Readable, type Readable as ReadableType } from "node:stream";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { ignore } from "stream-json/filters/ignore.js";
import { pick } from "stream-json/filters/pick.js";
import { streamArray } from "stream-json/streamers/stream-array.js";
import { streamValues } from "stream-json/streamers/stream-values.js";
import {
  DOCLING_ERROR_CODES,
  issue,
  type DoclingIssue,
} from "./docling-errors";
import {
  extractImageUriFromPicture,
  parseDataUriImage,
} from "./docling-figure-preview";
import type { DoclingDocument } from "./docling-types";

export type ExtractedPictureImage = {
  selfRef: string;
  mimeType: string;
  bytes: Uint8Array;
  sha256: string;
  width: number | null;
  height: number | null;
};

/** Files at or below this size may use the legacy full-buffer validate path. */
export const DOCLING_JSON_FULL_BUFFER_MAX_BYTES = 16 * 1024 * 1024;

export const DOCLING_STREAM_PROJECTOR_LIMITS = {
  maxTexts: 50_000,
  maxTextChars: 8_000,
  /** Cumulative text characters across all kept texts (truncated per-item first). */
  maxTotalTextChars: 16_000_000,
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

const META_KEYS = ["schema_name", "version", "name", "origin", "body"] as const;
const ARRAY_KEYS = ["texts", "tables", "pictures", "groups"] as const;

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
  totalTextChars: number;
};

export type DoclingJsonStreamProjectorResult = {
  ok: boolean;
  document?: DoclingDocument;
  issues: DoclingIssue[];
  stats: DoclingJsonStreamProjectorStats;
  extractedPictureImages?: ExtractedPictureImage[];
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
    totalTextChars: 0,
  };
}

function isHeavyFieldKey(key: string | number | null | undefined): boolean {
  return typeof key === "string" && HEAVY_FIELD_KEYS.has(key.toLowerCase());
}

/**
 * Drop binary/base64 payloads except picture image URIs (extracted then discarded
 * in projectPictureItem so NormalizedDocument never stores Base64).
 */
function heavyFieldIgnoreFilter(
  stack: (string | number | null)[],
): boolean {
  const leaf = stack[stack.length - 1];
  if (!isHeavyFieldKey(leaf)) return false;
  const underPictures = stack.includes("pictures");
  if (
    underPictures &&
    (leaf === "uri" ||
      leaf === "image" ||
      leaf === "data_uri" ||
      leaf === "base64" ||
      stack.includes("image"))
  ) {
    return false;
  }
  return true;
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
  if (typeof item.level === "number" && Number.isFinite(item.level)) {
    out.level = item.level;
  }
  if (item.prov !== undefined) out.prov = scrubProv(item.prov);
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
  return out;
}

function projectTableItem(item: unknown): Record<string, unknown> | null {
  if (!isPlainObject(item)) return null;
  const out: Record<string, unknown> = {};
  if (typeof item.self_ref === "string") out.self_ref = item.self_ref;
  if (typeof item.label === "string") out.label = item.label;
  if (item.parent !== undefined) out.parent = item.parent;
  if (item.caption !== undefined) out.caption = scrubCaptionRefs(item.caption);
  if (item.captions !== undefined) out.captions = scrubCaptionRefs(item.captions);
  if (item.prov !== undefined) out.prov = scrubProv(item.prov);
  if (item.data !== undefined) {
    out.data = scrubTableData(item.data);
  }
  return out;
}

function scrubCaptionRefs(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > 2_000 ? value.slice(0, 2_000) : value;
  }
  if (Array.isArray(value)) return value.map((v) => scrubCaptionRefs(v));
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (isHeavyFieldKey(key)) continue;
    if (key === "$ref" || key === "cref" || key === "ref" || key === "self_ref") {
      if (typeof v === "string") out[key] = v;
      continue;
    }
    if (key === "text" && typeof v === "string") {
      out.text = v.length > 2_000 ? v.slice(0, 2_000) : v;
      continue;
    }
    if (isPlainObject(v) || Array.isArray(v)) {
      out[key] = scrubCaptionRefs(v);
    }
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

function projectPictureItem(
  item: unknown,
  extracted?: ExtractedPictureImage[],
): Record<string, unknown> | null {
  if (!isPlainObject(item)) return null;
  const out: Record<string, unknown> = {};
  if (typeof item.self_ref === "string") out.self_ref = item.self_ref;
  if (typeof item.label === "string") out.label = item.label;
  if (item.parent !== undefined) out.parent = item.parent;
  if (item.caption !== undefined) out.caption = scrubCaptionRefs(item.caption);
  if (item.captions !== undefined) out.captions = scrubCaptionRefs(item.captions);
  if (item.prov !== undefined) out.prov = scrubProv(item.prov);

  if (extracted && extracted.length < 40) {
    const uri = extractImageUriFromPicture(item);
    if (uri) {
      const parsed = parseDataUriImage(uri);
      if (!("error" in parsed)) {
        const selfRef =
          typeof item.self_ref === "string"
            ? item.self_ref
            : `#/pictures/${extracted.length}`;
        extracted.push({
          selfRef,
          mimeType: parsed.mimeType,
          bytes: parsed.bytes,
          sha256: parsed.sha256,
          width: parsed.width,
          height: parsed.height,
        });
      }
    }
  }
  return out;
}

const PROV_ALLOWED = new Set(["page_no", "page", "bbox", "charspan"]);

function scrubProv(prov: unknown): unknown {
  if (Array.isArray(prov)) return prov.map((p) => scrubProv(p));
  if (!isPlainObject(prov)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(prov)) {
    if (!PROV_ALLOWED.has(key)) continue;
    if (isHeavyFieldKey(key)) continue;
    if (key === "bbox" && isPlainObject(value)) {
      const bbox: Record<string, unknown> = {};
      for (const [bk, bv] of Object.entries(value)) {
        if (typeof bv === "number" && Number.isFinite(bv)) bbox[bk] = bv;
      }
      out.bbox = bbox;
      continue;
    }
    if (key === "charspan" && Array.isArray(value)) {
      out.charspan = value.filter((n) => typeof n === "number" && Number.isFinite(n));
      continue;
    }
    if ((key === "page_no" || key === "page") && typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
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
 * Used by small in-memory callers / tests — stream path does not assemble a root.
 */
export function compactDoclingDocument(
  raw: unknown,
  options?: {
    issues?: DoclingIssue[];
    stats?: DoclingJsonStreamProjectorStats;
    limits?: typeof DOCLING_STREAM_PROJECTOR_LIMITS;
    extractedPictureImages?: ExtractedPictureImage[];
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
      if (
        kept.length >= limits.maxTexts ||
        stats.totalTextChars >= limits.maxTotalTextChars
      ) {
        stats.textsDropped += raw.texts.length - i;
        issues.push(
          issue(
            DOCLING_ERROR_CODES.DOCLING_ENTITY_LIMIT_EXCEEDED,
            "WARNING",
            `texts capped during compact projection.`,
            { field: "texts" },
          ),
        );
        break;
      }
      const projected = projectTextItem(raw.texts[i], stats, issues, limits);
      if (projected) {
        const textLen = typeof projected.text === "string" ? projected.text.length : 0;
        if (stats.totalTextChars + textLen > limits.maxTotalTextChars) {
          stats.textsDropped += raw.texts.length - i;
          issues.push(
            issue(
              DOCLING_ERROR_CODES.DOCLING_ENTITY_LIMIT_EXCEEDED,
              "WARNING",
              `texts total character budget (${limits.maxTotalTextChars}) exceeded.`,
              { field: "texts" },
            ),
          );
          break;
        }
        kept.push(projected);
        stats.textsKept += 1;
        stats.totalTextChars += textLen;
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
      const projected = projectPictureItem(raw.pictures[i], options?.extractedPictureImages);
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
 * Fan-out an object-mode token stream to N consumers with basic backpressure.
 * Each tap receives every token (pick/streamArray then selects by path).
 */
export function fanOutObjectStream(
  source: ReadableType,
  count: number,
): PassThrough[] {
  const taps = Array.from(
    { length: count },
    () => new PassThrough({ objectMode: true, highWaterMark: 64 }),
  );
  let paused = false;
  const resumeIfNeeded = () => {
    if (!paused) return;
    if (taps.every((t) => !t.writableNeedDrain)) {
      paused = false;
      source.resume();
    }
  };
  for (const t of taps) {
    t.on("drain", resumeIfNeeded);
  }
  source.on("data", (chunk: unknown) => {
    let ok = true;
    for (const t of taps) {
      if (!t.write(chunk)) ok = false;
    }
    if (!ok && !paused) {
      paused = true;
      source.pause();
    }
  });
  source.on("end", () => {
    for (const t of taps) t.end();
  });
  source.on("error", (err: Error) => {
    for (const t of taps) t.destroy(err);
  });
  return taps;
}

async function readPickedScalar(
  tokenTap: ReadableType,
  field: string,
): Promise<unknown> {
  const pipeline = chain([
    tokenTap,
    pick({ filter: field, packKeys: true, streamKeys: false }),
    streamValues(),
  ]);
  for await (const item of pipeline as AsyncIterable<{ key: number; value: unknown }>) {
    return item.value;
  }
  return undefined;
}

async function readPickedArrayItems(
  tokenTap: ReadableType,
  field: string,
  onItem: (value: unknown, index: number) => void,
): Promise<void> {
  const pipeline = chain([
    tokenTap,
    pick({ filter: field, packKeys: true, streamKeys: false }),
    streamArray(),
  ]);
  for await (const item of pipeline as AsyncIterable<{ key: number; value: unknown }>) {
    onItem(item.value, item.key);
  }
}

/**
 * Path-based incremental projection of Docling JSON.
 * Never assigns a fully assembled root object — streams meta scalars and array
 * items via pick + streamArray / streamValues per path.
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
  const extractedPictureImages: ExtractedPictureImage[] = [];

  const source = countBytesRead(Readable.from(input as AsyncIterable<unknown>), stats);
  const tokenStream = chain([
    source,
    parser({ packKeys: true, packValues: true, streamValues: false }),
    ignore({
      filter: heavyFieldIgnoreFilter,
      packKeys: true,
      streamKeys: false,
    }),
  ]) as Readable;

  const tapCount = META_KEYS.length + ARRAY_KEYS.length;
  const taps = fanOutObjectStream(tokenStream, tapCount);
  stats.heavyFieldsStripped = true;

  const document: DoclingDocument = {};
  let parseError: Error | null = null;
  let sawRootObject = false;

  try {
    const metaPromises = META_KEYS.map(async (key, index) => {
      const value = await readPickedScalar(taps[index]!, key);
      if (value === undefined) return;
      sawRootObject = true;
      if (key === "schema_name" && typeof value === "string") {
        document.schema_name = value;
      } else if (key === "version" && typeof value === "string") {
        document.version = value;
      } else if (key === "name" && typeof value === "string") {
        document.name = value;
      } else if (key === "origin") {
        const origin = projectOrigin(value);
        if (origin) document.origin = origin;
      } else if (key === "body") {
        const body = projectBody(value);
        if (body) document.body = body;
      }
    });

    let textsWarned = false;
    let textsCharWarned = false;
    const texts: Record<string, unknown>[] = [];
    const tables: Record<string, unknown>[] = [];
    const pictures: Record<string, unknown>[] = [];
    const groups: Record<string, unknown>[] = [];

    const textsPromise = readPickedArrayItems(
      taps[META_KEYS.length]!,
      "texts",
      (raw) => {
        sawRootObject = true;
        if (
          texts.length >= limits.maxTexts ||
          stats.totalTextChars >= limits.maxTotalTextChars
        ) {
          stats.textsDropped += 1;
          if (!textsWarned) {
            textsWarned = true;
            issues.push(
              issue(
                DOCLING_ERROR_CODES.DOCLING_ENTITY_LIMIT_EXCEEDED,
                "WARNING",
                `texts capped at ${limits.maxTexts} items or character budget during stream projection.`,
                { field: "texts" },
              ),
            );
          }
          return;
        }
        const projected = projectTextItem(raw, stats, issues, limits);
        if (!projected) return;
        const textLen = typeof projected.text === "string" ? projected.text.length : 0;
        if (stats.totalTextChars + textLen > limits.maxTotalTextChars) {
          stats.textsDropped += 1;
          if (!textsCharWarned) {
            textsCharWarned = true;
            issues.push(
              issue(
                DOCLING_ERROR_CODES.DOCLING_ENTITY_LIMIT_EXCEEDED,
                "WARNING",
                `texts total character budget (${limits.maxTotalTextChars}) exceeded during stream projection.`,
                { field: "texts" },
              ),
            );
          }
          return;
        }
        texts.push(projected);
        stats.textsKept += 1;
        stats.totalTextChars += textLen;
      },
    );

    let tablesWarned = false;
    const tablesPromise = readPickedArrayItems(
      taps[META_KEYS.length + 1]!,
      "tables",
      (raw) => {
        sawRootObject = true;
        if (tables.length >= limits.maxTables) {
          stats.tablesDropped += 1;
          if (!tablesWarned) {
            tablesWarned = true;
            issues.push(
              issue(
                DOCLING_ERROR_CODES.DOCLING_ENTITY_LIMIT_EXCEEDED,
                "WARNING",
                `tables capped at ${limits.maxTables} items during stream projection.`,
                { field: "tables" },
              ),
            );
          }
          return;
        }
        const projected = projectTableItem(raw);
        if (projected) {
          tables.push(projected);
          stats.tablesKept += 1;
        }
      },
    );

    let picturesWarned = false;
    const picturesPromise = readPickedArrayItems(
      taps[META_KEYS.length + 2]!,
      "pictures",
      (raw) => {
        sawRootObject = true;
        if (pictures.length >= limits.maxPictures) {
          stats.picturesDropped += 1;
          if (!picturesWarned) {
            picturesWarned = true;
            issues.push(
              issue(
                DOCLING_ERROR_CODES.DOCLING_ENTITY_LIMIT_EXCEEDED,
                "WARNING",
                `pictures capped at ${limits.maxPictures} items during stream projection.`,
                { field: "pictures" },
              ),
            );
          }
          return;
        }
        const projected = projectPictureItem(raw, extractedPictureImages);
        if (projected) {
          pictures.push(projected);
          stats.picturesKept += 1;
        }
      },
    );

    let groupsWarned = false;
    const groupsPromise = readPickedArrayItems(
      taps[META_KEYS.length + 3]!,
      "groups",
      (raw) => {
        sawRootObject = true;
        if (groups.length >= limits.maxGroups) {
          stats.groupsDropped += 1;
          if (!groupsWarned) {
            groupsWarned = true;
            issues.push(
              issue(
                DOCLING_ERROR_CODES.DOCLING_ENTITY_LIMIT_EXCEEDED,
                "WARNING",
                `groups capped at ${limits.maxGroups} items during stream projection.`,
                { field: "groups" },
              ),
            );
          }
          return;
        }
        const projected = projectGroupItem(raw);
        if (projected) {
          groups.push(projected);
          stats.groupsKept += 1;
        }
      },
    );

    await Promise.all([
      ...metaPromises,
      textsPromise,
      tablesPromise,
      picturesPromise,
      groupsPromise,
    ]);

    if (texts.length > 0) document.texts = texts;
    if (tables.length > 0) document.tables = tables;
    if (pictures.length > 0) document.pictures = pictures;
    if (groups.length > 0) document.groups = groups;
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
          hint: utf8 ? undefined : "유효한 JSON 파일인지 확인하세요.",
        },
      ),
    );
    return { ok: false, issues, stats };
  }

  if (!sawRootObject && Object.keys(document).length === 0) {
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

  const ok = !issues.some((i) => i.severity === "ERROR");
  return { ok, document, issues, stats, extractedPictureImages };
}

/**
 * True when content length requires the stream projector (never full Buffer).
 */
export function shouldUseDoclingJsonStreamProjector(
  contentLength: number | null | undefined,
): boolean {
  if (contentLength == null || !Number.isFinite(contentLength)) {
    return true;
  }
  return contentLength > DOCLING_JSON_FULL_BUFFER_MAX_BYTES;
}

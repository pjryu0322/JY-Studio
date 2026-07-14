import type { DoclingIssue } from "./docling-errors";

/** Loose DoclingDocument-shaped types — preserve unknown fields. */
export type DoclingRef = {
  $ref?: string;
  cref?: string;
  ref?: string;
  [key: string]: unknown;
};

export type DoclingOrigin = {
  filename?: string;
  mimetype?: string;
  binary_hash?: string;
  [key: string]: unknown;
};

export type DoclingTextItem = {
  self_ref?: string;
  text?: string;
  label?: string;
  parent?: DoclingRef;
  [key: string]: unknown;
};

export type DoclingTableItem = {
  self_ref?: string;
  data?: unknown;
  caption?: unknown;
  label?: string;
  parent?: DoclingRef;
  [key: string]: unknown;
};

export type DoclingPictureItem = {
  self_ref?: string;
  caption?: unknown;
  label?: string;
  parent?: DoclingRef;
  [key: string]: unknown;
};

export type DoclingGroupItem = {
  self_ref?: string;
  name?: string;
  label?: string;
  children?: DoclingRef[];
  parent?: DoclingRef;
  [key: string]: unknown;
};

export type DoclingBody = {
  self_ref?: string;
  children?: DoclingRef[];
  [key: string]: unknown;
};

export type DoclingDocument = {
  schema_name?: string;
  version?: string;
  name?: string;
  origin?: DoclingOrigin;
  body?: DoclingBody;
  texts?: DoclingTextItem[];
  tables?: DoclingTableItem[];
  pictures?: DoclingPictureItem[];
  groups?: DoclingGroupItem[];
  [key: string]: unknown;
};

export type AdapterSourceMeta = {
  filename?: string;
  mimetype?: string;
  fileId?: string;
};

export type AdapterFileMeta = {
  packId?: string;
  packVersionId?: string;
  sourceFileId?: string;
  jsonPayloadFileId?: string;
  markdownPayloadFileId?: string;
};

export type AdapterInput = {
  /** Docling JSON payload (UTF-8 text or bytes). */
  json?: string | Uint8Array | null;
  /** Docling Markdown payload (UTF-8 text or bytes). */
  markdown?: string | Uint8Array | null;
  source?: AdapterSourceMeta;
  files?: AdapterFileMeta;
};

export type OriginMatchStatus = "MATCH" | "WARNING" | "MISMATCH";

export type OriginMatchResult = {
  filenameStatus: OriginMatchStatus;
  mimetypeStatus: OriginMatchStatus;
  issues: DoclingIssue[];
};

export type AdapterValidationResult = {
  ok: boolean;
  issues: DoclingIssue[];
  document?: DoclingDocument;
  markdownText?: string;
  originMatch?: OriginMatchResult;
};

export type NormalizedSection = {
  id: string;
  title: string | null;
  level: number | null;
  text: string | null;
  label: string | null;
  sourceRef: string | null;
  children: NormalizedSection[];
  /** Optional page hint from Docling provenance. */
  page?: number | null;
};

export type NormalizedTable = {
  id: string;
  caption: string | null;
  label: string | null;
  sourceRef: string | null;
  data: unknown;
};

export type NormalizedFigure = {
  id: string;
  caption: string | null;
  label: string | null;
  sourceRef: string | null;
  altText?: string | null;
  page?: number | null;
  pageNumber?: number | null;
  width?: number | null;
  height?: number | null;
  previewObjectKey?: string | null;
  mimeType?: string | null;
  classification?: string;
  classificationConfidence?: number;
  classificationReasons?: string[];
  /** Local in-memory only — never persisted or sent to client. */
  _previewBytes?: Uint8Array;
  _previewSha256?: string;
};

export type NormalizedReadingOrderItem = {
  index: number;
  ref: string;
  kind: string | null;
};

export type NormalizedDocumentDraft = {
  title: string | null;
  language: string | null;
  adapter: {
    type: "DOCLING";
    version: string;
    sourceSchema: string;
    sourceSchemaVersion: string;
  };
  files: {
    sourceFileId: string | null;
    jsonPayloadFileId: string | null;
    markdownPayloadFileId: string | null;
  };
  sections: NormalizedSection[];
  tables: NormalizedTable[];
  figures: NormalizedFigure[];
  readingOrder: NormalizedReadingOrderItem[];
  warnings: DoclingIssue[];
};

export interface DocumentAdapter {
  type: "DOCLING";
  version: string;
  validate(input: AdapterInput): Promise<AdapterValidationResult>;
  normalize(input: AdapterInput): Promise<NormalizedDocumentDraft>;
}

export const DOCLING_ADAPTER_TYPE = "DOCLING" as const;
export const DOCLING_ADAPTER_VERSION = "1.1.0";
export const DOCLING_SCHEMA_NAME = "DoclingDocument";

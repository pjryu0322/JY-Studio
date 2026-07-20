/**
 * Python Worker local output contract (source of truth for ZIP import).
 *
 * Store/TS Worker validates these files and imports them.
 * TypeScript must not regenerate chunks from this output.
 */

export const WORKER_OUTPUT_REQUIRED_FILES = [
  "inventory.json",
  "normalized_documents.json",
  "chunks.json",
  "embeddings.json",
  "source_trace.json",
  "validation_report.json",
] as const;

export type WorkerOutputRequiredFile = (typeof WORKER_OUTPUT_REQUIRED_FILES)[number];

export const WORKER_OUTPUT_OPTIONAL_FILES = [
  "normalized_documents.md",
] as const;

/** Inventory classifications that must never appear as chunk sources. */
export const WORKER_NON_CHUNKABLE_CLASSIFICATIONS = [
  "excluded",
  "review_target",
  "supporting_asset",
] as const;

export type WorkerNonChunkableClassification =
  (typeof WORKER_NON_CHUNKABLE_CLASSIFICATIONS)[number];

export type WorkerInventoryEntry = {
  sourcePath: string;
  classification: string;
  sha256?: string;
  parser?: string | null;
  excludedReason?: string | null;
  [key: string]: unknown;
};

export type WorkerNormalizedDocument = {
  documentId?: string;
  sourcePath: string;
  sourceType?: string;
  title?: string;
  sections?: unknown[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type WorkerChunk = {
  chunkId: string;
  content: string;
  sourcePath: string;
  traceId: string;
  title?: string;
  section?: string;
  sourceType?: string;
  symbols?: string[];
  keywords?: string[];
  codeBlocks?: unknown[];
  [key: string]: unknown;
};

export type WorkerSourceTrace = {
  traceId: string;
  sourcePath: string;
  sourceHash: string;
  parser: string;
  parserVersion: string;
  chunkId?: string;
  section?: string;
  [key: string]: unknown;
};

/**
 * Embedding vector produced by the Python Worker for a chunk.
 *
 * The Worker computes vectors locally; Store validates and imports them.
 * Store does not regenerate embeddings on this path.
 */
export type WorkerEmbedding = {
  chunkId: string;
  provider: string;
  model: string;
  dimension: number;
  vector: number[];
  contentHash: string;
  embeddingTextHash?: string;
  modelRevision?: string | null;
  createdAt?: string;
  [key: string]: unknown;
};

export type WorkerValidationReport = {
  status?: string;
  errors: string[];
  warnings?: string[];
  totals?: Record<string, unknown>;
  parsers?: Record<string, unknown>;
  license?: Record<string, unknown>;
  generatedAt?: string;
  [key: string]: unknown;
};

export type WorkerOutputBundle = {
  inventory: WorkerInventoryEntry[];
  normalizedDocuments: WorkerNormalizedDocument[];
  chunks: WorkerChunk[];
  embeddings: WorkerEmbedding[];
  sourceTraces: WorkerSourceTrace[];
  validationReport: WorkerValidationReport;
};

export type WorkerOutputValidationIssue = {
  code: string;
  message: string;
  path?: string;
};

export type WorkerOutputValidationResult =
  | { ok: true; bundle: WorkerOutputBundle; warnings: WorkerOutputValidationIssue[] }
  | { ok: false; errors: WorkerOutputValidationIssue[]; warnings: WorkerOutputValidationIssue[] };

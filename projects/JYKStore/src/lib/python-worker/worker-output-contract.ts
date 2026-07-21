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

/** P7.4: a single archive entry removed by a security guard or exclusion policy. */
export type WorkerExcludedFile = {
  path: string;
  reason: string;
  detail?: string | null;
};

/** P7.4: compact roll-up of excluded entries, safe to surface to Admin UI. */
export type WorkerExclusionSummary = {
  total: number;
  byReason: Record<string, number>;
};

export type WorkerValidationReport = {
  status?: string;
  errors: string[];
  warnings?: string[];
  totals?: Record<string, unknown>;
  parsers?: Record<string, unknown>;
  license?: Record<string, unknown>;
  generatedAt?: string;
  /** P7.4 additive: entries the Worker excluded from structuring (optional). */
  excludedFiles?: WorkerExcludedFile[];
  exclusionSummary?: WorkerExclusionSummary;
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

/**
 * P7.4: read a normalized exclusion summary from a (possibly loosely-typed)
 * validation report. Never throws; falls back to counting `excludedFiles`, then
 * to an empty summary. Store never fails just because these fields are present
 * or absent — they are advisory only.
 */
export function readWorkerExclusionSummary(
  report: WorkerValidationReport | null | undefined,
): WorkerExclusionSummary {
  const empty: WorkerExclusionSummary = { total: 0, byReason: {} };
  if (!report) return empty;

  const summary = report.exclusionSummary;
  if (summary && typeof summary === "object") {
    const record = summary as Record<string, unknown>;
    const total = typeof record.total === "number" ? record.total : 0;
    const byReason: Record<string, number> = {};
    if (record.byReason && typeof record.byReason === "object") {
      for (const [key, value] of Object.entries(record.byReason as Record<string, unknown>)) {
        if (typeof value === "number") byReason[key] = value;
      }
    }
    return { total, byReason };
  }

  const files = Array.isArray(report.excludedFiles) ? report.excludedFiles : [];
  const byReason: Record<string, number> = {};
  for (const file of files) {
    const reason =
      file && typeof file === "object" && typeof file.reason === "string"
        ? file.reason
        : "unknown";
    byReason[reason] = (byReason[reason] ?? 0) + 1;
  }
  return { total: files.length, byReason };
}

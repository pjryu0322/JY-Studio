/**
 * P4.2 — minimal typed error taxonomy for Worker Generation failures.
 * Distinguishes source problems (Inventory / provider action) from generation
 * problems (reprocess / correction).
 */

export type WorkerProblemCategory =
  | "SOURCE"
  | "PARSER"
  | "STRUCTURE"
  | "CHUNK"
  | "EMBEDDING"
  | "WORKER"
  | "QUALITY"
  | "IMPORT"
  | "UNKNOWN";

const SOURCE_CODES = new Set([
  "SOURCE_EMPTY",
  "SOURCE_CORRUPT",
  "SOURCE_ENCRYPTED",
  "SOURCE_ENCODING_ERROR",
  "SOURCE_UNREADABLE",
  "SOURCE_UNSUPPORTED",
  "ZERO_BYTE",
  "WORKER_CAPABILITY_MISMATCH",
]);

const PARSER_CODES = new Set(["PARSE_FAILED", "PARSER_FAILED", "DOCLING_FAILED"]);
const STRUCTURE_CODES = new Set(["STRUCTURE_INVALID", "STRUCTURE_FAILED"]);
const CHUNK_CODES = new Set([
  "CHUNK_TOO_LARGE",
  "CHUNK_TOO_SMALL",
  "CHUNK_EMBEDDING_MISSING",
  "CHUNK_GENERATION_REQUIRED",
]);
const EMBEDDING_CODES = new Set(["EMBEDDING_FAILED", "LOCAL_E5_FAILED"]);
const QUALITY_CODES = new Set(["QUALITY_REFRESH_FAILED"]);
const IMPORT_CODES = new Set([
  "PROVENANCE_RUN_MISMATCH",
  "PROVENANCE_WORKING_COPY_MISMATCH",
  "PROVENANCE_SOURCE_REVISION_MISMATCH",
  "PROVENANCE_INVENTORY_ITEM_MISMATCH",
  "WORKER_OUTPUT_INVALID",
  "VALIDATION_REPORT_NOT_OK",
]);
const WORKER_CODES = new Set([
  "WORKER_RUN_FAILED",
  "WORKER_RUN_TIMEOUT",
  "WORKER_INTERNAL_ERROR",
  "WORKER_ZIP_PIPELINE_ERROR",
  "WORKER_ZIP_PIPELINE_FAILED",
]);

export function categorizeWorkerProblemCode(code: string | null | undefined): WorkerProblemCategory {
  if (!code) return "UNKNOWN";
  if (SOURCE_CODES.has(code) || code.startsWith("SOURCE_")) return "SOURCE";
  if (PARSER_CODES.has(code) || code.startsWith("PARSE_")) return "PARSER";
  if (STRUCTURE_CODES.has(code) || code.startsWith("STRUCTURE_")) return "STRUCTURE";
  if (CHUNK_CODES.has(code) || code.startsWith("CHUNK_")) return "CHUNK";
  if (EMBEDDING_CODES.has(code) || code.startsWith("EMBEDDING_")) return "EMBEDDING";
  if (QUALITY_CODES.has(code) || code.startsWith("QUALITY_")) return "QUALITY";
  if (IMPORT_CODES.has(code) || code.startsWith("PROVENANCE_")) return "IMPORT";
  if (WORKER_CODES.has(code) || code.startsWith("WORKER_")) return "WORKER";
  return "UNKNOWN";
}

export function isSourceProblemCategory(category: WorkerProblemCategory): boolean {
  return category === "SOURCE";
}

export function isGenerationProblemCategory(category: WorkerProblemCategory): boolean {
  return (
    category === "PARSER" ||
    category === "STRUCTURE" ||
    category === "CHUNK" ||
    category === "EMBEDDING" ||
    category === "WORKER" ||
    category === "IMPORT" ||
    category === "QUALITY"
  );
}

/** Shared RAG Export package policy — used by Provider validation and Public ZIP export. */

export const RAG_EXPORT_POLICY_VERSION = "rag_export_v1" as const;
export const RAG_EXPORT_SCHEMA_VERSION = "jyk-rag-export/1.0" as const;

export const RAG_EXPORT_REQUIRED_FILES = [
  "manifest.json",
  "chunks.jsonl",
  "sources.json",
  "evaluation.json",
  "README.md",
  "checksums.sha256",
] as const;

export type RagExportRequiredFile = (typeof RAG_EXPORT_REQUIRED_FILES)[number];

export const RAG_EXPORT_FAIL_CODES = [
  "RAG_EXPORT_REQUIRED_FILE_MISSING",
  "RAG_EXPORT_MANIFEST_INVALID",
  "RAG_EXPORT_SCHEMA_UNSUPPORTED",
  "RAG_EXPORT_CHUNK_JSON_INVALID",
  "RAG_EXPORT_CHUNK_EMPTY",
  "RAG_EXPORT_DUPLICATE_CHUNK_ID",
  "RAG_EXPORT_SOURCE_TRACE_INVALID",
  "RAG_EXPORT_CHECKSUM_MISMATCH",
  "RAG_EXPORT_SOURCE_BINARY_INCLUDED",
  "RAG_EXPORT_VECTOR_INCLUDED_UNEXPECTEDLY",
  "RAG_EXPORT_BINDING_STALE",
  "RAG_EXPORT_BUILD_FAILED",
  "RAG_EXPORT_FINGERPRINT_MISMATCH",
] as const;

export type RagExportFailCode = (typeof RAG_EXPORT_FAIL_CODES)[number];

/** Fixed ZIP entry timestamp for more stable binary packaging. */
export const RAG_EXPORT_ZIP_EPOCH = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

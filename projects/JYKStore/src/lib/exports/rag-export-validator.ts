import JSZip from "jszip";
import { sha256Hex } from "@/lib/object-storage/checksum";
import {
  RAG_EXPORT_POLICY_VERSION,
  RAG_EXPORT_REQUIRED_FILES,
  RAG_EXPORT_SCHEMA_VERSION,
  type RagExportFailCode,
} from "@/lib/exports/rag-export-constants";

export type RagExportValidationResult = {
  valid: boolean;
  schemaVersion: string;
  policyVersion: string;
  requiredFilesPresent: boolean;
  manifestValid: boolean;
  chunksJsonlValid: boolean;
  sourceTraceValid: boolean;
  checksumsValid: boolean;
  chunkCount: number;
  sourceCount: number;
  issueCodes: RagExportFailCode[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pushIssue(issues: RagExportFailCode[], code: RagExportFailCode) {
  if (!issues.includes(code)) issues.push(code);
}

/**
 * Re-open ZIP entries and validate structure, schema, traces, and checksums.
 */
export async function validateRagExportZipBytes(
  zipBytes: Uint8Array,
): Promise<RagExportValidationResult> {
  const issueCodes: RagExportFailCode[] = [];
  let schemaVersion = "";
  let policyVersion = "";
  let requiredFilesPresent = true;
  let manifestValid = false;
  let chunksJsonlValid = false;
  let sourceTraceValid = true;
  let checksumsValid = false;
  let chunkCount = 0;
  let sourceCount = 0;

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBytes);
  } catch {
    return {
      valid: false,
      schemaVersion,
      policyVersion,
      requiredFilesPresent: false,
      manifestValid: false,
      chunksJsonlValid: false,
      sourceTraceValid: false,
      checksumsValid: false,
      chunkCount: 0,
      sourceCount: 0,
      issueCodes: ["RAG_EXPORT_BUILD_FAILED"],
    };
  }

  const entryNames = Object.keys(zip.files).filter((n) => !zip.files[n]?.dir);
  for (const name of entryNames) {
    if (name.includes("..") || name.startsWith("/") || name.includes("\\")) {
      pushIssue(issueCodes, "RAG_EXPORT_SOURCE_BINARY_INCLUDED");
    }
    const lower = name.toLowerCase();
    if (lower.endsWith(".pdf") || lower.endsWith(".docx") || lower.endsWith(".doc")) {
      pushIssue(issueCodes, "RAG_EXPORT_SOURCE_BINARY_INCLUDED");
    }
  }

  const texts: Record<string, string> = {};
  for (const required of RAG_EXPORT_REQUIRED_FILES) {
    const entry = zip.file(required);
    if (!entry) {
      requiredFilesPresent = false;
      pushIssue(issueCodes, "RAG_EXPORT_REQUIRED_FILE_MISSING");
      continue;
    }
    texts[required] = await entry.async("string");
  }

  const sourceIds = new Set<string>();

  if (requiredFilesPresent) {
    try {
      const manifest = JSON.parse(texts["manifest.json"] ?? "");
      const m = asRecord(manifest);
      schemaVersion = typeof m?.schemaVersion === "string" ? m.schemaVersion : "";
      policyVersion =
        typeof m?.exportPolicyVersion === "string" ? m.exportPolicyVersion : "";
      if (schemaVersion !== RAG_EXPORT_SCHEMA_VERSION) {
        pushIssue(issueCodes, "RAG_EXPORT_SCHEMA_UNSUPPORTED");
      }
      if (policyVersion !== RAG_EXPORT_POLICY_VERSION) {
        pushIssue(issueCodes, "RAG_EXPORT_SCHEMA_UNSUPPORTED");
      }
      const retrieval = asRecord(m?.retrieval);
      if (retrieval?.vectorsIncluded === true) {
        pushIssue(issueCodes, "RAG_EXPORT_VECTOR_INCLUDED_UNEXPECTEDLY");
      }
      const rights = asRecord(m?.rights);
      if (rights?.sourceFilesIncluded === true) {
        pushIssue(issueCodes, "RAG_EXPORT_SOURCE_BINARY_INCLUDED");
      }
      manifestValid =
        schemaVersion === RAG_EXPORT_SCHEMA_VERSION &&
        policyVersion === RAG_EXPORT_POLICY_VERSION &&
        retrieval?.vectorsIncluded === false &&
        rights?.sourceFilesIncluded === false;
      if (!manifestValid) pushIssue(issueCodes, "RAG_EXPORT_MANIFEST_INVALID");
    } catch {
      pushIssue(issueCodes, "RAG_EXPORT_MANIFEST_INVALID");
    }

    try {
      const sourcesDoc = JSON.parse(texts["sources.json"] ?? "");
      const sources = Array.isArray(asRecord(sourcesDoc)?.sources)
        ? (asRecord(sourcesDoc)!.sources as unknown[])
        : [];
      sourceCount = sources.length;
      for (const s of sources) {
        const rec = asRecord(s);
        if (typeof rec?.sourceId === "string") sourceIds.add(rec.sourceId);
        if (rec?.originalFileIncluded === true) {
          pushIssue(issueCodes, "RAG_EXPORT_SOURCE_BINARY_INCLUDED");
        }
      }
    } catch {
      sourceTraceValid = false;
      pushIssue(issueCodes, "RAG_EXPORT_SOURCE_TRACE_INVALID");
    }

    const chunkIds = new Set<string>();
    const lines = (texts["chunks.jsonl"] ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    chunkCount = lines.length;
    let chunksOk = lines.length > 0;
    for (const line of lines) {
      try {
        const row = JSON.parse(line);
        const rec = asRecord(row);
        if (!rec) {
          chunksOk = false;
          pushIssue(issueCodes, "RAG_EXPORT_CHUNK_JSON_INVALID");
          continue;
        }
        const chunkId = typeof rec.chunkId === "string" ? rec.chunkId : "";
        const content = typeof rec.content === "string" ? rec.content : "";
        if (!chunkId) {
          chunksOk = false;
          pushIssue(issueCodes, "RAG_EXPORT_CHUNK_JSON_INVALID");
        } else if (chunkIds.has(chunkId)) {
          chunksOk = false;
          pushIssue(issueCodes, "RAG_EXPORT_DUPLICATE_CHUNK_ID");
        } else {
          chunkIds.add(chunkId);
        }
        if (!content.trim()) {
          chunksOk = false;
          pushIssue(issueCodes, "RAG_EXPORT_CHUNK_EMPTY");
        }
        if ("embedding" in rec || "vector" in rec || "embeddingVector" in rec) {
          chunksOk = false;
          pushIssue(issueCodes, "RAG_EXPORT_VECTOR_INCLUDED_UNEXPECTEDLY");
        }
        const source = asRecord(rec.source);
        const sourceId = typeof source?.sourceId === "string" ? source.sourceId : "";
        if (!sourceId || !sourceIds.has(sourceId)) {
          sourceTraceValid = false;
          pushIssue(issueCodes, "RAG_EXPORT_SOURCE_TRACE_INVALID");
        }
        const pageStart = source?.pageStart;
        const pageEnd = source?.pageEnd;
        if (
          typeof pageStart === "number" &&
          typeof pageEnd === "number" &&
          pageStart > pageEnd
        ) {
          sourceTraceValid = false;
          pushIssue(issueCodes, "RAG_EXPORT_SOURCE_TRACE_INVALID");
        }
      } catch {
        chunksOk = false;
        pushIssue(issueCodes, "RAG_EXPORT_CHUNK_JSON_INVALID");
      }
    }
    chunksJsonlValid = chunksOk;

    try {
      JSON.parse(texts["evaluation.json"] ?? "");
    } catch {
      pushIssue(issueCodes, "RAG_EXPORT_MANIFEST_INVALID");
      manifestValid = false;
    }

    const expected: Record<string, string> = {};
    for (const name of RAG_EXPORT_REQUIRED_FILES) {
      if (name === "checksums.sha256") continue;
      expected[name] = sha256Hex(new TextEncoder().encode(texts[name] ?? ""));
    }
    const checksumLines = (texts["checksums.sha256"] ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    let checksumOk = checksumLines.length > 0;
    const listed = new Set<string>();
    for (const line of checksumLines) {
      const m = line.match(/^([a-f0-9]{64})\s{2}(.+)$/i);
      if (!m) {
        checksumOk = false;
        continue;
      }
      const hash = m[1]!.toLowerCase();
      const file = m[2]!;
      listed.add(file);
      if (expected[file] !== hash) checksumOk = false;
    }
    for (const name of Object.keys(expected)) {
      if (!listed.has(name)) checksumOk = false;
    }
    checksumsValid = checksumOk;
    if (!checksumOk) pushIssue(issueCodes, "RAG_EXPORT_CHECKSUM_MISMATCH");
  } else {
    sourceTraceValid = false;
  }

  if (sourceIds.size < 1) {
    sourceTraceValid = false;
    pushIssue(issueCodes, "RAG_EXPORT_SOURCE_TRACE_INVALID");
  }

  const valid =
    requiredFilesPresent &&
    manifestValid &&
    chunksJsonlValid &&
    sourceTraceValid &&
    checksumsValid &&
    issueCodes.length === 0;

  return {
    valid,
    schemaVersion,
    policyVersion,
    requiredFilesPresent,
    manifestValid,
    chunksJsonlValid,
    sourceTraceValid,
    checksumsValid,
    chunkCount,
    sourceCount,
    issueCodes,
  };
}

export async function validateRagExportPackage(pkg: {
  zipBytes?: Uint8Array;
}): Promise<RagExportValidationResult> {
  if (!pkg.zipBytes) {
    return {
      valid: false,
      schemaVersion: "",
      policyVersion: "",
      requiredFilesPresent: false,
      manifestValid: false,
      chunksJsonlValid: false,
      sourceTraceValid: false,
      checksumsValid: false,
      chunkCount: 0,
      sourceCount: 0,
      issueCodes: ["RAG_EXPORT_BUILD_FAILED"],
    };
  }
  return validateRagExportZipBytes(pkg.zipBytes);
}

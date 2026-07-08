export const DEFAULT_EXPORT_CHUNK_LIMIT_BYTES = 256_000;
export const MIN_EXPORT_CHUNK_LIMIT_BYTES = 1_024;
export const MAX_EXPORT_CHUNK_LIMIT_BYTES = 1_000_000;

export type ExportChunkKind = "package" | "rag-jsonl" | "graph";

export type ExportChunkRequest = {
  knowledgePackId: string;
  offset: number;
  limitBytes: number;
};

export type ExportChunkResponse = {
  knowledgePackId: string;
  exportType: ExportChunkKind;
  offset: number;
  limitBytes: number;
  nextOffset: number;
  hasMore: boolean;
  byteLength: number;
  totalBytes: number;
  mimeType: string;
  content: string;
};

export function exportChunkMimeType(exportType: ExportChunkKind): string {
  if (exportType === "rag-jsonl") return "application/x-ndjson";
  return "application/json";
}

function parseNonNegativeInt(
  raw: string | null,
  field: string,
  fallback: number,
): { ok: true; value: number } | { ok: false; error: string } {
  if (raw === null || raw === "") return { ok: true, value: fallback };
  if (!/^\d+$/.test(raw)) {
    return { ok: false, error: `${field} must be a non-negative integer.` };
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    return { ok: false, error: `${field} must be a non-negative integer.` };
  }
  return { ok: true, value };
}

export function parseExportChunkRequestFromSearchParams(
  searchParams: URLSearchParams,
): { ok: true; request: ExportChunkRequest } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const knowledgePackId = (searchParams.get("knowledgePackId") ?? "").trim();
  if (!knowledgePackId) {
    errors.push("knowledgePackId query parameter is required.");
  } else if (knowledgePackId.length > 100) {
    errors.push("knowledgePackId must be at most 100 characters.");
  }

  const offsetParsed = parseNonNegativeInt(searchParams.get("offset"), "offset", 0);
  if (!offsetParsed.ok) errors.push(offsetParsed.error);

  const limitRaw = searchParams.get("limitBytes");
  let limitBytes = DEFAULT_EXPORT_CHUNK_LIMIT_BYTES;
  if (limitRaw !== null && limitRaw !== "") {
    if (!/^\d+$/.test(limitRaw)) {
      errors.push("limitBytes must be an integer.");
    } else {
      limitBytes = Number(limitRaw);
      if (
        !Number.isInteger(limitBytes) ||
        limitBytes < MIN_EXPORT_CHUNK_LIMIT_BYTES ||
        limitBytes > MAX_EXPORT_CHUNK_LIMIT_BYTES
      ) {
        errors.push(
          `limitBytes must be between ${MIN_EXPORT_CHUNK_LIMIT_BYTES} and ${MAX_EXPORT_CHUNK_LIMIT_BYTES}.`,
        );
      }
    }
  }

  if (errors.length > 0 || !offsetParsed.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    request: {
      knowledgePackId,
      offset: offsetParsed.value,
      limitBytes,
    },
  };
}

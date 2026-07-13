import { sha256Hex } from "@/lib/distribution/payload-checksum";

export const NORMALIZED_DOCUMENT_FINGERPRINT_VERSION = "normalized-document-v2";

export type NormalizedDocumentFingerprintInput = {
  adapterType: string;
  adapterVersion: string;
  sourceSchemaName: string | null | undefined;
  sourceSchemaVersion: string | null | undefined;
  title: string | null | undefined;
  language: string | null | undefined;
  sections: unknown;
  tables: unknown;
  figures: unknown;
  readingOrder: unknown;
  warnings: unknown;
  sourceFileId: string;
  jsonPayloadFileId: string;
  markdownPayloadFileId: string;
  sourceChecksum: string;
  jsonChecksum: string;
  markdownChecksum: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Canonical JSON: sort object keys, preserve array order, drop undefined, keep null.
 */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item)).filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const next = canonicalize(value[key]);
      if (next !== undefined) {
        out[key] = next;
      }
    }
    return out;
  }
  return String(value);
}

export function buildNormalizedDocumentFingerprintPayload(
  input: NormalizedDocumentFingerprintInput,
): Record<string, unknown> {
  return {
    adapterType: input.adapterType,
    adapterVersion: input.adapterVersion,
    sourceSchemaName: input.sourceSchemaName ?? null,
    sourceSchemaVersion: input.sourceSchemaVersion ?? null,
    title: input.title ?? null,
    language: input.language ?? null,
    sections: input.sections ?? [],
    tables: input.tables ?? [],
    figures: input.figures ?? [],
    readingOrder: input.readingOrder ?? [],
    warnings: input.warnings ?? [],
    sourceFileId: input.sourceFileId,
    jsonPayloadFileId: input.jsonPayloadFileId,
    markdownPayloadFileId: input.markdownPayloadFileId,
    checksums: {
      source: input.sourceChecksum,
      json: input.jsonChecksum,
      markdown: input.markdownChecksum,
    },
  };
}

export function computeNormalizedDocumentFingerprint(
  input: NormalizedDocumentFingerprintInput,
): string {
  const payload = buildNormalizedDocumentFingerprintPayload(input);
  const canonical = canonicalJsonStringify(payload);
  return sha256Hex(new TextEncoder().encode(canonical));
}

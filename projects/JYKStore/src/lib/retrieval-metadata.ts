import {
  ALLOWED_FILTER_KEYS,
  FILTER_KEY_ALIASES,
  type CanonicalFilterKey,
} from "@/lib/retrieval-dto";

export type NormalizedChunkMetadata = Record<string, string | string[]>;

const SENSITIVE_METADATA_KEYS = [
  "token",
  "apikey",
  "api_key",
  "password",
  "secret",
  "hash",
  "authorization",
  "bearer",
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_METADATA_KEYS.some((item) => lower.includes(item));
}

export function validateAndNormalizeChunkMetadata(
  raw: unknown,
):
  | { ok: true; metadata: NormalizedChunkMetadata | null }
  | { ok: false; errors: string[] } {
  if (raw === undefined || raw === null) {
    return { ok: true, metadata: null };
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["metadata must be an object."] };
  }

  const errors: string[] = [];
  const out: NormalizedChunkMetadata = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      errors.push(`Sensitive metadata key is not allowed: ${key}`);
      continue;
    }
    if (!ALLOWED_FILTER_KEYS.has(key)) {
      errors.push(`Unknown metadata key: ${key}`);
      continue;
    }

    if (value === undefined || value === null || value === "") {
      continue;
    }

    const canonicalKey = (FILTER_KEY_ALIASES[key] ?? key) as CanonicalFilterKey;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) out[canonicalKey] = trimmed;
      continue;
    }

    if (Array.isArray(value)) {
      if (value.some((item) => typeof item !== "string")) {
        errors.push(`Metadata value for '${key}' must be a string or string[].`);
        continue;
      }
      const arr = value.map((item) => (item as string).trim()).filter(Boolean);
      if (arr.length > 0) out[canonicalKey] = arr;
      continue;
    }

    errors.push(`Metadata value for '${key}' must be a string or string[].`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, metadata: Object.keys(out).length > 0 ? out : null };
}

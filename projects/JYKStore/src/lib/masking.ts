const SENSITIVE_FIELD_KEYS = [
  "authorization",
  "apikey",
  "api_key",
  "token",
  "bearer",
  "secret",
  "password",
  "hash",
];

export function maskNullable(
  value: string | null | undefined,
  visibleStart = 4,
  visibleEnd = 2,
): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (trimmed.length <= visibleStart + visibleEnd) {
    return `${trimmed.slice(0, 1)}***`;
  }
  const start = trimmed.slice(0, visibleStart);
  const end = visibleEnd > 0 ? trimmed.slice(-visibleEnd) : "";
  return `${start}***${end}`;
}

export function maskId(value: string | null | undefined): string {
  return maskNullable(value, 6, 2);
}

export function truncateText(value: string | null | undefined, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

export function sanitizeMetadata(metadata: unknown): unknown {
  if (metadata === null || metadata === undefined) return metadata;
  if (Array.isArray(metadata)) {
    return metadata.map((item) => sanitizeMetadata(item));
  }
  if (typeof metadata === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
      const normalized = key.toLowerCase();
      const sensitive = SENSITIVE_FIELD_KEYS.some((item) => normalized.includes(item));
      if (sensitive) {
        result[key] = "[REDACTED]";
        continue;
      }
      result[key] = sanitizeMetadata(value);
    }
    return result;
  }
  return metadata;
}

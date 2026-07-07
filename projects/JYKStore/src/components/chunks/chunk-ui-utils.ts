export const METADATA_PLACEHOLDER = `{
  "documentType": "SAMPLE_CODE",
  "programmingLanguage": "Java",
  "framework": "Spring Boot",
  "securityLevel": "PUBLIC"
}`;

export function parseTagsText(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

export function parseMetadataText(
  value: string,
): { ok: true; metadata: Record<string, unknown> | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, metadata: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "metadata JSON을 파싱하지 못했습니다." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "metadata는 JSON object여야 합니다." };
  }
  return { ok: true, metadata: parsed as Record<string, unknown> };
}

export function formatMetadataSummary(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "";
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join("/") : String(value)}`)
    .join(" · ");
}

export type RoleDraftContentItem = Readonly<{
  readonly label: string;
  readonly value: string;
  readonly fallback: string;
}>;

function normalizeInlineText(raw: string): string {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/^[-*•]\s+/, ""))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Comma-separated inline list from bullet lines or string array. */
const LABEL_ONLY_LINE = /^(MVP 기능 후보|핵심 기능 후보|주요 화면 후보)$/i;

export function formatRoleDraftInlineList(items: readonly string[], fallback: string): string {
  const parts = items
    .map((item) => normalizeInlineText(item))
    .filter((part) => part && !LABEL_ONLY_LINE.test(part));
  return parts.length ? parts.join(", ") : fallback;
}

/** Role section body: one line per label, deduped labels, no empty bullets. */
export function buildRoleDraftContent(items: readonly RoleDraftContentItem[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const item of items) {
    const label = item.label.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const value = normalizeInlineText(item.value) || normalizeInlineText(item.fallback);
    if (!value) continue;
    lines.push(`- ${label}: ${value}`);
  }
  return lines.join("\n");
}

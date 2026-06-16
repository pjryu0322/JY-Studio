const FENCED_CODE_BLOCK_RE = /```[\s\S]*?```/g;

/** Root class for chat bubble markdown (not document viewers). */
export const REQUIREMENTS_CHAT_MESSAGE_MARKDOWN_CLASS = "jyo-requirements-md messageMarkdown";

export function normalizeTextOutsideCodeBlocks(chunk: string): string {
  let out = chunk.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");
  out = out.replace(/(:)\n\n(?=\s*[-*•]\s+)/g, "$1\n");

  for (let i = 0; i < 32; i += 1) {
    const next = out
      .replace(/(\n\s*[-*•]\s+[^\n]+)\n\n(?=\s*[-*•]\s+)/g, "$1\n")
      .replace(/(^\s*[-*•]\s+[^\n]+)\n\n(?=\s*[-*•]\s+)/gm, "$1\n")
      .replace(/(\n\s*\d+[.)]\s+[^\n]+)\n\n(?=\s*\d+[.)]\s+)/g, "$1\n")
      .replace(/(^\s*\d+[.)]\s+[^\n]+)\n\n(?=\s*\d+[.)]\s+)/gm, "$1\n");
    if (next === out) break;
    out = next;
  }

  return out.trim();
}

/**
 * Collapse excessive blank lines outside fenced code blocks; trim edges.
 * Preserves newlines inside ``` fenced blocks.
 */
export function normalizeUserVisibleMessageText(text: string): string {
  const raw = String(text ?? "");
  if (!raw) return "";

  const placeholders: string[] = [];
  const masked = raw.replace(FENCED_CODE_BLOCK_RE, (block) => {
    const key = `\u0000CODEBLOCK_${placeholders.length}\u0000`;
    placeholders.push(block);
    return key;
  });

  let normalized = normalizeTextOutsideCodeBlocks(masked);
  for (let i = 0; i < placeholders.length; i += 1) {
    normalized = normalized.replace(`\u0000CODEBLOCK_${i}\u0000`, placeholders[i] ?? "");
  }
  return normalized;
}

export function formatCompactBulletSection(title: string, items: readonly string[]): string {
  const cleanItems = items
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => (x.startsWith("- ") ? x.slice(2).trim() : x));
  if (!cleanItems.length) return "";
  const heading = title.endsWith(":") ? title : `${title}:`;
  return normalizeUserVisibleMessageText([heading, ...cleanItems.map((x) => `- ${x}`)].join("\n"));
}

export function joinUserVisibleMessageSections(sections: readonly string[]): string {
  const merged = sections
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n");
  return normalizeUserVisibleMessageText(merged);
}

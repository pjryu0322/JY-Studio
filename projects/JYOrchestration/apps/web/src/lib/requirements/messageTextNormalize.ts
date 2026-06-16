const FENCED_CODE_BLOCK_RE = /```[\s\S]*?```/g;

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

  let normalized = masked.replace(/\n{3,}/g, "\n\n").trim();
  for (let i = 0; i < placeholders.length; i += 1) {
    normalized = normalized.replace(`\u0000CODEBLOCK_${i}\u0000`, placeholders[i] ?? "");
  }
  return normalized;
}

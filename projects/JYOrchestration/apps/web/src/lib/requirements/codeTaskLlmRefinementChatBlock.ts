const BLOCK_TITLE = "CodeTask LLM 정제:";
const TOTAL_LINE_PREFIX = "- 전체 CodeTask:";

export type CodeTaskLlmRefinementChatBlockParts = Readonly<{
  readonly prefix: string;
  readonly title: string;
  readonly lines: readonly string[];
  readonly suffix: string;
}>;

export function isCodeTaskTotalCountSummaryLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith(TOTAL_LINE_PREFIX);
}

export function splitMessageContentForCodeTaskLlmRefinementBlock(
  content: string,
): CodeTaskLlmRefinementChatBlockParts | null {
  const text = String(content ?? "")
    .replace(/\*\*CodeTask LLM 정제:\*\*/g, BLOCK_TITLE)
    .replace(/\*\*CodeTask LLM 정제\*\*/g, BLOCK_TITLE.replace(":", ""));
  const startIdx = text.indexOf(BLOCK_TITLE);
  if (startIdx < 0) return null;

  const afterTitle = text.slice(startIdx + BLOCK_TITLE.length);
  const endIdxImplement = afterTitle.indexOf("\n\n구현 작업목록:");
  const endIdxNext = afterTitle.indexOf("\n\n다음 작업");
  let endRel = afterTitle.length;
  if (endIdxImplement >= 0) endRel = Math.min(endRel, endIdxImplement);
  if (endIdxNext >= 0) endRel = Math.min(endRel, endIdxNext);

  const blockBody = afterTitle.slice(0, endRel);
  const lines = blockBody
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l, i) => i > 0 || l.trim().length > 0);

  const prefix = text.slice(0, startIdx).trimEnd();
  const suffix = afterTitle.slice(endRel).trimStart();

  return {
    prefix,
    title: BLOCK_TITLE,
    lines,
    suffix,
  };
}

import { detectHeading } from "./rules/headingPatterns";
import {
  buildTableStruct,
  detectTableCaption,
  isTableLikeLine,
} from "./rules/tables";
import type { Block, TableStruct } from "./types";

const LIST_PATTERNS: RegExp[] = [
  /^[-*•]\s+/,
  /^\d+[.)]\s+/,
  /^(가|나|다|라)\.\s+/,
  /^(①|②|③|④|⑤)\s+/,
  /^\(\d+\)\s+/,
];

function estimateListDepth(text: string): number {
  const leadingSpaces = text.match(/^\s*/)?.[0].length ?? 0;
  return Math.max(0, Math.floor(leadingSpaces / 2));
}

export interface DocumentBuildResult {
  blocks: Block[];
  tables: TableStruct[];
}

function isListItem(text: string): boolean {
  return LIST_PATTERNS.some((rx) => rx.test(text));
}

function isFigureCaption(text: string): boolean {
  return /^(그림|도표|figure)\s*\d+/i.test(text);
}

export function buildDocumentBlocks(text: string): DocumentBuildResult {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  const tables: TableStruct[] = [];
  let paraBuffer: string[] = [];
  let idx = 0;
  let tableIndex = 0;
  let pendingCaption: string | undefined;

  const pushParagraph = () => {
    const paragraph = paraBuffer.join(" ").trim();
    paraBuffer = [];
    if (!paragraph) return;
    blocks.push({
      id: `b${idx}`,
      type: "paragraph",
      text: paragraph,
      blockIndex: idx,
    });
    idx += 1;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) {
      pushParagraph();
      continue;
    }

    const heading = detectHeading(line);
    if (heading.isHeading) {
      pushParagraph();
      blocks.push({
        id: `b${idx}`,
        type: "heading",
        text: heading.normalized,
        level: heading.level,
        blockIndex: idx,
      });
      idx += 1;
      continue;
    }

    if (isFigureCaption(line)) {
      pushParagraph();
      blocks.push({
        id: `b${idx}`,
        type: "figure_caption",
        text: line,
        blockIndex: idx,
      });
      pendingCaption = line;
      idx += 1;
      continue;
    }

    if (isTableLikeLine(line)) {
      pushParagraph();
      const tableLines: string[] = [line];
      while (i + 1 < lines.length && isTableLikeLine(lines[i + 1].trim())) {
        i += 1;
        tableLines.push(lines[i].trim());
      }
      const autoCaption = detectTableCaption(lines[i + 1]?.trim() ?? "");
      if (!pendingCaption && autoCaption) {
        pendingCaption = autoCaption;
      }
      const tableId = `t${tableIndex}`;
      const tableStruct = buildTableStruct(tableId, tableLines, pendingCaption);
      tables.push(tableStruct);
      blocks.push({
        id: `b${idx}`,
        type: "table",
        text: tableStruct.rowsText.join("\n"),
        tableId,
        tableStruct,
        blockIndex: idx,
      });
      pendingCaption = undefined;
      tableIndex += 1;
      idx += 1;
      continue;
    }

    if (isListItem(line)) {
      pushParagraph();
      blocks.push({
        id: `b${idx}`,
        type: "list_item",
        text: line,
        depth: estimateListDepth(rawLine),
        blockIndex: idx,
      });
      idx += 1;
      continue;
    }

    paraBuffer.push(line);
  }

  pushParagraph();
  return { blocks, tables };
}

export function buildBlocksFromText(text: string): Block[] {
  return buildDocumentBlocks(text).blocks;
}


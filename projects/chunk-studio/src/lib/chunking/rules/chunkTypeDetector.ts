import type { Block } from "@/lib/chunking/types";
import { detectHeading } from "./headingPatterns";

export type SemanticChunkType =
  | "section"
  | "paragraph"
  | "table"
  | "repeat_item"
  | "list";

const NUMBERED_TITLE_RX = /^(\d+(\.\d+){0,3}|제\s*\d+\s*(장|절|조))\s*/;
const BULLET_LIST_RX = /^(\-|\*|•|·)\s+/;
const NUMBER_LIST_RX = /^(\d+[.)]|\(\d+\)|[①-⑩])\s+/;

export function detectChunkType(block: Block): SemanticChunkType {
  if (block.type === "table" || block.tableStruct) {
    return "table";
  }

  const text = block.text?.trim() ?? "";
  const heading = detectHeading(text);
  if (block.type === "heading" || heading.isHeading || NUMBERED_TITLE_RX.test(text)) {
    return "section";
  }

  if (block.type === "list_item" && NUMBER_LIST_RX.test(text)) {
    return "repeat_item";
  }

  if (block.type === "list_item" || BULLET_LIST_RX.test(text) || NUMBER_LIST_RX.test(text)) {
    return "list";
  }

  return "paragraph";
}

import type { Chunk } from "@/lib/chunking/types";

const PAGE_NUMBER_RX = /^\s*\d+\s*$/;
const FOOTER_HINT_RX =
  /^(page|페이지)\s*\d+|copyright|all rights reserved|confidential|무단(복제|배포)|저작권/i;

function symbolRatio(text: string): number {
  if (!text) return 0;
  const symbolMatches = text.match(/[^\p{L}\p{N}\s]/gu) ?? [];
  return symbolMatches.length / text.length;
}

export function isNoiseChunk(chunk: Chunk): boolean {
  const text = (chunk.text ?? "").trim();
  if (!text) return true;

  if (text.length < 10) return true;
  if (PAGE_NUMBER_RX.test(text)) return true;

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 1 && lines[0] && lines[0].length <= 24 && FOOTER_HINT_RX.test(lines[0])) {
    return true;
  }

  if (symbolRatio(text) >= 0.45) return true;
  if (chunk.meta.quality.warnings.includes("HEADER_NOISE")) return true;
  return false;
}

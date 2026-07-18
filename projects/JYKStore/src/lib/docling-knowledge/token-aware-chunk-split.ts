/**
 * Token-aware Retrieval Chunk splitters.
 * Final passage = buildPassageEmbeddingText({ title, section, tags, content }).
 * Budgets use the real Local E5 tokenizer via PassageTokenCounter.
 */

import {
  E5_MAX_SEQUENCE_TOKENS,
  E5_OVERLAP_TOKENS,
  E5_TARGET_PASSAGE_TOKENS,
} from "@/lib/embedding/e5-embedding-constants";
import { buildPassageEmbeddingText } from "@/lib/embedding/e5-embedding-text";
import type { PassageTokenCounter } from "@/lib/embedding/e5-tokenize-client";
import { fixLoneSurrogates, sliceUtf16Safe } from "@/lib/text-encoding-safe";

export type TokenAwareSplitPiece = {
  content: string;
  tokenCount: number;
  splitIndex: number;
  splitCount: number;
  overlapTokens: number;
  splitSourceId?: string;
  sourceTextStart?: number;
  sourceTextEnd?: number;
};

export type TokenAwareSplitOptions = {
  title: string;
  section?: string | null;
  tags?: string[];
  countTokens: PassageTokenCounter;
  targetPassageTokens?: number;
  maxSequenceTokens?: number;
  overlapTokens?: number;
  splitSourceId?: string;
  sourceTextStart?: number;
};

function sentenceBoundaries(text: string): number[] {
  const ends: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if ("。.！!？?\n".includes(ch)) {
      ends.push(i + 1);
    }
  }
  if (ends[ends.length - 1] !== text.length) ends.push(text.length);
  return ends;
}

function listItemBoundaries(text: string): number[] {
  const lines = text.split("\n");
  const ends: number[] = [0];
  let cursor = 0;
  for (const line of lines) {
    cursor += line.length;
    if (text[cursor] === "\n") cursor += 1;
    ends.push(cursor);
  }
  if (ends[ends.length - 1] !== text.length) ends.push(text.length);
  return [...new Set(ends)].sort((a, b) => a - b);
}

async function countOne(counter: PassageTokenCounter, text: string): Promise<number> {
  const [n] = await counter([text]);
  return n ?? 0;
}

async function passageTokens(
  counter: PassageTokenCounter,
  meta: { title: string; section?: string | null; tags?: string[] },
  content: string,
): Promise<number> {
  return countOne(counter, buildPassageEmbeddingText({ ...meta, content }));
}

/**
 * Binary-search the longest UTF-16-safe prefix of `content` whose full passage
 * stays within `budget` tokens.
 */
async function longestPrefixWithinBudget(
  content: string,
  meta: { title: string; section?: string | null; tags?: string[] },
  counter: PassageTokenCounter,
  budget: number,
): Promise<{ prefix: string; tokenCount: number }> {
  if (!content) return { prefix: "", tokenCount: await passageTokens(counter, meta, "") };
  const full = await passageTokens(counter, meta, content);
  if (full <= budget) return { prefix: content, tokenCount: full };

  let lo = 0;
  let hi = content.length;
  let best = "";
  let bestTokens = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = sliceUtf16Safe(content, mid).trimEnd();
    if (!candidate) {
      lo = mid + 1;
      continue;
    }
    const tokens = await passageTokens(counter, meta, candidate);
    if (tokens <= budget) {
      best = candidate;
      bestTokens = tokens;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (!best) {
    // Single grapheme may still exceed; return smallest safe slice for progress.
    const tiny = sliceUtf16Safe(content, Math.min(8, content.length));
    return { prefix: tiny, tokenCount: await passageTokens(counter, meta, tiny) };
  }
  return { prefix: best, tokenCount: bestTokens };
}

async function overlapPrefix(
  previous: string,
  meta: { title: string; section?: string | null; tags?: string[] },
  counter: PassageTokenCounter,
  overlapTokens: number,
): Promise<string> {
  if (!previous || overlapTokens <= 0) return "";
  // Take a tail window and shrink until overlap budget fits as a passage fragment.
  let lo = 0;
  let hi = previous.length;
  let best = "";
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = fixLoneSurrogates(previous.slice(Math.max(0, previous.length - mid)).trim());
    if (!candidate) {
      lo = mid + 1;
      continue;
    }
    const tokens = await passageTokens(counter, meta, candidate);
    if (tokens <= overlapTokens) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function preferCut(text: string, maxLen: number, boundaries: number[]): number {
  if (text.length <= maxLen) return text.length;
  let best = 0;
  for (const b of boundaries) {
    if (b > 0 && b <= maxLen) best = b;
  }
  if (best > 0) return best;
  // punctuation / whitespace fallback inside window
  for (let i = maxLen; i > Math.floor(maxLen * 0.5); i--) {
    const ch = text[i - 1]!;
    if ("。.！!？?;；,，、)）]】 \t".includes(ch)) return i;
  }
  return maxLen;
}

export async function splitBodyContentByTokens(input: {
  content: string;
  title: string;
  section?: string | null;
  tags?: string[];
  countTokens: PassageTokenCounter;
  targetPassageTokens?: number;
  maxSequenceTokens?: number;
  overlapTokens?: number;
  splitSourceId?: string;
  sourceTextStart?: number;
}): Promise<TokenAwareSplitPiece[]> {
  const target = input.targetPassageTokens ?? E5_TARGET_PASSAGE_TOKENS;
  const hard = input.maxSequenceTokens ?? E5_MAX_SEQUENCE_TOKENS;
  const overlapTokens = input.overlapTokens ?? E5_OVERLAP_TOKENS;
  const meta = { title: input.title, section: input.section, tags: input.tags };
  const sourceStart = input.sourceTextStart ?? 0;
  const content = fixLoneSurrogates(input.content);
  if (!content.trim()) return [];

  const fullTokens = await passageTokens(input.countTokens, meta, content);
  if (fullTokens <= target) {
    return [
      {
        content,
        tokenCount: fullTokens,
        splitIndex: 0,
        splitCount: 1,
        overlapTokens: 0,
        splitSourceId: input.splitSourceId,
        sourceTextStart: sourceStart,
        sourceTextEnd: sourceStart + content.length,
      },
    ];
  }

  const pieces: Array<{ content: string; tokenCount: number; start: number; end: number; overlap: number }> =
    [];
  let remaining = content;
  let cursor = 0;
  let guard = 0;
  while (remaining.trim().length > 0 && guard < 10_000) {
    guard += 1;
    const boundaries = [
      ...sentenceBoundaries(remaining),
      ...listItemBoundaries(remaining),
    ].sort((a, b) => a - b);

    const { prefix: rawPrefix, tokenCount } = await longestPrefixWithinBudget(
      remaining,
      meta,
      input.countTokens,
      target,
    );
    let cut = preferCut(remaining, rawPrefix.length || remaining.length, boundaries);
    if (cut <= 0) cut = rawPrefix.length || Math.min(remaining.length, 1);
    let piece = fixLoneSurrogates(sliceUtf16Safe(remaining, cut).trim());
    if (!piece) {
      piece = fixLoneSurrogates(sliceUtf16Safe(remaining, Math.min(remaining.length, 16)).trim());
      if (!piece) break;
      cut = piece.length;
    }

    let tokens = await passageTokens(input.countTokens, meta, piece);
    if (tokens > target) {
      const safe = await longestPrefixWithinBudget(piece, meta, input.countTokens, target);
      piece = safe.prefix;
      tokens = safe.tokenCount;
      cut = Math.min(cut, piece.length);
    }
    if (tokens > hard) {
      const safe = await longestPrefixWithinBudget(piece, meta, input.countTokens, target);
      piece = safe.prefix;
      tokens = safe.tokenCount;
      cut = piece.length;
      if (!piece || tokens > hard) {
        throw new Error(
          `TOKEN_SPLIT_FAILED: unable to fit passage under ${hard} tokens (got ${tokens})`,
        );
      }
    }

    const start = sourceStart + cursor;
    const end = start + cut;
    const overlap =
      pieces.length > 0
        ? await overlapPrefix(pieces[pieces.length - 1]!.content, meta, input.countTokens, overlapTokens)
        : "";
    let finalContent = piece;
    let finalTokens = tokens;
    if (overlap && pieces.length > 0) {
      const withOverlap = fixLoneSurrogates(`${overlap}\n${piece}`.trim());
      const overlapTokenCount = await passageTokens(input.countTokens, meta, withOverlap);
      if (overlapTokenCount <= target) {
        finalContent = withOverlap;
        finalTokens = overlapTokenCount;
      }
    }
    // Final guard: never emit a piece above target when a shorter prefix fits.
    if (finalTokens > target) {
      const safe = await longestPrefixWithinBudget(finalContent, meta, input.countTokens, target);
      if (safe.prefix && safe.tokenCount <= target) {
        finalContent = safe.prefix;
        finalTokens = safe.tokenCount;
        cut = Math.min(cut, safe.prefix.length);
      }
    }

    pieces.push({
      content: finalContent,
      tokenCount: finalTokens,
      start,
      end,
      overlap: pieces.length > 0 ? overlapTokens : 0,
    });
    remaining = remaining.slice(cut).trimStart();
    cursor += cut;
    // Advance past consumed whitespace that trimStart removed from remaining vs original.
    while (
      cursor < content.length &&
      remaining.length > 0 &&
      content[cursor] !== remaining[0] &&
      /\s/.test(content[cursor]!)
    ) {
      cursor += 1;
    }
    if (cut === 0) break;
  }

  const splitCount = pieces.length;
  return pieces.map((p, index) => ({
    content: p.content,
    tokenCount: p.tokenCount,
    splitIndex: index,
    splitCount,
    overlapTokens: p.overlap,
    splitSourceId: input.splitSourceId,
    sourceTextStart: p.start,
    sourceTextEnd: p.end,
  }));
}

export async function splitTableRowsByTokens(input: {
  caption: string;
  headers: string[];
  rows: string[][];
  title: string;
  section?: string | null;
  tags?: string[];
  countTokens: PassageTokenCounter;
  formatTableChunk: (caption: string, headers: string[], rows: string[][]) => string;
  targetPassageTokens?: number;
  maxSequenceTokens?: number;
  splitSourceId?: string;
}): Promise<TokenAwareSplitPiece[]> {
  const target = input.targetPassageTokens ?? E5_TARGET_PASSAGE_TOKENS;
  const hard = input.maxSequenceTokens ?? E5_MAX_SEQUENCE_TOKENS;
  const meta = { title: input.title, section: input.section, tags: input.tags };
  const rows = input.rows;
  if (rows.length === 0) {
    const content = input.formatTableChunk(input.caption, input.headers, [[]]);
    const tokenCount = await passageTokens(input.countTokens, meta, content);
    return [
      {
        content,
        tokenCount,
        splitIndex: 0,
        splitCount: 1,
        overlapTokens: 0,
        splitSourceId: input.splitSourceId,
      },
    ];
  }

  const groups: string[][][] = [];
  let current: string[][] = [];

  const flush = () => {
    if (current.length > 0) {
      groups.push(current);
      current = [];
    }
  };

  for (const row of rows) {
    const candidate = [...current, row];
    const content = input.formatTableChunk(input.caption, input.headers, candidate);
    const tokens = await passageTokens(input.countTokens, meta, content);
    if (tokens <= target || current.length === 0) {
      if (tokens > hard && current.length === 0) {
        // Single row exceeds hard limit — split row cells into sentence pieces.
        const rowText = row.join(" | ");
        const parts = await splitBodyContentByTokens({
          content: rowText,
          title: input.title,
          section: input.section,
          tags: input.tags,
          countTokens: input.countTokens,
          targetPassageTokens: target,
          maxSequenceTokens: hard,
          splitSourceId: input.splitSourceId,
        });
        for (const part of parts) {
          groups.push([[part.content]]);
        }
        continue;
      }
      current = candidate;
      if (tokens > target && current.length > 1) {
        current = current.slice(0, -1);
        flush();
        current = [row];
      }
    } else {
      flush();
      current = [row];
    }
  }
  flush();

  const pieces: TokenAwareSplitPiece[] = [];
  for (let i = 0; i < groups.length; i++) {
    const content = input.formatTableChunk(input.caption, input.headers, groups[i]!);
    const tokenCount = await passageTokens(input.countTokens, meta, content);
    if (tokenCount > hard) {
      throw new Error(
        `TOKEN_SPLIT_FAILED: table chunk exceeds ${hard} tokens (got ${tokenCount})`,
      );
    }
    pieces.push({
      content,
      tokenCount,
      splitIndex: i,
      splitCount: groups.length,
      overlapTokens: 0,
      splitSourceId: input.splitSourceId,
    });
  }
  return pieces;
}

export type PassageTokenGateSummary = {
  totalChunks: number;
  validatedChunks: number;
  maxTokenCount: number;
  averageTokenCount: number;
  withinTargetCount: number;
  targetExceededCount: number;
  hardLimitExceededCount: number;
  targetPassageTokens: number;
  maxSequenceTokens: number;
  model: string;
  revision: string;
};

export async function evaluatePassageTokenGate(input: {
  passages: string[];
  countTokens: PassageTokenCounter;
  targetPassageTokens?: number;
  maxSequenceTokens?: number;
  model: string;
  revision: string;
}): Promise<PassageTokenGateSummary> {
  const target = input.targetPassageTokens ?? E5_TARGET_PASSAGE_TOKENS;
  const hard = input.maxSequenceTokens ?? E5_MAX_SEQUENCE_TOKENS;
  const counts = input.passages.length === 0 ? [] : await input.countTokens(input.passages);
  const totalChunks = counts.length;
  let maxTokenCount = 0;
  let sum = 0;
  let withinTargetCount = 0;
  let targetExceededCount = 0;
  let hardLimitExceededCount = 0;
  for (const n of counts) {
    maxTokenCount = Math.max(maxTokenCount, n);
    sum += n;
    if (n <= target) withinTargetCount += 1;
    else if (n <= hard) targetExceededCount += 1;
    else hardLimitExceededCount += 1;
  }
  return {
    totalChunks,
    validatedChunks: totalChunks,
    maxTokenCount,
    averageTokenCount: totalChunks > 0 ? sum / totalChunks : 0,
    withinTargetCount,
    targetExceededCount,
    hardLimitExceededCount,
    targetPassageTokens: target,
    maxSequenceTokens: hard,
    model: input.model,
    revision: input.revision,
  };
}

export function passageTokenGateStatus(
  summary: PassageTokenGateSummary,
): "PASS" | "WARNING" | "FAIL" {
  if (summary.totalChunks < 1) return "FAIL";
  if (summary.hardLimitExceededCount > 0) return "FAIL";
  if (summary.validatedChunks !== summary.totalChunks) return "FAIL";
  if (summary.maxTokenCount > summary.maxSequenceTokens) return "FAIL";
  if (summary.targetExceededCount > 0 || summary.maxTokenCount > summary.targetPassageTokens) {
    return "WARNING";
  }
  return "PASS";
}

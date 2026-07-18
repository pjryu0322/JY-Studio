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
  /** Full passage body stored on the chunk (may include overlap prefix). */
  content: string;
  /** Primary content newly consumed from the source (overlap excluded). */
  primaryContent: string;
  tokenCount: number;
  splitIndex: number;
  splitCount: number;
  /** @deprecated Prefer actualOverlapTokens — kept as configured budget for compat. */
  overlapTokens: number;
  configuredOverlapTokens: number;
  actualOverlapTokens: number;
  hasOverlap: boolean;
  splitSourceId?: string;
  primarySourceTextStart: number;
  primarySourceTextEnd: number;
  overlapSourceTextStart: number | null;
  overlapSourceTextEnd: number | null;
  /** Compat aliases = primary range. */
  sourceTextStart: number;
  sourceTextEnd: number;
  /** Table continuation metadata (optional). */
  tableMeta?: Record<string, unknown>;
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
    const tiny = sliceUtf16Safe(content, Math.min(8, content.length));
    return { prefix: tiny, tokenCount: await passageTokens(counter, meta, tiny) };
  }
  return { prefix: best, tokenCount: bestTokens };
}

/**
 * Select a tail of `previousPrimary` within overlap token budget.
 * Returns the overlap string and its source offsets within the absolute source timeline.
 */
async function selectOverlapTail(input: {
  previousPrimary: string;
  previousPrimaryStart: number;
  previousPrimaryEnd: number;
  meta: { title: string; section?: string | null; tags?: string[] };
  counter: PassageTokenCounter;
  overlapTokens: number;
}): Promise<{
  text: string;
  actualOverlapTokens: number;
  overlapSourceTextStart: number | null;
  overlapSourceTextEnd: number | null;
}> {
  const { previousPrimary, previousPrimaryStart, previousPrimaryEnd, meta, counter, overlapTokens } =
    input;
  if (!previousPrimary || overlapTokens <= 0) {
    return {
      text: "",
      actualOverlapTokens: 0,
      overlapSourceTextStart: null,
      overlapSourceTextEnd: null,
    };
  }
  let lo = 0;
  let hi = previousPrimary.length;
  let best = "";
  let bestTokens = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = fixLoneSurrogates(
      previousPrimary.slice(Math.max(0, previousPrimary.length - mid)).trim(),
    );
    if (!candidate) {
      lo = mid + 1;
      continue;
    }
    const tokens = await passageTokens(counter, meta, candidate);
    if (tokens <= overlapTokens) {
      best = candidate;
      bestTokens = tokens;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (!best) {
    return {
      text: "",
      actualOverlapTokens: 0,
      overlapSourceTextStart: null,
      overlapSourceTextEnd: null,
    };
  }
  const startInPrimary = previousPrimary.lastIndexOf(best);
  const overlapStart =
    startInPrimary >= 0 ? previousPrimaryStart + startInPrimary : previousPrimaryEnd - best.length;
  return {
    text: best,
    actualOverlapTokens: bestTokens,
    overlapSourceTextStart: Math.max(previousPrimaryStart, overlapStart),
    overlapSourceTextEnd: previousPrimaryEnd,
  };
}

function preferCut(text: string, maxLen: number, boundaries: number[]): number {
  if (text.length <= maxLen) return text.length;
  let best = 0;
  for (const b of boundaries) {
    if (b > 0 && b <= maxLen) best = b;
  }
  if (best > 0) return best;
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
  const configuredOverlap = input.overlapTokens ?? E5_OVERLAP_TOKENS;
  const meta = { title: input.title, section: input.section, tags: input.tags };
  const sourceStart = input.sourceTextStart ?? 0;
  const content = fixLoneSurrogates(input.content);
  if (!content.trim()) return [];

  const fullTokens = await passageTokens(input.countTokens, meta, content);
  if (fullTokens <= target) {
    return [
      {
        content,
        primaryContent: content,
        tokenCount: fullTokens,
        splitIndex: 0,
        splitCount: 1,
        overlapTokens: 0,
        configuredOverlapTokens: configuredOverlap,
        actualOverlapTokens: 0,
        hasOverlap: false,
        splitSourceId: input.splitSourceId,
        primarySourceTextStart: sourceStart,
        primarySourceTextEnd: sourceStart + content.length,
        overlapSourceTextStart: null,
        overlapSourceTextEnd: null,
        sourceTextStart: sourceStart,
        sourceTextEnd: sourceStart + content.length,
      },
    ];
  }

  type Acc = {
    content: string;
    primaryContent: string;
    tokenCount: number;
    primaryStart: number;
    primaryEnd: number;
    actualOverlapTokens: number;
    hasOverlap: boolean;
    overlapSourceTextStart: number | null;
    overlapSourceTextEnd: number | null;
  };
  const pieces: Acc[] = [];
  let remaining = content;
  let cursor = 0;
  let guard = 0;

  while (remaining.trim().length > 0 && guard < 10_000) {
    guard += 1;
    const boundaries = [
      ...sentenceBoundaries(remaining),
      ...listItemBoundaries(remaining),
    ].sort((a, b) => a - b);

    const { prefix: rawPrefix } = await longestPrefixWithinBudget(
      remaining,
      meta,
      input.countTokens,
      target,
    );
    let cut = preferCut(remaining, rawPrefix.length || remaining.length, boundaries);
    if (cut <= 0) cut = rawPrefix.length || Math.min(remaining.length, 1);
    let primary = fixLoneSurrogates(sliceUtf16Safe(remaining, cut).trim());
    if (!primary) {
      primary = fixLoneSurrogates(sliceUtf16Safe(remaining, Math.min(remaining.length, 16)).trim());
      if (!primary) break;
      cut = primary.length;
    }

    let primaryTokens = await passageTokens(input.countTokens, meta, primary);
    if (primaryTokens > target) {
      const safe = await longestPrefixWithinBudget(primary, meta, input.countTokens, target);
      primary = safe.prefix;
      primaryTokens = safe.tokenCount;
      cut = Math.min(cut, primary.length);
    }
    if (primaryTokens > hard || !primary) {
      throw new Error(
        `TOKEN_SPLIT_FAILED: unable to fit passage under ${hard} tokens (got ${primaryTokens})`,
      );
    }

    const primaryStart = sourceStart + cursor;
    // Map cut length in remaining to actual primary length after trim.
    const consumed = Math.max(primary.length, cut);
    const primaryEnd = primaryStart + primary.length;

    let overlapText = "";
    let actualOverlapTokens = 0;
    let overlapSourceTextStart: number | null = null;
    let overlapSourceTextEnd: number | null = null;
    let finalContent = primary;
    let finalTokens = primaryTokens;

    if (pieces.length > 0 && configuredOverlap > 0) {
      const prev = pieces[pieces.length - 1]!;
      const selected = await selectOverlapTail({
        previousPrimary: prev.primaryContent,
        previousPrimaryStart: prev.primaryStart,
        previousPrimaryEnd: prev.primaryEnd,
        meta,
        counter: input.countTokens,
        overlapTokens: configuredOverlap,
      });
      if (selected.text) {
        const withOverlap = fixLoneSurrogates(`${selected.text}\n${primary}`.trim());
        const withTokens = await passageTokens(input.countTokens, meta, withOverlap);
        if (withTokens <= target) {
          overlapText = selected.text;
          actualOverlapTokens = selected.actualOverlapTokens;
          overlapSourceTextStart = selected.overlapSourceTextStart;
          overlapSourceTextEnd = selected.overlapSourceTextEnd;
          finalContent = withOverlap;
          finalTokens = withTokens;
        }
        // If overlap would exceed target, drop overlap — never discard primary.
      }
    }

    pieces.push({
      content: finalContent,
      primaryContent: primary,
      tokenCount: finalTokens,
      primaryStart,
      primaryEnd,
      actualOverlapTokens,
      hasOverlap: Boolean(overlapText),
      overlapSourceTextStart,
      overlapSourceTextEnd,
    });

    remaining = remaining.slice(consumed).trimStart();
    cursor += consumed;
    while (
      cursor < content.length &&
      remaining.length > 0 &&
      content[cursor] !== remaining[0] &&
      /\s/.test(content[cursor]!)
    ) {
      cursor += 1;
    }
    if (consumed === 0) break;
  }

  const splitCount = pieces.length;
  return pieces.map((p, index) => ({
    content: p.content,
    primaryContent: p.primaryContent,
    tokenCount: p.tokenCount,
    splitIndex: index,
    splitCount,
    overlapTokens: p.actualOverlapTokens,
    configuredOverlapTokens: configuredOverlap,
    actualOverlapTokens: p.actualOverlapTokens,
    hasOverlap: p.hasOverlap,
    splitSourceId: input.splitSourceId,
    primarySourceTextStart: p.primaryStart,
    primarySourceTextEnd: p.primaryEnd,
    overlapSourceTextStart: p.overlapSourceTextStart,
    overlapSourceTextEnd: p.overlapSourceTextEnd,
    sourceTextStart: p.primaryStart,
    sourceTextEnd: p.primaryEnd,
  }));
}

async function splitOversizedCell(input: {
  cell: string;
  headers: string[];
  rowTemplate: string[];
  columnIndex: number;
  caption: string;
  title: string;
  section?: string | null;
  tags?: string[];
  countTokens: PassageTokenCounter;
  formatTableChunk: (caption: string, headers: string[], rows: string[][]) => string;
  target: number;
  hard: number;
  splitSourceId?: string;
  sourceRowIndex: number;
}): Promise<TokenAwareSplitPiece[]> {
  const meta = { title: input.title, section: input.section, tags: input.tags };
  const cell = fixLoneSurrogates(input.cell);
  const out: TokenAwareSplitPiece[] = [];
  let remaining = cell;
  let guard = 0;

  const tokensForCellSlice = async (slice: string): Promise<{ content: string; tokenCount: number; row: string[] }> => {
    const row = [...input.rowTemplate];
    row[input.columnIndex] = slice;
    while (row.length < input.headers.length) row.push("");
    row.length = Math.max(input.headers.length, 1);
    const content = input.formatTableChunk(input.caption, input.headers, [row]);
    const tokenCount = await passageTokens(input.countTokens, meta, content);
    return { content, tokenCount, row };
  };

  while (remaining.trim().length > 0 && guard < 10_000) {
    guard += 1;
    const full = await tokensForCellSlice(remaining);
    if (full.tokenCount <= input.target) {
      out.push({
        content: full.content,
        primaryContent: remaining,
        tokenCount: full.tokenCount,
        splitIndex: 0,
        splitCount: 1,
        overlapTokens: 0,
        configuredOverlapTokens: 0,
        actualOverlapTokens: 0,
        hasOverlap: false,
        splitSourceId: input.splitSourceId,
        primarySourceTextStart: 0,
        primarySourceTextEnd: remaining.length,
        overlapSourceTextStart: null,
        overlapSourceTextEnd: null,
        sourceTextStart: 0,
        sourceTextEnd: remaining.length,
        tableMeta: {
          sourceRowIndex: input.sourceRowIndex,
          sourceColumnIndex: input.columnIndex,
          tableHeaders: input.headers,
        },
      });
      break;
    }

    // Binary-search the longest cell prefix that fits the full table passage budget.
    let lo = 0;
    let hi = remaining.length;
    let best = "";
    let bestContent = "";
    let bestTokens = 0;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const candidate = sliceUtf16Safe(remaining, mid).trimEnd();
      if (!candidate) {
        lo = mid + 1;
        continue;
      }
      const trial = await tokensForCellSlice(candidate);
      if (trial.tokenCount <= input.target) {
        best = candidate;
        bestContent = trial.content;
        bestTokens = trial.tokenCount;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (!best) {
      // Fall back to a tiny UTF-16-safe slice; must still fit under hard limit.
      const tiny = sliceUtf16Safe(remaining, Math.min(8, remaining.length));
      const trial = await tokensForCellSlice(tiny);
      if (trial.tokenCount > input.hard || !tiny) {
        throw new Error(
          `TOKEN_SPLIT_FAILED: table cell continuation exceeds ${input.hard} tokens (got ${trial.tokenCount})`,
        );
      }
      best = tiny;
      bestContent = trial.content;
      bestTokens = trial.tokenCount;
    }

    out.push({
      content: bestContent,
      primaryContent: best,
      tokenCount: bestTokens,
      splitIndex: 0,
      splitCount: 1,
      overlapTokens: 0,
      configuredOverlapTokens: 0,
      actualOverlapTokens: 0,
      hasOverlap: false,
      splitSourceId: input.splitSourceId,
      primarySourceTextStart: 0,
      primarySourceTextEnd: best.length,
      overlapSourceTextStart: null,
      overlapSourceTextEnd: null,
      sourceTextStart: 0,
      sourceTextEnd: best.length,
      tableMeta: {
        sourceRowIndex: input.sourceRowIndex,
        sourceColumnIndex: input.columnIndex,
        tableHeaders: input.headers,
      },
    });

    remaining = remaining.slice(best.length).trimStart();
    if (best.length === 0) break;
  }

  const splitCount = out.length;
  return out.map((p, index) => ({
    ...p,
    splitIndex: index,
    splitCount,
    tableMeta: {
      ...p.tableMeta,
      rowContinuationIndex: index,
      rowContinuationCount: splitCount,
      cellContinuationIndex: index,
      cellContinuationCount: splitCount,
    },
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
  const headers = input.headers;
  const rows = input.rows.map((r) => {
    const copy = [...r];
    while (copy.length < headers.length) copy.push("");
    return copy.slice(0, Math.max(headers.length, 1));
  });

  if (rows.length === 0) {
    const content = input.formatTableChunk(input.caption, headers, [[]]);
    const tokenCount = await passageTokens(input.countTokens, meta, content);
    return [
      {
        content,
        primaryContent: content,
        tokenCount,
        splitIndex: 0,
        splitCount: 1,
        overlapTokens: 0,
        configuredOverlapTokens: 0,
        actualOverlapTokens: 0,
        hasOverlap: false,
        splitSourceId: input.splitSourceId,
        primarySourceTextStart: 0,
        primarySourceTextEnd: content.length,
        overlapSourceTextStart: null,
        overlapSourceTextEnd: null,
        sourceTextStart: 0,
        sourceTextEnd: content.length,
        tableMeta: { tableHeaders: headers },
      },
    ];
  }

  const flatPieces: TokenAwareSplitPiece[] = [];
  let current: string[][] = [];

  const flush = async () => {
    if (current.length === 0) return;
    const content = input.formatTableChunk(input.caption, headers, current);
    const tokenCount = await passageTokens(input.countTokens, meta, content);
    flatPieces.push({
      content,
      primaryContent: content,
      tokenCount,
      splitIndex: 0,
      splitCount: 1,
      overlapTokens: 0,
      configuredOverlapTokens: 0,
      actualOverlapTokens: 0,
      hasOverlap: false,
      splitSourceId: input.splitSourceId,
      primarySourceTextStart: 0,
      primarySourceTextEnd: content.length,
      overlapSourceTextStart: null,
      overlapSourceTextEnd: null,
      sourceTextStart: 0,
      sourceTextEnd: content.length,
      tableMeta: { tableHeaders: headers },
    });
    current = [];
  };

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    const candidate = [...current, row];
    const content = input.formatTableChunk(input.caption, headers, candidate);
    const tokens = await passageTokens(input.countTokens, meta, content);

    if (tokens <= target) {
      current = candidate;
      continue;
    }

    if (current.length > 0) {
      await flush();
    }

    const singleContent = input.formatTableChunk(input.caption, headers, [row]);
    const singleTokens = await passageTokens(input.countTokens, meta, singleContent);
    if (singleTokens <= target) {
      current = [row];
      continue;
    }

    // Oversized row: split the heaviest cell while preserving column count.
    let heaviestCol = 0;
    let heaviestLen = -1;
    for (let c = 0; c < row.length; c++) {
      if ((row[c] ?? "").length > heaviestLen) {
        heaviestLen = (row[c] ?? "").length;
        heaviestCol = c;
      }
    }
    const continuations = await splitOversizedCell({
      cell: row[heaviestCol] ?? "",
      headers,
      rowTemplate: row,
      columnIndex: heaviestCol,
      caption: input.caption,
      title: input.title,
      section: input.section,
      tags: input.tags,
      countTokens: input.countTokens,
      formatTableChunk: input.formatTableChunk,
      target,
      hard,
      splitSourceId: input.splitSourceId,
      sourceRowIndex: rowIndex,
    });
    for (const piece of continuations) {
      if (piece.tokenCount > target) {
        // Should be rare; still reject > hard above. Soft over-target fails gate later.
      }
      flatPieces.push(piece);
    }
  }
  await flush();

  const splitCount = flatPieces.length;
  return flatPieces.map((p, index) => ({
    ...p,
    splitIndex: index,
    splitCount,
  }));
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

/**
 * Operational completion requires PASS (all <= target).
 * WARNING is not a completable structure state — callers must re-split or FAIL.
 */
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

/**
 * Verify primary (overlap-stripped) pieces reconstruct the source without gaps.
 * Whitespace-only differences at piece boundaries are tolerated.
 */
export function assertPrimaryContentCoverage(input: {
  sourceText: string;
  pieces: Array<{ primaryContent: string; primarySourceTextStart?: number; primarySourceTextEnd?: number }>;
}): { ok: true } | { ok: false; code: "CHUNK_CONTENT_PRESERVATION_FAILED"; message: string } {
  const source = fixLoneSurrogates(input.sourceText);
  if (input.pieces.length === 0) {
    if (!source.trim()) return { ok: true };
    return {
      ok: false,
      code: "CHUNK_CONTENT_PRESERVATION_FAILED",
      message: "no primary pieces for non-empty source",
    };
  }
  const joined = input.pieces.map((p) => p.primaryContent).join("");
  const normSource = source.replace(/\s+/g, " ").trim();
  const normJoined = joined.replace(/\s+/g, " ").trim();
  if (normJoined !== normSource) {
    // Allow join without the whitespace that was trimmed between pieces.
    const compactSource = source.replace(/\s+/g, "");
    const compactJoined = joined.replace(/\s+/g, "");
    if (compactJoined !== compactSource) {
      return {
        ok: false,
        code: "CHUNK_CONTENT_PRESERVATION_FAILED",
        message: "primary content does not reconstruct source",
      };
    }
  }
  for (let i = 1; i < input.pieces.length; i++) {
    const prev = input.pieces[i - 1]!;
    const cur = input.pieces[i]!;
    if (
      typeof prev.primarySourceTextEnd === "number" &&
      typeof cur.primarySourceTextStart === "number" &&
      cur.primarySourceTextStart < prev.primarySourceTextEnd
    ) {
      return {
        ok: false,
        code: "CHUNK_CONTENT_PRESERVATION_FAILED",
        message: "primary source ranges overlap",
      };
    }
  }
  for (const p of input.pieces) {
    if (p.primaryContent !== fixLoneSurrogates(p.primaryContent)) {
      return {
        ok: false,
        code: "CHUNK_CONTENT_PRESERVATION_FAILED",
        message: "surrogate damage in primary content",
      };
    }
  }
  return { ok: true };
}

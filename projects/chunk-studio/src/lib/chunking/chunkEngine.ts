import { createHash } from "node:crypto";
import { attachSectionPath, type BlockWithSection } from "./sectionTree";
import type {
  Block,
  Chunk,
  ChunkConfig,
  ChunkWarning,
  OcrQualitySignal,
} from "./types";
import { DEFAULT_CHUNK_CONFIG as CONFIG_DEFAULT } from "./types";
import {
  extractTags,
  hasConstraintTags,
  normalizeConstraintInfo,
} from "./rules/constraints";
import { ocrWarningsFromQuality } from "./rules/ocrQuality";
import { splitSentences, takeLastSentences } from "./rules/sentenceSplit";
import { getTokenizer } from "./tokenizer";
import { detectChunkType } from "./rules/chunkTypeDetector";
import { isNoiseChunk } from "./rules/noiseFilter";

const PIPELINE_VERSION_FALLBACK = "chunk-v2.0.0";

function toChunkText(block: Block): string {
  if (block.type === "table") {
    return `[TABLE ${block.tableId ?? "t"}]\n${block.text}`;
  }
  if (block.type === "heading") {
    return `## ${block.text}`;
  }
  return block.text;
}

function sectionKey(path: string[]): string {
  return path.join(" > ");
}

function normalizeSearchText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function buildChunkId(input: {
  docId?: string;
  sectionPath: string[];
  startBlockIdx: number;
  endBlockIdx: number;
  normalizedText: string;
  pipelineVersion: string;
}): string {
  const raw = [
    input.docId ?? "doc",
    input.sectionPath.join(">"),
    String(input.startBlockIdx),
    String(input.endBlockIdx),
    input.pipelineVersion,
    input.normalizedText,
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

interface TempChunk {
  textParts: string[];
  sourceBlocks: Block[];
  sectionPath: string[];
  hasTable: boolean;
  hasList: boolean;
  tags: string[];
  pipelineVersion: string;
}

function createTemp(sectionPath: string[], pipelineVersion: string): TempChunk {
  return {
    textParts: [],
    sourceBlocks: [],
    sectionPath,
    hasTable: false,
    hasList: false,
    tags: [],
    pipelineVersion,
  };
}

function finalizeChunk(
  temp: TempChunk,
  config: ChunkConfig,
  options?: { docId?: string; ocrQuality?: OcrQualitySignal }
): Chunk | null {
  const text = temp.textParts.join("\n\n").trim();
  if (!text) return null;
  const tokenizer = getTokenizer();
  const tags = Array.from(new Set(temp.tags));
  const sourceBlockIds = temp.sourceBlocks.map((b) => b.id);
  const indexes = temp.sourceBlocks.map((b) => b.blockIndex);
  const pageValues = temp.sourceBlocks
    .map((b) => b.page)
    .filter((p): p is number => typeof p === "number");
  const bboxList = temp.sourceBlocks
    .map((b) => b.bbox)
    .filter((b): b is NonNullable<Block["bbox"]> => Boolean(b));

  const startBlockIdx = indexes.length ? Math.min(...indexes) : 0;
  const endBlockIdx = indexes.length ? Math.max(...indexes) : 0;
  const tokens = tokenizer.countTokens(text);
  const warnings: ChunkWarning[] = [];
  if (tokens > config.maxTokens) warnings.push("TOO_LONG");
  if (tokens < config.minTokens) warnings.push("TOO_SHORT");
  if (temp.hasList && !text.includes(":")) warnings.push("MISSING_LEAD");
  if (/^(page|페이지)\s+\d+/im.test(text)) warnings.push("HEADER_NOISE");
  warnings.push(...(ocrWarningsFromQuality(options?.ocrQuality ?? {}) as ChunkWarning[]));
  const normalized = normalizeConstraintInfo(text);
  const searchText = normalizeSearchText(text);
  const chunkId = buildChunkId({
    docId: options?.docId,
    sectionPath: temp.sectionPath,
    startBlockIdx,
    endBlockIdx,
    normalizedText: searchText,
    pipelineVersion: temp.pipelineVersion,
  });

  const representativeBlock =
    temp.sourceBlocks.find((block) => block.type === "table") ??
    temp.sourceBlocks.find((block) => block.type === "heading") ??
    temp.sourceBlocks.find((block) => block.type === "list_item") ??
    temp.sourceBlocks[0];
  const semanticType = representativeBlock
    ? detectChunkType(representativeBlock)
    : "paragraph";

  const chunk: Chunk = {
    text,
    meta: {
      chunkId,
      type: semanticType,
      sectionPath: temp.sectionPath,
      sourceBlockIds,
      startBlockIdx,
      endBlockIdx,
      pageRange:
        pageValues.length > 0
          ? [Math.min(...pageValues), Math.max(...pageValues)]
          : undefined,
      bboxList: bboxList.length > 0 ? bboxList : undefined,
      quality: {
        tokens: tokenizer.countTokens(text),
        hasConstraints: hasConstraintTags(tags),
        hasTable: temp.hasTable,
        hasList: temp.hasList,
        warnings,
      },
      searchText,
      ocrQuality: options?.ocrQuality,
      normalized,
      tags,
      pipelineVersion: temp.pipelineVersion,
    },
  };
  chunk.meta.noise = isNoiseChunk(chunk);
  return chunk;
}

function maybeMergeSmallAdjacentChunks(
  chunks: Chunk[],
  config: ChunkConfig
): Chunk[] {
  if (chunks.length <= 1) return chunks;
  const out: Chunk[] = [];

  for (const chunk of chunks) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push(chunk);
      continue;
    }
    const sameSection =
      sectionKey(prev.meta.sectionPath) === sectionKey(chunk.meta.sectionPath);
    if (!sameSection) {
      out.push(chunk);
      continue;
    }
    const prevTokens = prev.meta.quality.tokens;
    const currTokens = chunk.meta.quality.tokens;
    if (
      (prevTokens < config.minTokens || currTokens < config.minTokens) &&
      prevTokens + currTokens <= config.maxTokens
    ) {
      const mergedText = `${prev.text}\n\n${chunk.text}`.trim();
      const mergedTokens = getTokenizer().countTokens(mergedText);
      prev.text = mergedText;
      prev.meta.sourceBlockIds = [
        ...prev.meta.sourceBlockIds,
        ...chunk.meta.sourceBlockIds,
      ];
      prev.meta.startBlockIdx = Math.min(
        prev.meta.startBlockIdx,
        chunk.meta.startBlockIdx
      );
      prev.meta.endBlockIdx = Math.max(
        prev.meta.endBlockIdx,
        chunk.meta.endBlockIdx
      );
      prev.meta.quality.tokens = mergedTokens;
      prev.meta.quality.hasConstraints =
        prev.meta.quality.hasConstraints || chunk.meta.quality.hasConstraints;
      prev.meta.quality.hasList =
        prev.meta.quality.hasList || chunk.meta.quality.hasList;
      prev.meta.quality.hasTable =
        prev.meta.quality.hasTable || chunk.meta.quality.hasTable;
      prev.meta.quality.warnings = Array.from(
        new Set([...prev.meta.quality.warnings, ...chunk.meta.quality.warnings])
      );
      prev.meta.tags = Array.from(new Set([...prev.meta.tags, ...chunk.meta.tags]));
      prev.meta.noise = Boolean(prev.meta.noise || chunk.meta.noise);
      continue;
    }
    out.push(chunk);
  }
  return out;
}

function applySentenceOverlap(chunks: Chunk[], overlapSentences: number): Chunk[] {
  if (chunks.length <= 1 || overlapSentences <= 0) return chunks;
  const out: Chunk[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const curr = {
      ...chunks[i],
      meta: { ...chunks[i].meta, quality: { ...chunks[i].meta.quality } },
    };
    if (i > 0) {
      const prev = chunks[i - 1];
      const sameSection =
        sectionKey(prev.meta.sectionPath) === sectionKey(curr.meta.sectionPath);
      if (sameSection) {
        const tail = takeLastSentences(prev.text, overlapSentences).trim();
        if (tail) {
          curr.text = `${tail}\n\n${curr.text}`.trim();
          curr.meta.quality.tokens = getTokenizer().countTokens(curr.text);
        }
      }
    }
    out.push(curr);
  }
  return out;
}

function maybeAddListLead(
  items: BlockWithSection[],
  i: number,
  temp: TempChunk
): void {
  const current = items[i];
  if (current.block.type !== "list_item") return;
  const prev = items[i - 1];
  if (!prev) return;
  if (prev.block.type !== "paragraph" && prev.block.type !== "heading") return;
  if (temp.sourceBlocks.some((b) => b.id === prev.block.id)) return;
  if (/[：:]\s*$/.test(prev.block.text) || /요구사항|다음|다음과 같다/.test(prev.block.text)) {
    temp.textParts.push(prev.block.text);
    temp.sourceBlocks.push(prev.block);
  }
}

function pushSentencesWithLimit(
  temp: TempChunk,
  block: Block,
  config: ChunkConfig,
  chunks: Chunk[]
): TempChunk {
  const sentences = splitSentences(toChunkText(block));
  const tokenizer = getTokenizer();

  for (const sentence of sentences) {
    const tags = extractTags(sentence);
    const isConstraint = tags.some((t) => t.startsWith("CONSTRAINT_"));
    const probeText = [...temp.textParts, sentence].join(" ");
    const tokens = tokenizer.countTokens(probeText);
    if (tokens > config.maxTokens && temp.textParts.length > 0 && !isConstraint) {
      const complete = finalizeChunk(temp, config);
      if (complete) chunks.push(complete);
      temp = createTemp(temp.sectionPath, temp.pipelineVersion);
    }
    temp.textParts.push(sentence);
    temp.sourceBlocks.push(block);
    temp.tags.push(...tags);
    if (block.type === "table") temp.hasTable = true;
    if (block.type === "list_item") temp.hasList = true;
  }

  return temp;
}

function splitTableBlock(block: Block, config: ChunkConfig): string[] {
  const table = block.tableStruct;
  if (!table) return [toChunkText(block)];
  const header = table.header?.join(" | ");
  const caption = table.caption ? `[CAPTION] ${table.caption}` : "";
  const fixed = [caption, header ? `[HEADER] ${header}` : ""].filter(Boolean).join("\n");
  const rows: string[] = [];
  let current = fixed;
  for (const row of table.rowsText) {
    const candidate = current ? `${current}\n${row}` : row;
    if (getTokenizer().countTokens(candidate) > config.maxTokens && current) {
      rows.push(current);
      current = [fixed, row].filter(Boolean).join("\n");
    } else {
      current = candidate;
    }
  }
  if (current) rows.push(current);
  return rows;
}

export function buildChunksFromBlocks(
  blocks: Block[],
  config: ChunkConfig = CONFIG_DEFAULT,
  options?: {
    pipelineVersion?: string;
    docId?: string;
    ocrQuality?: OcrQualitySignal;
  }
): Chunk[] {
  const withSection = attachSectionPath(blocks);
  const chunks: Chunk[] = [];
  const pipelineVersion = options?.pipelineVersion ?? PIPELINE_VERSION_FALLBACK;
  let temp = createTemp(withSection[0]?.sectionPath ?? [], pipelineVersion);
  const tokenizer = getTokenizer();

  const flush = () => {
    const chunk = finalizeChunk(temp, config, {
      docId: options?.docId,
      ocrQuality: options?.ocrQuality,
    });
    if (chunk) chunks.push(chunk);
    temp = createTemp(temp.sectionPath, pipelineVersion);
  };

  for (let i = 0; i < withSection.length; i += 1) {
    const item = withSection[i];
    const block = item.block;
    const sectionChanged =
      sectionKey(item.sectionPath) !== sectionKey(temp.sectionPath);
    const hardBoundary = block.type === "heading" || sectionChanged;
    if (hardBoundary && temp.textParts.length > 0) {
      flush();
    }
    if (sectionChanged) {
      temp.sectionPath = item.sectionPath;
    }

    maybeAddListLead(withSection, i, temp);

    if (block.type === "table") {
      const tableFragments = splitTableBlock(block, config);
      for (const fragment of tableFragments) {
        const pseudoBlock: Block = { ...block, text: fragment };
        temp = pushSentencesWithLimit(temp, pseudoBlock, config, chunks);
      }
    } else {
      temp = pushSentencesWithLimit(temp, block, config, chunks);
    }

    if (!config.enableConstraintRules) {
      temp.tags = [];
    }

    const tokenNow = tokenizer.countTokens(temp.textParts.join("\n\n"));
    if (tokenNow >= config.targetTokens && block.type !== "list_item") {
      flush();
      temp.sectionPath = item.sectionPath;
    }
  }
  if (temp.textParts.length > 0) {
    const last = finalizeChunk(temp, config, {
      docId: options?.docId,
      ocrQuality: options?.ocrQuality,
    });
    if (last) chunks.push(last);
  }

  const merged = maybeMergeSmallAdjacentChunks(chunks, config);
  return applySentenceOverlap(merged, config.overlapSentences);
}

export function buildChunksFromText(
  text: string,
  buildBlocks: (text: string) => Block[],
  config: ChunkConfig = CONFIG_DEFAULT
): Chunk[] {
  return buildChunksFromBlocks(buildBlocks(text), config);
}

// keep named export for config type reference
export type { ChunkConfig as ChunkEngineConfig };
export { CONFIG_DEFAULT as ChunkEngineDefaultConfig };


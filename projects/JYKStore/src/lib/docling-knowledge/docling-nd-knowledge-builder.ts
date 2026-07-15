import type { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { splitContentToChunks } from "@/lib/chunk-pipeline-service";
import {
  DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE,
  DOCLING_RETRIEVAL_CHUNK_TYPE,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import {
  bumpExclusionReason,
  evaluateKnowledgeUnitStepStatus,
  planDoclingBodyKnowledgeUnits,
  type ExclusionReasonMap,
} from "@/lib/docling-knowledge/docling-knowledge-unit-plan";
import { prisma } from "@/lib/prisma";
import { fixLoneSurrogates, sliceUtf16Safe } from "@/lib/text-encoding-safe";

const MAX_UNIT_CHARS = 6000;
const MAX_CHUNK_CHARS = 1800;
const MIN_CHUNK_CHARS = 40;
const TABLE_ROWS_PER_CHUNK = 20;

export {
  DOCLING_KU_PASS_THRESHOLDS,
  evaluateKnowledgeUnitStepStatus,
  planDoclingBodyKnowledgeUnits,
} from "@/lib/docling-knowledge/docling-knowledge-unit-plan";

type NdSection = {
  id?: string;
  title?: string | null;
  text?: string | null;
  label?: string | null;
  page?: number | null;
  children?: NdSection[];
};

type NdTableCell = {
  row: number;
  column: number;
  text: string;
  isColumnHeader?: boolean;
};

type NdTable = {
  id?: string;
  caption?: string | null;
  data?: unknown;
};

type NdFigure = {
  id?: string;
  caption?: string | null;
  altText?: string | null;
  page?: number | null;
  pageNumber?: number | null;
  classification?: string | null;
  previewObjectKey?: string | null;
};

export type DoclingKnowledgeBuildResult = {
  unitCount: number;
  chunkCount: number;
  excludedCount: number;
  mergedCount: number;
  shortSectionMergedCount: number;
  shortValidUnitCount: number;
  stepStatus: "PASS" | "WARNING" | "FAIL";
  warnings: string[];
  byType: Record<string, number>;
  indexGenerationId: string;
  coverage: {
    sourceChars: number;
    unitChars: number;
    chunkChars: number;
    excludedChars: number;
    rawBodyChars: number;
    eligibleBodyChars: number;
    unitBodyChars: number;
    normalExcludedBodyChars: number;
    criticalExcludedBodyChars: number;
    rawBodyCoverage: number;
    eligibleBodyCoverage: number;
    /** Alias of eligibleBodyCoverage for backward-compatible UI. */
    bodyCoverage: number;
    tableCoverage: number;
    figureCoverage: number;
    provenanceMissing: number;
    exclusionReasons: ExclusionReasonMap;
  };
  sampleUnits: Array<{ title: string; unitType: string; preview: string }>;
  sampleChunks: Array<{ title: string; preview: string; length: number }>;
};

function asSections(value: unknown): NdSection[] {
  return Array.isArray(value) ? (value as NdSection[]) : [];
}

function asTables(value: unknown): NdTable[] {
  return Array.isArray(value) ? (value as NdTable[]) : [];
}

function asFigures(value: unknown): NdFigure[] {
  return Array.isArray(value) ? (value as NdFigure[]) : [];
}

function clampTitle(text: string, max: number): string {
  const t = fixLoneSurrogates(text.replace(/\s+/g, " ").trim());
  if (t.length <= max) return t;
  return `${sliceUtf16Safe(t, max - 1).trimEnd()}…`;
}

export type TextSlice = {
  text: string;
  startOffset: number;
  endOffset: number;
};

/** Split long section text on structural boundaries before size clamp. */
export function splitSectionIntoUnitTexts(
  text: string,
  maxUnitChars = MAX_UNIT_CHARS,
): TextSlice[] {
  const normalized = fixLoneSurrogates(text.replace(/\r\n/g, "\n").trim());
  if (!normalized) return [];
  if (normalized.length <= maxUnitChars) {
    return [{ text: normalized, startOffset: 0, endOffset: normalized.length }];
  }

  const blocks = normalized
    .split(/\n{2,}|(?=^#{1,6}\s)|(?=^[-*•]\s)|(?=^\d+[.)]\s)|(?=^(주의|경고|참고|Note|Warning|Caution)[:：])/gim)
    .map((b) => (typeof b === "string" ? b.trim() : ""))
    .filter(Boolean);

  const units: TextSlice[] = [];
  let current = "";
  let currentStart = 0;
  let searchFrom = 0;

  const flush = () => {
    const t = current.trim();
    if (t) {
      const start = Math.max(0, normalized.indexOf(t, currentStart));
      const end = start + t.length;
      units.push({ text: t, startOffset: start, endOffset: end });
      searchFrom = end;
    }
    current = "";
  };

  for (const block of blocks) {
    const blockStart = normalized.indexOf(block, searchFrom);
    if (block.length > maxUnitChars) {
      flush();
      let remaining = block;
      let localOffset = blockStart >= 0 ? blockStart : searchFrom;
      while (remaining.length > maxUnitChars) {
        const piece = sliceUtf16Safe(remaining, maxUnitChars).trim();
        if (piece) {
          units.push({
            text: piece,
            startOffset: localOffset,
            endOffset: localOffset + piece.length,
          });
          localOffset += piece.length;
        }
        remaining = remaining.slice(piece.length || maxUnitChars).trim();
      }
      if (remaining) {
        current = remaining;
        currentStart = localOffset;
      }
      searchFrom = localOffset + remaining.length;
      continue;
    }
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length > maxUnitChars) {
      flush();
      current = block;
      currentStart = blockStart >= 0 ? blockStart : searchFrom;
    } else {
      if (!current) currentStart = blockStart >= 0 ? blockStart : searchFrom;
      current = candidate;
    }
  }
  flush();
  return units.length > 0
    ? units
    : [
        {
          text: sliceUtf16Safe(normalized, maxUnitChars),
          startOffset: 0,
          endOffset: Math.min(maxUnitChars, normalized.length),
        },
      ];
}

function buildGridFromCells(
  cells: NdTableCell[],
  rowCount: number,
  columnCount: number,
): string[][] {
  const grid: string[][] = [];
  for (let r = 0; r < rowCount; r += 1) {
    grid.push(Array.from({ length: columnCount }, () => ""));
  }
  for (const cell of cells) {
    if (cell.row < 0 || cell.row >= rowCount || cell.column < 0 || cell.column >= columnCount) {
      continue;
    }
    const existing = grid[cell.row]![cell.column]!;
    if (!existing || (cell.text.trim() && !existing.trim())) {
      grid[cell.row]![cell.column] = cell.text.trim();
    }
  }
  return grid;
}

/** Extract full table rows (not previewRows). */
export function extractFullTableRows(data: unknown): {
  headers: string[];
  rows: string[][];
  page: number | null;
  sourceChars: number;
} {
  if (!data || typeof data !== "object") {
    return { headers: [], rows: [], page: null, sourceChars: 0 };
  }
  const record = data as {
    cells?: NdTableCell[];
    rowCount?: number;
    columnCount?: number;
    pageNumber?: number | null;
    page?: number | null;
    previewRows?: string[][];
  };

  const page =
    typeof record.pageNumber === "number"
      ? record.pageNumber
      : typeof record.page === "number"
        ? record.page
        : null;

  if (Array.isArray(record.cells) && record.cells.length > 0) {
    const rowCount =
      typeof record.rowCount === "number" && record.rowCount > 0
        ? record.rowCount
        : Math.max(...record.cells.map((c) => c.row)) + 1;
    const columnCount =
      typeof record.columnCount === "number" && record.columnCount > 0
        ? record.columnCount
        : Math.max(...record.cells.map((c) => c.column)) + 1;
    const grid = buildGridFromCells(record.cells, rowCount, columnCount);
    const headerCells = record.cells.filter((c) => c.isColumnHeader);
    let headers: string[] = [];
    if (headerCells.length > 0) {
      const headerRow = Math.min(...headerCells.map((c) => c.row));
      headers = grid[headerRow] ?? [];
      const body = grid.filter((_, i) => i !== headerRow);
      const sourceChars = grid.flat().join("").length;
      return {
        headers,
        rows: body.filter((r) => r.some((c) => c.trim())),
        page,
        sourceChars,
      };
    }
    if (grid.length === 0) return { headers: [], rows: [], page, sourceChars: 0 };
    headers = grid[0] ?? [];
    const body = grid.slice(1);
    return {
      headers,
      rows: body.filter((r) => r.some((c) => c.trim())),
      page,
      sourceChars: grid.flat().join("").length,
    };
  }

  // Fallback: preview only if no cells (degraded source) — still better than empty.
  const preview = Array.isArray(record.previewRows) ? record.previewRows : [];
  if (preview.length === 0) return { headers: [], rows: [], page, sourceChars: 0 };
  const headers = preview[0] ?? [];
  const rows = preview.slice(1);
  return {
    headers,
    rows,
    page,
    sourceChars: preview.flat().join("").length,
  };
}

function formatTableChunk(caption: string, headers: string[], rows: string[][]): string {
  const headerLine = headers.length > 0 ? headers.join(" | ") : "(헤더 없음)";
  const body = rows.map((r) => r.join(" | ")).join("\n");
  return [`표 캡션: ${caption}`, `컬럼: ${headerLine}`, body].filter(Boolean).join("\n\n");
}

function bump(map: ExclusionReasonMap, key: string, text = "", charCount?: number) {
  bumpExclusionReason(map, key, text, charCount ?? text.length);
}

/**
 * Build Knowledge Units (inactive) and Retrieval Chunks (inactive until activation)
 * for a new index generation. Does not delete prior draft/production generations.
 */
export async function buildKnowledgeFromNormalizedDocument(input: {
  versionId: string;
  normalizedDocumentId: string;
  fingerprint: string | null;
  title: string | null;
  sectionsJson: unknown;
  tablesJson: unknown;
  figuresJson: unknown;
  pipelineRunId: string;
  indexGenerationId?: string;
  sourceDocumentId?: string | null;
}): Promise<DoclingKnowledgeBuildResult> {
  const warnings: string[] = [];
  const byType: Record<string, number> = {};
  const exclusionReasons: ExclusionReasonMap = {};
  let excludedCount = 0;
  let mergedCount = 0;
  let provenanceMissing = 0;

  let sourceTableChars = 0;
  let sourceFigureChars = 0;
  let unitBodyChars = 0;
  let unitTableChars = 0;
  let unitFigureChars = 0;
  let excludedChars = 0;

  const indexGenerationId = input.indexGenerationId ?? randomUUID().replace(/-/g, "").slice(0, 24);
  const fingerprint = input.fingerprint;
  const sourceDocumentId = input.sourceDocumentId ?? null;

  type UnitDraft = {
    title: string;
    content: string;
    section: string | null;
    tags: string[];
    sortOrder: number;
    metadata: Record<string, unknown>;
    unitType: string;
  };

  const unitDrafts: UnitDraft[] = [];

  const bodyPlan = planDoclingBodyKnowledgeUnits(asSections(input.sectionsJson));
  for (const [reason, detail] of Object.entries(bodyPlan.metrics.exclusionReasons)) {
    const cur = exclusionReasons[reason] ?? { count: 0, charCount: 0, sampleTexts: [] };
    cur.count += detail.count;
    cur.charCount += detail.charCount;
    for (const sample of detail.sampleTexts) {
      if (cur.sampleTexts.length >= 3) break;
      cur.sampleTexts.push(sample);
    }
    exclusionReasons[reason] = cur;
  }
  for (const [reason, detail] of Object.entries(bodyPlan.metrics.exclusionReasons)) {
    if (
      reason.startsWith("short_") &&
      (reason.endsWith("_merged") || reason === "short_valid_unit")
    ) {
      continue;
    }
    excludedCount += detail.count;
    excludedChars += detail.charCount;
  }

  for (const planned of bodyPlan.units) {
    const parts = splitSectionIntoUnitTexts(planned.text, MAX_UNIT_CHARS);
    parts.forEach((part, partIndex) => {
      byType[planned.unitType] = (byType[planned.unitType] ?? 0) + 1;
      unitBodyChars += part.text.length;
      const pathLabel = planned.pathLabel;
      unitDrafts.push({
        title: clampTitle(
          parts.length > 1 ? `${planned.title} (${partIndex + 1})` : planned.title,
          120,
        ),
        content: [`경로: ${pathLabel}`, part.text].join("\n\n"),
        section: clampTitle(pathLabel, 200),
        tags: ["docling", planned.unitType],
        sortOrder: unitDrafts.length,
        unitType: planned.unitType,
        metadata: {
          generatedBy: "docling-knowledge-pipeline",
          unitType: planned.unitType,
          path: planned.path,
          page: planned.pageStart,
          pageStart: planned.pageStart,
          pageEnd: planned.pageEnd,
          sourceSectionId: planned.sourceSectionIds[0] ?? null,
          sourceSectionIds: planned.sourceSectionIds,
          sourceTextRanges: planned.sourceTextRanges,
          mergeReason: planned.mergeReason,
          shortValidUnit: planned.shortValidUnit,
          sourcePath: pathLabel,
          fingerprint,
          normalizedDocumentId: input.normalizedDocumentId,
          normalizedDocumentFingerprint: fingerprint,
          pipelineRunId: input.pipelineRunId,
          indexGenerationId,
          indexScope: "DRAFT",
          indexStatus: "BUILDING",
          sourceDocumentId,
          versionId: input.versionId,
          sourceTextStart: part.startOffset,
          sourceTextEnd: part.endOffset,
        },
      });
    });
  }

  for (const table of asTables(input.tablesJson)) {
    const caption = table.caption?.trim() || "표";
    const extracted = extractFullTableRows(table.data);
    sourceTableChars += extracted.sourceChars;
    if (extracted.rows.length === 0 && extracted.headers.every((h) => !h.trim())) {
      excludedCount += 1;
      bump(exclusionReasons, "empty_table", caption);
      continue;
    }
    byType["표 기반 정보"] = (byType["표 기반 정보"] ?? 0) + 1;
    const allRows =
      extracted.rows.length > 0
        ? extracted.rows
        : extracted.headers.length > 0
          ? [extracted.headers]
          : [];
    const headerOnly = extracted.rows.length > 0 ? extracted.headers : [];
    const tableBodyText = formatTableChunk(caption, headerOnly, allRows);
    unitTableChars += tableBodyText.length;

    unitDrafts.push({
      title: clampTitle(caption, 120),
      content: tableBodyText,
      section: "tables",
      tags: ["docling", "표 기반 정보"],
      sortOrder: unitDrafts.length,
      unitType: "표 기반 정보",
      metadata: {
        generatedBy: "docling-knowledge-pipeline",
        unitType: "표 기반 정보",
        tableId: table.id ?? null,
        page: extracted.page,
        pageStart: extracted.page,
        pageEnd: extracted.page,
        fingerprint,
        normalizedDocumentId: input.normalizedDocumentId,
        normalizedDocumentFingerprint: fingerprint,
        pipelineRunId: input.pipelineRunId,
        indexGenerationId,
        indexScope: "DRAFT",
        indexStatus: "BUILDING",
        sourceDocumentId,
        tableHeaders: headerOnly,
        tableRowCount: allRows.length,
      },
    });
  }

  for (const fig of asFigures(input.figuresJson)) {
    const c = (fig.classification ?? "").toUpperCase();
    const caption = fig.caption?.trim() || fig.altText?.trim() || "";
    sourceFigureChars += caption.length;
    if (c === "LOGO" || c === "COVER_IMAGE" || c === "DECORATIVE" || c === "PAGE_RENDER") {
      excludedCount += 1;
      excludedChars += caption.length;
      bump(exclusionReasons, `decorative_figure`, caption || c, caption.length);
      continue;
    }
    if (!caption) {
      excludedCount += 1;
      bump(exclusionReasons, "figure_without_caption", fig.id ?? "figure");
      continue;
    }
    byType["그림 기반 설명"] = (byType["그림 기반 설명"] ?? 0) + 1;
    unitFigureChars += caption.length;
    const page = fig.pageNumber ?? fig.page ?? null;
    unitDrafts.push({
      title: clampTitle(caption, 120),
      content: [
        `그림 설명: ${caption}`,
        page != null ? `페이지: ${page}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      section: "figures",
      tags: ["docling", "그림 기반 설명"],
      sortOrder: unitDrafts.length,
      unitType: "그림 기반 설명",
      metadata: {
        generatedBy: "docling-knowledge-pipeline",
        unitType: "그림 기반 설명",
        figureId: fig.id ?? null,
        classification: fig.classification ?? null,
        page,
        pageStart: page,
        pageEnd: page,
        previewObjectKey: fig.previewObjectKey ?? null,
        fingerprint,
        normalizedDocumentId: input.normalizedDocumentId,
        normalizedDocumentFingerprint: fingerprint,
        pipelineRunId: input.pipelineRunId,
        indexGenerationId,
        indexScope: "DRAFT",
        indexStatus: "BUILDING",
        sourceDocumentId,
      },
    });
  }

  if (unitDrafts.length === 0 && input.title?.trim()) {
    warnings.push("구조에서 지식 단위를 만들지 못해 문서 제목 기반 단위를 추가했습니다.");
    unitDrafts.push({
      title: clampTitle(input.title, 120),
      content: `${input.title}\n\n정규화 문서에서 추출된 기본 지식 단위입니다.`,
      section: "document",
      tags: ["docling", "개념 설명"],
      sortOrder: 0,
      unitType: "개념 설명",
      metadata: {
        generatedBy: "docling-knowledge-pipeline",
        unitType: "개념 설명",
        fingerprint,
        normalizedDocumentId: input.normalizedDocumentId,
        normalizedDocumentFingerprint: fingerprint,
        pipelineRunId: input.pipelineRunId,
        indexGenerationId,
        indexScope: "DRAFT",
        indexStatus: "BUILDING",
        sourceDocumentId,
      },
    });
    byType["개념 설명"] = 1;
  }

  // Create units for this generation only (inactive). Prior generations untouched.
  if (unitDrafts.length > 0) {
    await prisma.knowledgeChunk.createMany({
      data: unitDrafts.map((u) => {
        if (!sourceDocumentId) provenanceMissing += 1;
        return {
          versionId: input.versionId,
          sourceDocumentId,
          chunkType: DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE,
          title: u.title,
          content: u.content,
          section: u.section,
          tags: u.tags,
          sortOrder: u.sortOrder,
          isActive: false,
          metadata: u.metadata as Prisma.InputJsonValue,
        };
      }),
    });
  }

  const units = await prisma.knowledgeChunk.findMany({
    where: {
      versionId: input.versionId,
      chunkType: DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE,
      isActive: false,
    },
    orderBy: { sortOrder: "asc" },
  });

  const generationUnits = units.filter((u) => {
    const meta = u.metadata as Record<string, unknown> | null;
    return meta?.indexGenerationId === indexGenerationId;
  });

  const chunkCreates: Prisma.KnowledgeChunkCreateManyInput[] = [];
  let chunkChars = 0;

  for (const unit of generationUnits) {
    const unitMeta = (unit.metadata as Record<string, unknown> | null) ?? {};
    const unitType = typeof unitMeta.unitType === "string" ? unitMeta.unitType : "";

    if (unitType === "표 기반 정보") {
      const headers = Array.isArray(unitMeta.tableHeaders)
        ? (unitMeta.tableHeaders as string[])
        : [];
      const lines = unit.content.split("\n").filter(Boolean);
      // Re-split table content by row groups with repeated headers.
      const extracted = extractFullTableRows({
        // Rebuild from stored content is weak; prefer metadata row groups in content body.
      });
      void extracted;
      // Parse rows from content after "컬럼:" block
      const colIdx = lines.findIndex((l) => l.startsWith("컬럼:"));
      const bodyLines = colIdx >= 0 ? lines.slice(colIdx + 1).filter((l) => l.includes("|")) : [];
      const rowCells = bodyLines.map((l) => l.split("|").map((c) => c.trim()));
      const headerCells =
        headers.length > 0
          ? headers
          : lines
              .find((l) => l.startsWith("컬럼:"))
              ?.replace(/^컬럼:\s*/, "")
              .split("|")
              .map((c) => c.trim()) ?? [];

      const groups: string[][][] = [];
      for (let i = 0; i < rowCells.length; i += TABLE_ROWS_PER_CHUNK) {
        groups.push(rowCells.slice(i, i + TABLE_ROWS_PER_CHUNK));
      }
      if (groups.length === 0) {
        groups.push([[]]);
      }
      groups.forEach((group, index) => {
        const content = formatTableChunk(unit.title, headerCells, group);
        if (content.trim().length < MIN_CHUNK_CHARS && group.flat().join("").length === 0) {
          excludedCount += 1;
          bump(exclusionReasons, "short_table_chunk", content);
          return;
        }
        chunkChars += content.length;
        if (!unit.sourceDocumentId && !sourceDocumentId) provenanceMissing += 1;
        chunkCreates.push({
          versionId: input.versionId,
          sourceDocumentId: unit.sourceDocumentId ?? sourceDocumentId,
          chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
          title:
            groups.length > 1
              ? clampTitle(`${unit.title} (${index + 1})`, 120)
              : unit.title,
          content,
          section: unit.section,
          tags: unit.tags,
          sortOrder: chunkCreates.length,
          isActive: false,
          metadata: {
            ...unitMeta,
            generatedBy: "docling-knowledge-pipeline",
            knowledgeUnitId: unit.id,
            draftIndex: true,
            indexScope: "DRAFT",
            indexStatus: "BUILDING",
            indexGenerationId,
            pipelineRunId: input.pipelineRunId,
            tableRowOffset: index * TABLE_ROWS_PER_CHUNK,
          } as Prisma.InputJsonValue,
        });
      });
      continue;
    }

    const parts = splitContentToChunks(unit.content, MAX_CHUNK_CHARS);
    if (parts.length > 1) mergedCount += parts.length - 1;
    const unitStart =
      typeof unitMeta.sourceTextStart === "number" ? unitMeta.sourceTextStart : 0;
    let cursor = 0;
    parts.forEach((part, index) => {
      if (part.trim().length < MIN_CHUNK_CHARS) {
        excludedCount += 1;
        excludedChars += part.length;
        bump(exclusionReasons, "short_chunk", part);
        cursor += part.length;
        return;
      }
      chunkChars += part.length;
      if (!unit.sourceDocumentId && !sourceDocumentId) provenanceMissing += 1;
      const startOffset = unitStart + cursor;
      const endOffset = startOffset + part.length;
      cursor += part.length;
      chunkCreates.push({
        versionId: input.versionId,
        sourceDocumentId: unit.sourceDocumentId ?? sourceDocumentId,
        chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
        title:
          parts.length > 1
            ? clampTitle(`${unit.title} (${index + 1})`, 120)
            : unit.title,
        content: part,
        section: unit.section,
        tags: unit.tags,
        sortOrder: chunkCreates.length,
        isActive: false,
        metadata: {
          ...unitMeta,
          generatedBy: "docling-knowledge-pipeline",
          knowledgeUnitId: unit.id,
          draftIndex: true,
          indexScope: "DRAFT",
          indexStatus: "BUILDING",
          indexGenerationId,
          pipelineRunId: input.pipelineRunId,
          sourceTextStart: startOffset,
          sourceTextEnd: endOffset,
        } as Prisma.InputJsonValue,
      });
    });
  }

  if (chunkCreates.length > 0) {
    await prisma.knowledgeChunk.createMany({ data: chunkCreates });
  }

  const sourceBodyChars = bodyPlan.metrics.rawBodyChars;
  const sourceChars = sourceBodyChars + sourceTableChars + sourceFigureChars;
  const unitChars = unitBodyChars + unitTableChars + unitFigureChars;
  // Prefer planned unit body metrics when split did not change char mass materially.
  const plannedUnitBodyChars = bodyPlan.metrics.unitBodyChars;
  const effectiveUnitBodyChars =
    Math.abs(plannedUnitBodyChars - unitBodyChars) <= 2 ? plannedUnitBodyChars : unitBodyChars;
  const eligibleBodyChars = bodyPlan.metrics.eligibleBodyChars;
  const rawBodyCoverage =
    sourceBodyChars > 0 ? Math.min(1, effectiveUnitBodyChars / sourceBodyChars) : 1;
  const eligibleBodyCoverage =
    eligibleBodyChars > 0 ? Math.min(1, effectiveUnitBodyChars / eligibleBodyChars) : 1;
  const tableCoverage =
    sourceTableChars > 0 ? Math.min(1, unitTableChars / sourceTableChars) : 1;
  const figureCoverage =
    sourceFigureChars > 0
      ? Math.min(1, unitFigureChars / Math.max(1, sourceFigureChars))
      : 1;

  const criticalExcludedBodyChars = bodyPlan.metrics.criticalExcludedBodyChars;
  if (!sourceDocumentId && generationUnits.length > 0) {
    provenanceMissing = Math.max(provenanceMissing, generationUnits.length);
    bump(exclusionReasons, "provenance_missing", "sourceDocumentId missing", 0);
  }

  const stepStatus = evaluateKnowledgeUnitStepStatus({
    unitCount: generationUnits.length,
    eligibleBodyCoverage,
    tableCoverage,
    provenanceMissing,
    criticalExcludedChars: criticalExcludedBodyChars,
  });

  return {
    unitCount: generationUnits.length,
    chunkCount: chunkCreates.length,
    excludedCount,
    mergedCount,
    shortSectionMergedCount: bodyPlan.metrics.shortSectionMergedCount,
    shortValidUnitCount: bodyPlan.metrics.shortValidUnitCount,
    stepStatus,
    warnings,
    byType,
    indexGenerationId,
    coverage: {
      sourceChars,
      unitChars,
      chunkChars,
      excludedChars,
      rawBodyChars: sourceBodyChars,
      eligibleBodyChars,
      unitBodyChars: effectiveUnitBodyChars,
      normalExcludedBodyChars: bodyPlan.metrics.normalExcludedBodyChars,
      criticalExcludedBodyChars,
      rawBodyCoverage,
      eligibleBodyCoverage,
      bodyCoverage: eligibleBodyCoverage,
      tableCoverage,
      figureCoverage,
      provenanceMissing,
      exclusionReasons,
    },
    sampleUnits: generationUnits.slice(0, 3).map((u) => ({
      title: u.title,
      unitType: String((u.metadata as Record<string, unknown> | null)?.unitType ?? ""),
      preview: clampTitle(u.content, 160),
    })),
    sampleChunks: chunkCreates.slice(0, 3).map((c) => ({
      title: String(c.title),
      preview: clampTitle(String(c.content), 160),
      length: String(c.content).length,
    })),
  };
}

/** Activate a successful draft generation; retire prior DRAFT generations only (atomic). */
export async function activateDraftIndexGeneration(input: {
  versionId: string;
  indexGenerationId: string;
}): Promise<{ activatedChunkCount: number; retiredDraftCount: number }> {
  return prisma.$transaction(async (tx) => {
    const priorDrafts = await tx.knowledgeChunk.findMany({
      where: {
        versionId: input.versionId,
        chunkType: {
          in: [DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE, DOCLING_RETRIEVAL_CHUNK_TYPE],
        },
        isActive: true,
      },
      select: { id: true, metadata: true, chunkType: true },
    });

    const toRetire = priorDrafts.filter((c) => {
      const meta = c.metadata as Record<string, unknown> | null;
      if (meta?.indexScope === "PRODUCTION") return false;
      if (meta?.indexGenerationId === input.indexGenerationId) return false;
      return (
        meta?.indexScope === "DRAFT" ||
        meta?.draftIndex === true ||
        meta?.generatedBy === "docling-knowledge-pipeline"
      );
    });

    for (const c of toRetire) {
      const meta = { ...((c.metadata as Record<string, unknown> | null) ?? {}) };
      meta.indexStatus = "RETIRED";
      await tx.knowledgeChunk.update({
        where: { id: c.id },
        data: {
          isActive: false,
          metadata: meta as Prisma.InputJsonValue,
        },
      });
    }

    const building = await tx.knowledgeChunk.findMany({
      where: {
        versionId: input.versionId,
        chunkType: {
          in: [DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE, DOCLING_RETRIEVAL_CHUNK_TYPE],
        },
        metadata: {
          path: ["indexGenerationId"],
          equals: input.indexGenerationId,
        },
      },
      select: { id: true, chunkType: true, metadata: true },
    });

    let activatedChunkCount = 0;
    for (const c of building) {
      const meta = { ...((c.metadata as Record<string, unknown> | null) ?? {}) };
      meta.indexStatus = "DRAFT";
      meta.indexScope = "DRAFT";
      meta.draftIndex = true;
      const isRetrieval = c.chunkType === DOCLING_RETRIEVAL_CHUNK_TYPE;
      await tx.knowledgeChunk.update({
        where: { id: c.id },
        data: {
          isActive: isRetrieval,
          metadata: meta as Prisma.InputJsonValue,
        },
      });
      if (isRetrieval) activatedChunkCount += 1;
    }

    return {
      activatedChunkCount,
      retiredDraftCount: toRetire.length,
    };
  });
}

/** Mark a failed building generation without touching other generations. */
export async function failDraftIndexGeneration(input: {
  versionId: string;
  indexGenerationId: string;
}): Promise<void> {
  const rows = await prisma.knowledgeChunk.findMany({
    where: {
      versionId: input.versionId,
      chunkType: {
        in: [DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE, DOCLING_RETRIEVAL_CHUNK_TYPE],
      },
    },
    select: { id: true, metadata: true },
  });
  for (const c of rows) {
    const meta = c.metadata as Record<string, unknown> | null;
    if (meta?.indexGenerationId !== input.indexGenerationId) continue;
    await prisma.knowledgeChunk.update({
      where: { id: c.id },
      data: {
        isActive: false,
        metadata: {
          ...meta,
          indexStatus: "FAILED",
        } as Prisma.InputJsonValue,
      },
    });
  }
}

/** Promote a specific DRAFT generation to PRODUCTION (admin approve). */
export async function promoteDraftIndexToProduction(input: {
  versionId: string;
  pipelineRunId: string;
  indexGenerationId: string;
  fingerprint: string;
  tx?: Prisma.TransactionClient;
}): Promise<number> {
  const db = input.tx ?? prisma;

  const candidates = await db.knowledgeChunk.findMany({
    where: {
      versionId: input.versionId,
      chunkType: {
        in: [DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE, DOCLING_RETRIEVAL_CHUNK_TYPE],
      },
      metadata: {
        path: ["indexGenerationId"],
        equals: input.indexGenerationId,
      },
    },
    select: { id: true, chunkType: true, metadata: true, isActive: true },
  });

  const matching = candidates.filter((c) => {
    const meta = c.metadata as Record<string, unknown> | null;
    if (meta?.pipelineRunId !== input.pipelineRunId) return false;
    if (
      meta?.fingerprint !== input.fingerprint &&
      meta?.normalizedDocumentFingerprint !== input.fingerprint
    ) {
      return false;
    }
    if (meta?.indexScope === "PRODUCTION" && meta?.indexStatus === "APPROVED") return false;
    return meta?.indexScope === "DRAFT" || meta?.indexStatus === "DRAFT" || meta?.draftIndex === true;
  });

  if (matching.length === 0) {
    throw new Error("DRAFT_GENERATION_NOT_FOUND");
  }

  const production = await db.knowledgeChunk.findMany({
    where: {
      versionId: input.versionId,
      chunkType: {
        in: [DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE, DOCLING_RETRIEVAL_CHUNK_TYPE],
      },
      isActive: true,
    },
    select: { id: true, metadata: true },
  });

  for (const c of production) {
    const meta = c.metadata as Record<string, unknown> | null;
    if (meta?.indexGenerationId === input.indexGenerationId) continue;
    if (meta?.indexScope !== "PRODUCTION" && meta?.generatedBy !== "docling-knowledge-pipeline") {
      // leave non-docling chunks alone
      if (meta?.indexScope == null && meta?.draftIndex !== true) continue;
    }
    if (meta?.indexScope === "PRODUCTION" || meta?.draftIndex === true || meta?.indexScope === "DRAFT") {
      const next = { ...(meta ?? {}) };
      next.indexStatus = "RETIRED";
      await db.knowledgeChunk.update({
        where: { id: c.id },
        data: {
          isActive: false,
          metadata: next as Prisma.InputJsonValue,
        },
      });
    }
  }

  let n = 0;
  for (const c of matching) {
    const meta = { ...((c.metadata as Record<string, unknown> | null) ?? {}) };
    meta.indexScope = "PRODUCTION";
    meta.indexStatus = "APPROVED";
    meta.draftIndex = false;
    const isRetrieval = c.chunkType === DOCLING_RETRIEVAL_CHUNK_TYPE;
    await db.knowledgeChunk.update({
      where: { id: c.id },
      data: {
        isActive: isRetrieval,
        metadata: meta as Prisma.InputJsonValue,
      },
    });
    if (isRetrieval) n += 1;
  }
  return n;
}

export async function ensureDoclingOriginSourceDocument(input: {
  versionId: string;
  packId: string;
  title: string | null;
  fingerprint: string | null;
}): Promise<string | null> {
  const byLegacy = await prisma.sourceDocument.findFirst({
    where: {
      versionId: input.versionId,
      legacySourceType: "DOCLING_ORIGIN",
    },
    select: { id: true },
  });
  if (byLegacy) return byLegacy.id;

  if (input.fingerprint) {
    const byChecksum = await prisma.sourceDocument.findFirst({
      where: { versionId: input.versionId, checksum: input.fingerprint },
      select: { id: true },
    });
    if (byChecksum) return byChecksum.id;
  }

  const origin = await prisma.knowledgePackFile.findFirst({
    where: {
      versionId: input.versionId,
      role: "SOURCE_ORIGINAL",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, originalFileName: true, checksumSha256: true, mimeType: true },
  });

  const created = await prisma.sourceDocument.create({
    data: {
      versionId: input.versionId,
      title: input.title?.trim() || origin?.originalFileName || "Docling origin",
      sourceType: "ETC",
      legacySourceType: "DOCLING_ORIGIN",
      sourceFormat: "TEXT",
      fileName: origin?.originalFileName ?? null,
      mimeType: origin?.mimeType ?? null,
      checksum: origin?.checksumSha256 ?? input.fingerprint ?? null,
      validationStatus: "PASS",
      validationSummary: "Docling origin linked for knowledge provenance",
    },
    select: { id: true },
  });
  return created.id;
}

/** Stable id helper when randomUUID unavailable in older runtimes — kept for tests. */
export function stableGenerationSeed(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

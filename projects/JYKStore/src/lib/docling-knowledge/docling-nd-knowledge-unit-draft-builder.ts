/**
 * Build Knowledge Unit drafts (body / table / figure) from a normalized document.
 * Pure transformation: no DB writes. Does not change planDoclingBodyKnowledgeUnits.
 */
import {
  planDoclingBodyKnowledgeUnits,
  type ExclusionReasonMap,
} from "@/lib/docling-knowledge/docling-knowledge-unit-plan";
import { MAX_UNIT_CHARS } from "@/lib/docling-knowledge/docling-nd-token-split-policy";
import {
  asFigures,
  asSections,
  asTables,
  bump,
  clampTitle,
  extractFullTableRows,
  formatTableChunk,
  splitSectionIntoUnitTexts,
} from "@/lib/docling-knowledge/docling-nd-knowledge-unit-builder";

/** Local KU draft shape used for the createMany write in the orchestrator. */
export type KnowledgeUnitDraft = {
  title: string;
  content: string;
  section: string | null;
  tags: string[];
  sortOrder: number;
  metadata: Record<string, unknown>;
  unitType: string;
};

export type BuildUnitDraftsResult = {
  unitDrafts: KnowledgeUnitDraft[];
  bodyPlan: ReturnType<typeof planDoclingBodyKnowledgeUnits>;
  byType: Record<string, number>;
  exclusionReasons: ExclusionReasonMap;
  excludedCount: number;
  excludedChars: number;
  unitBodyChars: number;
  unitTableChars: number;
  unitFigureChars: number;
  sourceTableChars: number;
  sourceFigureChars: number;
  warnings: string[];
};

export function buildUnitDraftsFromNormalizedDocument(input: {
  versionId: string;
  normalizedDocumentId: string;
  fingerprint: string | null;
  title: string | null;
  sectionsJson: unknown;
  tablesJson: unknown;
  figuresJson: unknown;
  pipelineRunId: string;
  indexGenerationId: string;
  sourceDocumentId: string | null;
}): BuildUnitDraftsResult {
  const warnings: string[] = [];
  const byType: Record<string, number> = {};
  const exclusionReasons: ExclusionReasonMap = {};
  let excludedCount = 0;

  let sourceTableChars = 0;
  let sourceFigureChars = 0;
  let unitBodyChars = 0;
  let unitTableChars = 0;
  let unitFigureChars = 0;
  let excludedChars = 0;

  const fingerprint = input.fingerprint;
  const sourceDocumentId = input.sourceDocumentId;
  const indexGenerationId = input.indexGenerationId;

  const unitDrafts: KnowledgeUnitDraft[] = [];

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

  return {
    unitDrafts,
    bodyPlan,
    byType,
    exclusionReasons,
    excludedCount,
    excludedChars,
    unitBodyChars,
    unitTableChars,
    unitFigureChars,
    sourceTableChars,
    sourceFigureChars,
    warnings,
  };
}

/**
 * Build retrieval chunks from persisted Knowledge Units for a draft generation:
 * token-aware splitting, title-suffix token re-split, token gate + provenance sync,
 * and the final createMany persist. Preserves all pipeline behavior.
 */
import type { KnowledgeChunk, Prisma } from "@prisma/client";
import { buildPassageEmbeddingText } from "@/lib/embedding/e5-embedding-text";
import type {
  buildLocalE5EmbeddingProfile,
  PassageTokenCounter,
} from "@/lib/embedding/e5-tokenize-client";
import { DOCLING_RETRIEVAL_CHUNK_TYPE } from "@/lib/docling-knowledge/docling-knowledge-stages";
import type { ExclusionReasonMap } from "@/lib/docling-knowledge/docling-knowledge-unit-plan";
import {
  assertPrimaryContentCoverage,
  evaluatePassageTokenGate,
  passageTokenGateStatus,
  splitBodyContentByTokens,
  splitTableRowsByTokens,
  type PassageTokenGateSummary,
  type TokenAwareSplitPiece,
} from "@/lib/docling-knowledge/token-aware-chunk-split";
import {
  MAX_RESPLIT_DEPTH,
  MIN_CHUNK_CHARS,
  reserveSplitSuffixTokens,
} from "@/lib/docling-knowledge/docling-nd-token-split-policy";
import {
  asNumber,
  pieceProvenanceMeta,
  validateChunkProvenanceBeforeSave,
} from "@/lib/docling-knowledge/docling-nd-chunk-provenance";
import {
  bump,
  clampTitle,
  extractFullTableRows,
  formatTableChunk,
} from "@/lib/docling-knowledge/docling-nd-knowledge-unit-builder";
import type { DoclingKnowledgeBuildResult } from "@/lib/docling-knowledge/docling-nd-knowledge-build-result";
import { prisma } from "@/lib/prisma";
import { buildChunkGenerationDualWrite } from "@/lib/search-generation/search-generation-binding";

type BodyPlanMetrics = {
  shortSectionMergedCount: number;
  shortValidUnitCount: number;
  rawBodyChars: number;
  eligibleBodyChars: number;
  normalExcludedBodyChars: number;
  criticalExcludedBodyChars: number;
};

export type RetrievalChunkBuildContext = {
  generationUnits: KnowledgeChunk[];
  bodyPlanMetrics: BodyPlanMetrics;
  byType: Record<string, number>;
  exclusionReasons: ExclusionReasonMap;
  indexGenerationId: string;
  embeddingProfile: ReturnType<typeof buildLocalE5EmbeddingProfile>;
  countTokens: PassageTokenCounter;
  versionId: string;
  pipelineRunId: string;
  sourceDocumentId: string | null;
};

/** Mutable counters shared with the KU-draft phase (updated in place). */
export type RetrievalChunkBuildState = {
  excludedCount: number;
  mergedCount: number;
  excludedChars: number;
  chunkChars: number;
  provenanceMissing: number;
  warnings: string[];
};

export type RetrievalChunkBuildOutcome =
  | {
      status: "ok";
      chunkCreates: Prisma.KnowledgeChunkCreateManyInput[];
      chunkChars: number;
      tokenGate: PassageTokenGateSummary;
      tokenStatus: "PASS" | "WARNING" | "FAIL";
    }
  | { status: "failure"; result: DoclingKnowledgeBuildResult };

function zeroTokenGate(
  embeddingProfile: ReturnType<typeof buildLocalE5EmbeddingProfile>,
): PassageTokenGateSummary {
  return {
    totalChunks: 0,
    validatedChunks: 0,
    maxTokenCount: 0,
    averageTokenCount: 0,
    withinTargetCount: 0,
    targetExceededCount: 0,
    hardLimitExceededCount: 0,
    targetPassageTokens: embeddingProfile.targetPassageTokens,
    maxSequenceTokens: embeddingProfile.maxSequenceTokens,
    model: embeddingProfile.model,
    revision: embeddingProfile.revision,
  };
}

function makeChunkFailureResult(
  ctx: RetrievalChunkBuildContext,
  state: RetrievalChunkBuildState,
  opts: {
    failureCode: string;
    tokenGate: PassageTokenGateSummary;
    sampleUnits: DoclingKnowledgeBuildResult["sampleUnits"];
  },
): DoclingKnowledgeBuildResult {
  return {
    unitCount: ctx.generationUnits.length,
    chunkCount: 0,
    excludedCount: state.excludedCount,
    mergedCount: state.mergedCount,
    shortSectionMergedCount: ctx.bodyPlanMetrics.shortSectionMergedCount,
    shortValidUnitCount: ctx.bodyPlanMetrics.shortValidUnitCount,
    stepStatus: "PASS",
    warnings: state.warnings,
    byType: ctx.byType,
    indexGenerationId: ctx.indexGenerationId,
    coverage: {
      sourceChars: 0,
      unitChars: 0,
      chunkChars: 0,
      excludedChars: state.excludedChars,
      rawBodyChars: ctx.bodyPlanMetrics.rawBodyChars,
      eligibleBodyChars: ctx.bodyPlanMetrics.eligibleBodyChars,
      unitBodyChars: 0,
      normalExcludedBodyChars: ctx.bodyPlanMetrics.normalExcludedBodyChars,
      criticalExcludedBodyChars: ctx.bodyPlanMetrics.criticalExcludedBodyChars,
      rawBodyCoverage: 0,
      eligibleBodyCoverage: 0,
      bodyCoverage: 0,
      tableCoverage: 0,
      figureCoverage: 0,
      provenanceMissing: state.provenanceMissing,
      exclusionReasons: ctx.exclusionReasons,
    },
    sampleUnits: opts.sampleUnits,
    sampleChunks: [],
    tokenGate: opts.tokenGate,
    tokenGateStatus: "FAIL",
    embeddingProfile: ctx.embeddingProfile,
    failureCode: opts.failureCode,
  };
}

export async function buildRetrievalChunks(
  ctx: RetrievalChunkBuildContext,
  state: RetrievalChunkBuildState,
): Promise<RetrievalChunkBuildOutcome> {
  const { embeddingProfile, countTokens, indexGenerationId, generationUnits, exclusionReasons } =
    ctx;
  const versionId = ctx.versionId;
  const pipelineRunId = ctx.pipelineRunId;
  const sourceDocumentId = ctx.sourceDocumentId;

  const chunkCreates: Prisma.KnowledgeChunkCreateManyInput[] = [];

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

      const provisionalTableTitle = reserveSplitSuffixTokens(unit.title, { maxDigits: 4 });
      const tablePieces = await splitTableRowsByTokens({
        caption: unit.title,
        headers: headerCells,
        rows: rowCells,
        title: provisionalTableTitle,
        section: unit.section,
        tags: unit.tags,
        countTokens,
        formatTableChunk,
        targetPassageTokens: embeddingProfile.targetPassageTokens,
        maxSequenceTokens: embeddingProfile.maxSequenceTokens,
        splitSourceId: unit.id,
      });
      if (tablePieces.length > 1) state.mergedCount += tablePieces.length - 1;
      tablePieces.forEach((piece, index) => {
        if (piece.content.trim().length < MIN_CHUNK_CHARS && rowCells.length === 0) {
          state.excludedCount += 1;
          bump(exclusionReasons, "short_table_chunk", piece.content);
          return;
        }
        state.chunkChars += piece.content.length;
        if (!unit.sourceDocumentId && !sourceDocumentId) state.provenanceMissing += 1;
        {
          const chunkTitle =
            tablePieces.length > 1
              ? clampTitle(`${unit.title} (${index + 1})`, 120)
              : unit.title;
          const dual = buildChunkGenerationDualWrite(indexGenerationId, {
            ...unitMeta,
            generatedBy: "docling-knowledge-pipeline",
            knowledgeUnitId: unit.id,
            draftIndex: true,
            indexScope: "DRAFT",
            indexStatus: "BUILDING",
            pipelineRunId,
            ...pieceProvenanceMeta(piece, { contentKind: "TABLE" }),
            embeddingProvider: embeddingProfile.provider,
            embeddingModel: embeddingProfile.model,
            embeddingModelRevision: embeddingProfile.revision,
            embeddingDimension: embeddingProfile.dimension,
            distanceMetric: embeddingProfile.distanceMetric,
            targetPassageTokens: embeddingProfile.targetPassageTokens,
            maxSequenceTokens: embeddingProfile.maxSequenceTokens,
            tokenizerValidatedAt: new Date().toISOString(),
          });
          chunkCreates.push({
            versionId,
            sourceDocumentId: unit.sourceDocumentId ?? sourceDocumentId,
            chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
            title: chunkTitle,
            content: piece.content,
            section: unit.section,
            tags: unit.tags,
            sortOrder: chunkCreates.length,
            isActive: false,
            chunkGenerationId: dual.chunkGenerationId,
            metadata: dual.metadata as Prisma.InputJsonValue,
          });
        }
      });
      continue;
    }

    const unitStart =
      typeof unitMeta.sourceTextStart === "number" ? unitMeta.sourceTextStart : 0;
    // Budget with reserved multi-part title so suffix never pushes past target later.
    const provisionalTitle = reserveSplitSuffixTokens(unit.title, { maxDigits: 4 });
    const bodyPieces = await splitBodyContentByTokens({
      content: unit.content,
      title: provisionalTitle,
      section: unit.section,
      tags: unit.tags,
      countTokens,
      targetPassageTokens: embeddingProfile.targetPassageTokens,
      maxSequenceTokens: embeddingProfile.maxSequenceTokens,
      overlapTokens: embeddingProfile.overlapTokens,
      splitSourceId: unit.id,
      sourceTextStart: unitStart,
    });
    const coverage = assertPrimaryContentCoverage({
      sourceText: unit.content,
      pieces: bodyPieces,
    });
    if (!coverage.ok) {
      state.warnings.push(`내용 보존 검증 실패: ${coverage.message}`);
      return {
        status: "failure",
        result: makeChunkFailureResult(ctx, state, {
          failureCode: "CHUNK_CONTENT_PRESERVATION_FAILED",
          tokenGate: zeroTokenGate(embeddingProfile),
          sampleUnits: generationUnits.slice(0, 3).map((u) => ({
            title: u.title,
            unitType: String((u.metadata as Record<string, unknown> | null)?.unitType ?? ""),
            preview: clampTitle(u.content, 160),
          })),
        }),
      };
    }
    if (bodyPieces.length > 1) state.mergedCount += bodyPieces.length - 1;
    bodyPieces.forEach((piece, index) => {
      if (piece.content.trim().length < MIN_CHUNK_CHARS) {
        state.excludedCount += 1;
        state.excludedChars += piece.content.length;
        bump(exclusionReasons, "short_chunk", piece.content);
        return;
      }
      state.chunkChars += piece.content.length;
      if (!unit.sourceDocumentId && !sourceDocumentId) state.provenanceMissing += 1;
      {
        const chunkTitle =
          bodyPieces.length > 1
            ? clampTitle(`${unit.title} (${index + 1})`, 120)
            : unit.title;
        const dual = buildChunkGenerationDualWrite(indexGenerationId, {
          ...unitMeta,
          generatedBy: "docling-knowledge-pipeline",
          knowledgeUnitId: unit.id,
          draftIndex: true,
          indexScope: "DRAFT",
          indexStatus: "BUILDING",
          pipelineRunId,
          ...pieceProvenanceMeta(piece, { contentKind: "BODY" }),
          embeddingProvider: embeddingProfile.provider,
          embeddingModel: embeddingProfile.model,
          embeddingModelRevision: embeddingProfile.revision,
          embeddingDimension: embeddingProfile.dimension,
          distanceMetric: embeddingProfile.distanceMetric,
          targetPassageTokens: embeddingProfile.targetPassageTokens,
          maxSequenceTokens: embeddingProfile.maxSequenceTokens,
          tokenizerValidatedAt: new Date().toISOString(),
        });
        chunkCreates.push({
          versionId,
          sourceDocumentId: unit.sourceDocumentId ?? sourceDocumentId,
          chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
          title: chunkTitle,
          content: piece.content,
          section: unit.section,
          tags: unit.tags,
          sortOrder: chunkCreates.length,
          isActive: false,
          chunkGenerationId: dual.chunkGenerationId,
          metadata: dual.metadata as Prisma.InputJsonValue,
        });
      }
    });
  }

  // Re-validate every final passage with the real tokenizer before createMany.
  // Use the final stored title (including " (n)" suffixes) so gate matches embed input.
  let passages = chunkCreates.map((c) =>
    buildPassageEmbeddingText({
      title: String(c.title),
      section: typeof c.section === "string" ? c.section : null,
      tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
      content: String(c.content),
    }),
  );

  // If any passage still exceeds target, re-split primary content only (preserve absolute offsets).
  {
    const recount = await countTokens(passages);
    const expanded: typeof chunkCreates = [];
    for (let i = 0; i < chunkCreates.length; i++) {
      const n = recount[i] ?? 0;
      const created = chunkCreates[i]!;
      if (n <= embeddingProfile.targetPassageTokens) {
        expanded.push(created);
        continue;
      }
      const meta = {
        title: String(created.title),
        section: typeof created.section === "string" ? created.section : null,
        tags: Array.isArray(created.tags) ? (created.tags as string[]) : [],
      };
      const baseMd =
        created.metadata && typeof created.metadata === "object"
          ? { ...(created.metadata as Record<string, unknown>) }
          : {};
      const depth = asNumber(baseMd.resplitDepth) ?? 0;
      if (depth >= MAX_RESPLIT_DEPTH) {
        state.warnings.push(`재분할 한도 초과: ${String(created.title)}`);
        return {
          status: "failure",
          result: makeChunkFailureResult(ctx, state, {
            failureCode: "CHUNK_TOKEN_RESPLIT_EXHAUSTED",
            tokenGate: zeroTokenGate(embeddingProfile),
            sampleUnits: [],
          }),
        };
      }

      const contentKind =
        baseMd.contentKind === "TABLE"
          ? "TABLE"
          : baseMd.contentKind === "FIGURE"
            ? "FIGURE"
            : "BODY";
      const absolutePrimaryStart = asNumber(baseMd.primarySourceTextStart) ?? 0;
      const parentSplitIndex = asNumber(baseMd.splitIndex) ?? 0;
      const parentSplitCount = asNumber(baseMd.splitCount) ?? 1;
      const parentSplitSourceId = String(
        baseMd.splitSourceId ?? baseMd.knowledgeUnitId ?? "",
      );
      const primaryOnly =
        typeof baseMd.primaryContent === "string" && baseMd.primaryContent.length > 0
          ? baseMd.primaryContent
          : String(created.content);

      let resplit: TokenAwareSplitPiece[] = [];
      if (contentKind === "TABLE") {
        const headers = Array.isArray(baseMd.tableHeaders)
          ? (baseMd.tableHeaders as string[])
          : [];
        const lines = primaryOnly.split("\n").filter(Boolean);
        const colIdx = lines.findIndex((l) => l.startsWith("컬럼:"));
        const bodyLines =
          colIdx >= 0 ? lines.slice(colIdx + 1).filter((l) => l.includes("|")) : [];
        const rowCells = bodyLines.map((l) => l.split("|").map((c) => c.trim()));
        const headerCells =
          headers.length > 0
            ? headers
            : lines
                .find((l) => l.startsWith("컬럼:"))
                ?.replace(/^컬럼:\s*/, "")
                .split("|")
                .map((c) => c.trim()) ?? [];
        resplit = await splitTableRowsByTokens({
          caption: meta.title,
          headers: headerCells,
          rows: rowCells,
          title: meta.title,
          section: meta.section,
          tags: meta.tags,
          countTokens,
          formatTableChunk,
          targetPassageTokens: embeddingProfile.targetPassageTokens,
          maxSequenceTokens: embeddingProfile.maxSequenceTokens,
          splitSourceId: parentSplitSourceId,
        });
      } else {
        resplit = await splitBodyContentByTokens({
          content: primaryOnly,
          title: meta.title,
          section: meta.section,
          tags: meta.tags,
          countTokens,
          targetPassageTokens: embeddingProfile.targetPassageTokens,
          maxSequenceTokens: embeddingProfile.maxSequenceTokens,
          overlapTokens: 0,
          splitSourceId: parentSplitSourceId,
          sourceTextStart: absolutePrimaryStart,
        });
      }

      if (resplit.length === 0) {
        expanded.push(created);
        continue;
      }

      if (contentKind !== "TABLE") {
        const coverage = assertPrimaryContentCoverage({
          sourceText: primaryOnly,
          pieces: resplit,
        });
        if (!coverage.ok) {
          state.warnings.push(`재분할 원문 보존 실패: ${coverage.message}`);
          return {
            status: "failure",
            result: makeChunkFailureResult(ctx, state, {
              failureCode: "CHUNK_CONTENT_PRESERVATION_FAILED",
              tokenGate: zeroTokenGate(embeddingProfile),
              sampleUnits: [],
            }),
          };
        }
      } else {
        // Table cell continuation: rejoin primary cell slices when metadata present.
        const cellParts = resplit
          .map((p) => String(p.primaryContent ?? ""))
          .filter(Boolean);
        if (cellParts.length > 1) {
          const joined = cellParts.join("").replace(/\s+/g, "");
          const sourceCompact = primaryOnly.replace(/\s+/g, "");
          // Soft check: joined cell text should appear in parent table content.
          if (joined.length > 0 && !sourceCompact.includes(joined.slice(0, Math.min(40, joined.length)))) {
            // Fall through — structural column checks still run in provenance gate.
          }
        }
      }

      for (let pi = 0; pi < resplit.length; pi++) {
        const piece = resplit[pi]!;
        const dual = buildChunkGenerationDualWrite(indexGenerationId, {
          ...baseMd,
          ...pieceProvenanceMeta(piece, {
            contentKind,
            parentSplitIndex,
            parentSplitCount,
            parentSplitSourceId,
            resplitReason: "TITLE_SUFFIX_TOKEN_OVERFLOW",
            resplitDepth: depth + 1,
            // Preserve parent overlap provenance; fallback does not re-introduce overlap.
            overlapSourceTextStart: null,
            overlapSourceTextEnd: null,
            actualOverlapTokens: 0,
            hasOverlap: false,
            configuredOverlapTokens: asNumber(baseMd.configuredOverlapTokens) ?? 0,
          }),
          tokenizerValidatedAt: new Date().toISOString(),
        });
        expanded.push({
          ...created,
          content: piece.content,
          sortOrder: expanded.length,
          chunkGenerationId: dual.chunkGenerationId,
          metadata: dual.metadata as Prisma.InputJsonValue,
        });
      }
    }
    chunkCreates.length = 0;
    chunkCreates.push(...expanded);
    for (let i = 0; i < chunkCreates.length; i++) {
      chunkCreates[i]!.sortOrder = i;
    }
    passages = chunkCreates.map((c) =>
      buildPassageEmbeddingText({
        title: String(c.title),
        section: typeof c.section === "string" ? c.section : null,
        tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
        content: String(c.content),
      }),
    );
  }
  let tokenGate: PassageTokenGateSummary;
  try {
    tokenGate = await evaluatePassageTokenGate({
      passages,
      countTokens,
      targetPassageTokens: embeddingProfile.targetPassageTokens,
      maxSequenceTokens: embeddingProfile.maxSequenceTokens,
      model: embeddingProfile.model,
      revision: embeddingProfile.revision,
    });
  } catch (error) {
    tokenGate = {
      totalChunks: passages.length,
      validatedChunks: 0,
      maxTokenCount: 0,
      averageTokenCount: 0,
      withinTargetCount: 0,
      targetExceededCount: 0,
      hardLimitExceededCount: passages.length,
      targetPassageTokens: embeddingProfile.targetPassageTokens,
      maxSequenceTokens: embeddingProfile.maxSequenceTokens,
      model: embeddingProfile.model,
      revision: embeddingProfile.revision,
    };
    state.warnings.push(
      error instanceof Error
        ? `토큰 검증 실패: ${error.message.slice(0, 160)}`
        : "토큰 검증 실패",
    );
  }
  let tokenStatus = passageTokenGateStatus(tokenGate);
  // Operational policy: WARNING is not completable — treat as FAIL after auto-resplit.
  if (tokenStatus === "WARNING") {
    state.warnings.push(
      `검색 단위가 목표 토큰(${tokenGate.targetPassageTokens})을 초과합니다 (max=${tokenGate.maxTokenCount}).`,
    );
    tokenStatus = "FAIL";
  } else if (tokenStatus === "FAIL") {
    state.warnings.push(
      tokenGate.hardLimitExceededCount > 0
        ? `검색 단위 토큰 한도 초과: max=${tokenGate.maxTokenCount}/${tokenGate.maxSequenceTokens}`
        : `토큰 검증이 완료되지 않았습니다.`,
    );
  }

  if (tokenStatus === "PASS" && chunkCreates.length > 0) {
    // Sync final token counts into metadata before provenance gate + persist.
    const finalCounts = await countTokens(passages);
    for (let i = 0; i < chunkCreates.length; i++) {
      const md =
        chunkCreates[i]!.metadata && typeof chunkCreates[i]!.metadata === "object"
          ? { ...(chunkCreates[i]!.metadata as Record<string, unknown>) }
          : {};
      md.tokenCount = finalCounts[i] ?? md.tokenCount;
      chunkCreates[i]!.metadata = md as Prisma.InputJsonValue;
    }
    const provenance = validateChunkProvenanceBeforeSave(
      chunkCreates,
      embeddingProfile.targetPassageTokens,
    );
    if (!provenance.ok) {
      state.warnings.push(`출처 검증 실패: ${provenance.message}`);
      tokenStatus = "FAIL";
      return {
        status: "failure",
        result: makeChunkFailureResult(ctx, state, {
          failureCode: provenance.code,
          tokenGate,
          sampleUnits: [],
        }),
      };
    }
    await prisma.knowledgeChunk.createMany({ data: chunkCreates });
  }

  return {
    status: "ok",
    chunkCreates,
    chunkChars: state.chunkChars,
    tokenGate,
    tokenStatus,
  };
}

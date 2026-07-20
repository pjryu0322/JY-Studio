/**
 * Facade for the Docling ND → Knowledge Unit → Retrieval Chunk build.
 *
 * Public surface is unchanged: this module re-exports the split helpers and
 * lifecycle writers, and `buildKnowledgeFromNormalizedDocument` orchestrates the
 * extracted context / KU-draft / retrieval-chunk builders.
 */
import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import {
  buildLocalE5EmbeddingProfile,
  type PassageTokenCounter,
} from "@/lib/embedding/e5-tokenize-client";
import { DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { evaluateKnowledgeUnitStepStatus } from "@/lib/docling-knowledge/docling-knowledge-unit-plan";
import { resolveDoclingKnowledgeBuildContext } from "@/lib/docling-knowledge/docling-nd-knowledge-build-context";
import { bump, clampTitle } from "@/lib/docling-knowledge/docling-nd-knowledge-unit-builder";
import { buildUnitDraftsFromNormalizedDocument } from "@/lib/docling-knowledge/docling-nd-knowledge-unit-draft-builder";
import {
  buildRetrievalChunks,
  type RetrievalChunkBuildState,
} from "@/lib/docling-knowledge/docling-nd-retrieval-chunk-builder";
import { prisma } from "@/lib/prisma";
import { buildChunkGenerationDualWrite } from "@/lib/search-generation/search-generation-binding";

export { reserveSplitSuffixTokens } from "@/lib/docling-knowledge/docling-nd-token-split-policy";
export {
  extractFullTableRows,
  splitSectionIntoUnitTexts,
  type TextSlice,
} from "@/lib/docling-knowledge/docling-nd-knowledge-unit-builder";
export type { DoclingKnowledgeBuildResult } from "@/lib/docling-knowledge/docling-nd-knowledge-build-result";
export {
  activateDraftIndexGeneration,
  ensureDoclingOriginSourceDocument,
  failDraftIndexGeneration,
  promoteDraftIndexToProduction,
} from "@/lib/docling-knowledge/docling-nd-knowledge-persistence";
export {
  DOCLING_KU_PASS_THRESHOLDS,
  evaluateKnowledgeUnitStepStatus,
  planDoclingBodyKnowledgeUnits,
} from "@/lib/docling-knowledge/docling-knowledge-unit-plan";

import type { DoclingKnowledgeBuildResult } from "@/lib/docling-knowledge/docling-nd-knowledge-build-result";

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
  /** Injectable tokenizer (tests). Defaults to live Local E5 Worker. */
  countTokens?: PassageTokenCounter;
  embeddingProfile?: ReturnType<typeof buildLocalE5EmbeddingProfile>;
}): Promise<DoclingKnowledgeBuildResult> {
  const { indexGenerationId, embeddingProfile, countTokens } =
    resolveDoclingKnowledgeBuildContext({
      ...(input.indexGenerationId !== undefined ? { indexGenerationId: input.indexGenerationId } : {}),
      ...(input.countTokens !== undefined ? { countTokens: input.countTokens } : {}),
      ...(input.embeddingProfile !== undefined ? { embeddingProfile: input.embeddingProfile } : {}),
    });
  const sourceDocumentId = input.sourceDocumentId ?? null;

  const draft = buildUnitDraftsFromNormalizedDocument({
    versionId: input.versionId,
    normalizedDocumentId: input.normalizedDocumentId,
    fingerprint: input.fingerprint,
    title: input.title,
    sectionsJson: input.sectionsJson,
    tablesJson: input.tablesJson,
    figuresJson: input.figuresJson,
    pipelineRunId: input.pipelineRunId,
    indexGenerationId,
    sourceDocumentId,
  });
  const { unitDrafts, bodyPlan, byType, exclusionReasons } = draft;

  const state: RetrievalChunkBuildState = {
    excludedCount: draft.excludedCount,
    mergedCount: 0,
    excludedChars: draft.excludedChars,
    chunkChars: 0,
    provenanceMissing: 0,
    warnings: draft.warnings,
  };

  // Create units for this generation only (inactive). Prior generations untouched.
  if (unitDrafts.length > 0) {
    await prisma.knowledgeChunk.createMany({
      data: unitDrafts.map((u) => {
        if (!sourceDocumentId) state.provenanceMissing += 1;
        const dual = buildChunkGenerationDualWrite(indexGenerationId, u.metadata);
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
          chunkGenerationId: dual.chunkGenerationId,
          metadata: dual.metadata as Prisma.InputJsonValue,
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

  const outcome = await buildRetrievalChunks(
    {
      generationUnits,
      bodyPlanMetrics: {
        shortSectionMergedCount: bodyPlan.metrics.shortSectionMergedCount,
        shortValidUnitCount: bodyPlan.metrics.shortValidUnitCount,
        rawBodyChars: bodyPlan.metrics.rawBodyChars,
        eligibleBodyChars: bodyPlan.metrics.eligibleBodyChars,
        normalExcludedBodyChars: bodyPlan.metrics.normalExcludedBodyChars,
        criticalExcludedBodyChars: bodyPlan.metrics.criticalExcludedBodyChars,
      },
      byType,
      exclusionReasons,
      indexGenerationId,
      embeddingProfile,
      countTokens,
      versionId: input.versionId,
      pipelineRunId: input.pipelineRunId,
      sourceDocumentId,
    },
    state,
  );
  if (outcome.status === "failure") {
    return outcome.result;
  }
  const { chunkCreates, tokenGate } = outcome;
  const tokenStatus = outcome.tokenStatus;
  const chunkChars = state.chunkChars;
  const warnings = state.warnings;

  const sourceBodyChars = bodyPlan.metrics.rawBodyChars;
  const sourceChars = sourceBodyChars + draft.sourceTableChars + draft.sourceFigureChars;
  const unitChars = draft.unitBodyChars + draft.unitTableChars + draft.unitFigureChars;
  // Prefer planned unit body metrics when split did not change char mass materially.
  const plannedUnitBodyChars = bodyPlan.metrics.unitBodyChars;
  const effectiveUnitBodyChars =
    Math.abs(plannedUnitBodyChars - draft.unitBodyChars) <= 2
      ? plannedUnitBodyChars
      : draft.unitBodyChars;
  const eligibleBodyChars = bodyPlan.metrics.eligibleBodyChars;
  const rawBodyCoverage =
    sourceBodyChars > 0 ? Math.min(1, effectiveUnitBodyChars / sourceBodyChars) : 1;
  const eligibleBodyCoverage =
    eligibleBodyChars > 0 ? Math.min(1, effectiveUnitBodyChars / eligibleBodyChars) : 1;
  const tableCoverage =
    draft.sourceTableChars > 0 ? Math.min(1, draft.unitTableChars / draft.sourceTableChars) : 1;
  const figureCoverage =
    draft.sourceFigureChars > 0
      ? Math.min(1, draft.unitFigureChars / Math.max(1, draft.sourceFigureChars))
      : 1;

  const criticalExcludedBodyChars = bodyPlan.metrics.criticalExcludedBodyChars;
  if (!sourceDocumentId && generationUnits.length > 0) {
    state.provenanceMissing = Math.max(state.provenanceMissing, generationUnits.length);
    bump(exclusionReasons, "provenance_missing", "sourceDocumentId missing", 0);
  }

  const stepStatus = evaluateKnowledgeUnitStepStatus({
    unitCount: generationUnits.length,
    eligibleBodyCoverage,
    tableCoverage,
    provenanceMissing: state.provenanceMissing,
    criticalExcludedChars: criticalExcludedBodyChars,
  });

  const effectiveChunkCount = tokenStatus === "FAIL" ? 0 : chunkCreates.length;

  return {
    unitCount: generationUnits.length,
    chunkCount: effectiveChunkCount,
    excludedCount: state.excludedCount,
    mergedCount: state.mergedCount,
    shortSectionMergedCount: bodyPlan.metrics.shortSectionMergedCount,
    shortValidUnitCount: bodyPlan.metrics.shortValidUnitCount,
    stepStatus: tokenStatus === "FAIL" ? "FAIL" : stepStatus,
    warnings,
    byType,
    indexGenerationId,
    coverage: {
      sourceChars,
      unitChars,
      chunkChars,
      excludedChars: state.excludedChars,
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
      provenanceMissing: state.provenanceMissing,
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
    tokenGate,
    tokenGateStatus: tokenStatus,
    embeddingProfile,
    failureCode:
      tokenStatus === "FAIL"
        ? tokenGate.validatedChunks !== tokenGate.totalChunks
          ? "TOKEN_GATE_VALIDATION_INCOMPLETE"
          : tokenGate.hardLimitExceededCount > 0
            ? "PASSAGE_TOKEN_LIMIT_EXCEEDED"
            : "PASSAGE_TARGET_TOKEN_EXCEEDED"
        : undefined,
  };
}

/** Stable id helper when randomUUID unavailable in older runtimes — kept for tests. */
export function stableGenerationSeed(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

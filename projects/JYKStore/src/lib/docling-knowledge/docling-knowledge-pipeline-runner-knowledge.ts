/**
 * KNOWLEDGE_UNIT (KNOWLEDGE_CHECKING) stage runner.
 */
import type { DoclingPipelineExecutionContext, StageResult } from "@/lib/docling-knowledge/docling-knowledge-pipeline-execution-context";
import {
  failPipelineRun,
  markPipelineStep,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-failure";
import type { StructureStageMaterials } from "@/lib/docling-knowledge/docling-knowledge-pipeline-runner-structure";
import {
  buildKnowledgeFromNormalizedDocument,
  ensureDoclingOriginSourceDocument,
  failDraftIndexGeneration,
} from "@/lib/docling-knowledge/docling-nd-knowledge-builder";
import { serializeKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { finishPipelineRun, updatePackPipelineStatus } from "@/lib/pipeline-service";

export type KnowledgeBuildResult = Awaited<ReturnType<typeof buildKnowledgeFromNormalizedDocument>>;

export async function runKnowledgeUnitStage(
  ctx: DoclingPipelineExecutionContext,
  materials: StructureStageMaterials,
): Promise<StageResult & { built?: KnowledgeBuildResult }> {
  const { packId, runId, lockOwner, versionId, indexGenerationId } = ctx;
  const { nd } = materials;

  if (!(await ctx.heartbeat("지식 단위 생성 중")) || !(await ctx.assertOwned())) {
    await ctx.cancelledExit("취소되어 중단되었습니다.");
    return { ok: false };
  }

  await markPipelineStep({
    packId,
    runId,
    step: "KNOWLEDGE_CHECKING",
    status: "RUNNING",
    message: "지식 단위를 생성하는 중…",
    lockOwner,
  });

  const sourceDocumentId = await ensureDoclingOriginSourceDocument({
    versionId,
    packId,
    title: nd.title,
    fingerprint: nd.fingerprint,
  });

  if (!nd.fingerprint) {
    await markPipelineStep({
      packId,
      runId,
      step: "KNOWLEDGE_CHECKING",
      status: "FAIL",
      message: "정규화 문서 fingerprint가 없어 검색 세대를 만들 수 없습니다.",
      details: { code: "SEARCH_GENERATION_REQUIRED" },
      lockOwner,
    });
    await failPipelineRun({
      packId,
      runId,
      userMessage: "Missing ND fingerprint",
      binding: ctx.binding,
      code: "SEARCH_GENERATION_REQUIRED",
    });
    return { ok: false };
  }

  try {
    const { createSearchGenerationForPipeline } = await import(
      "@/lib/search-generation/search-generation-pipeline-sync"
    );
    await createSearchGenerationForPipeline({
      id: indexGenerationId,
      packId,
      versionId,
      pipelineRunId: runId,
      normalizedDocumentId: nd.id,
      fingerprint: nd.fingerprint,
      chunkGenerationId: indexGenerationId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "search generation create failed";
    await markPipelineStep({
      packId,
      runId,
      step: "KNOWLEDGE_CHECKING",
      status: "FAIL",
      message: "검색 인덱스 세대 생성에 실패했습니다.",
      details: { code: "SEARCH_GENERATION_REQUIRED" },
      lockOwner,
    });
    await failPipelineRun({
      packId,
      runId,
      userMessage: message.slice(0, 500),
      binding: ctx.binding,
      code: "SEARCH_GENERATION_REQUIRED",
    });
    return { ok: false };
  }

  let built: KnowledgeBuildResult;
  try {
    built = await buildKnowledgeFromNormalizedDocument({
      versionId,
      normalizedDocumentId: nd.id,
      fingerprint: nd.fingerprint,
      title: nd.title,
      sectionsJson: nd.sectionsJson,
      tablesJson: nd.tablesJson,
      figuresJson: nd.figuresJson,
      pipelineRunId: runId,
      indexGenerationId,
      sourceDocumentId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "knowledge build failed";
    await markPipelineStep({
      packId,
      runId,
      step: "KNOWLEDGE_CHECKING",
      status: "FAIL",
      message: "지식 단위 생성에 실패했습니다.",
      details: { code: "KNOWLEDGE_GENERATION_FAILED" },
      lockOwner,
    });
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await failPipelineRun({
      packId,
      runId,
      userMessage: message.slice(0, 500),
      binding: ctx.binding,
      code: "KNOWLEDGE_GENERATION_FAILED",
    });
    return { ok: false };
  }

  if (built.unitCount === 0 || built.stepStatus === "FAIL") {
    await markPipelineStep({
      packId,
      runId,
      step: "KNOWLEDGE_CHECKING",
      status: "FAIL",
      message:
        built.unitCount === 0
          ? "지식 단위를 생성하지 못했습니다. 정규화 결과의 본문·표·그림 샘플을 확인한 뒤 다시 처리해 주세요."
          : "지식 단위 Coverage 또는 출처 품질 기준을 충족하지 못했습니다. 제외 사유와 유효 본문 coverage를 확인한 뒤 다시 생성해 주세요.",
      details: {
        unitCount: built.unitCount,
        byType: built.byType,
        excludedCount: built.excludedCount,
        shortSectionMergedCount: built.shortSectionMergedCount,
        shortValidUnitCount: built.shortValidUnitCount,
        warnings: built.warnings,
        coverage: built.coverage,
        sampleUnits: built.sampleUnits,
        stepStatus: built.stepStatus,
      },
      lockOwner,
    });
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await failPipelineRun({
      packId,
      runId,
      userMessage: "Knowledge unit generation failed",
      binding: ctx.binding,
      code: "KNOWLEDGE_COVERAGE_FAILED",
    });
    return { ok: false };
  }

  await markPipelineStep({
    packId,
    runId,
    step: "KNOWLEDGE_CHECKING",
    status: built.stepStatus === "WARNING" ? "WARNING" : "PASS",
    message:
      built.stepStatus === "WARNING"
        ? `지식 단위 ${built.unitCount}개를 생성했지만 유효 본문 coverage가 보완 권장 구간입니다.`
        : `지식 단위 ${built.unitCount}개를 생성했습니다.`,
    details: {
      unitCount: built.unitCount,
      byType: built.byType,
      excludedCount: built.excludedCount,
      shortSectionMergedCount: built.shortSectionMergedCount,
      shortValidUnitCount: built.shortValidUnitCount,
      warnings: built.warnings,
      coverage: built.coverage,
      sampleUnits: built.sampleUnits,
      stepStatus: built.stepStatus,
    },
    lockOwner,
  });

  if (built.stepStatus === "WARNING") {
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await finishPipelineRun({
      runId,
      status: "WARNING",
      summary: serializeKnowledgeRunBinding({
        ...ctx.binding,
        failureCode: "KNOWLEDGE_COVERAGE_WARNING",
        failureMessage: "Knowledge unit coverage below PASS threshold",
        userMessage:
          "지식 단위 품질이 보완 권장 구간입니다. 다시 생성하거나 원문을 확인한 뒤 재검증해 주세요.",
        lockOwner: null,
        lockExpiresAt: null,
      }),
    });
    await updatePackPipelineStatus({
      packId,
      pipelineStatus: "FAILED",
      message: "지식 단위 Coverage 보완이 필요합니다.",
    });
    return { ok: false };
  }

  return { ok: true, built };
}

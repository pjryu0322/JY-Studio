/**
 * RETRIEVAL_CHUNK (CHUNKING) stage + structure-pipeline finalize.
 * Search index / eval / READY belong to the search-data worker (not this pipeline).
 */
import type { DoclingPipelineExecutionContext, StageResult } from "@/lib/docling-knowledge/docling-knowledge-pipeline-execution-context";
import {
  failPipelineRun,
  markPipelineStep,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-failure";
import type { KnowledgeBuildResult } from "@/lib/docling-knowledge/docling-knowledge-pipeline-runner-knowledge";
import { failDraftIndexGeneration } from "@/lib/docling-knowledge/docling-nd-knowledge-builder";
import { serializeKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { DOCLING_RETRIEVAL_CHUNK_TYPE } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { finishPipelineRun, updatePackPipelineStatus } from "@/lib/pipeline-service";
import { prisma } from "@/lib/prisma";

export async function runRetrievalChunkStage(
  ctx: DoclingPipelineExecutionContext,
  built: KnowledgeBuildResult,
): Promise<StageResult> {
  const { packId, runId, lockOwner, versionId, indexGenerationId } = ctx;

  if (!(await ctx.heartbeat("검색 단위 생성 중")) || !(await ctx.assertOwned())) {
    await ctx.cancelledExit("취소되어 중단되었습니다.");
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    return { ok: false };
  }

  await markPipelineStep({
    packId,
    runId,
    step: "CHUNKING",
    status: "RUNNING",
    message: "검색용 Chunk를 생성하는 중…",
    lockOwner,
  });

  if (built.chunkCount === 0) {
    const failCode =
      built.failureCode ??
      (built.tokenGateStatus === "FAIL"
        ? built.tokenGate.hardLimitExceededCount > 0
          ? "PASSAGE_TOKEN_LIMIT_EXCEEDED"
          : "PASSAGE_TARGET_TOKEN_EXCEEDED"
        : "CHUNK_GENERATION_FAILED");
    await markPipelineStep({
      packId,
      runId,
      step: "CHUNKING",
      status: "FAIL",
      message:
        failCode === "CHUNK_CONTENT_PRESERVATION_FAILED"
          ? "검색 단위 생성 과정에서 원문 범위를 완전히 보존하지 못했습니다. 관리자에게 문의 바랍니다."
          : failCode === "PASSAGE_TARGET_TOKEN_EXCEEDED" ||
              failCode === "PASSAGE_TOKEN_LIMIT_EXCEEDED"
            ? "검색 단위가 모델 입력 기준에 맞지 않습니다. 데이터 구조화를 다시 실행해 주세요."
            : "검색용 Chunk를 생성하지 못했습니다. 지식 단위 내용을 확인한 뒤 다시 생성해 주세요.",
      details: {
        chunkCount: 0,
        code: failCode,
        tokenGate: built.tokenGate,
        tokenGateStatus: built.tokenGateStatus,
        embeddingProfile: built.embeddingProfile,
        maxTokenCount: built.tokenGate.maxTokenCount,
        hardLimitExceededCount: built.tokenGate.hardLimitExceededCount,
        targetExceededCount: built.tokenGate.targetExceededCount,
      },
      lockOwner,
    });
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await failPipelineRun({
      packId,
      runId,
      userMessage:
        built.tokenGateStatus === "FAIL" ? "Passage token gate failed" : "Chunk generation failed",
      binding: ctx.binding,
      code: failCode,
    });
    return { ok: false };
  }

  const buildingChunks = await prisma.knowledgeChunk.findMany({
    where: {
      versionId,
      chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
      metadata: { path: ["indexGenerationId"], equals: indexGenerationId },
    },
    select: { content: true, metadata: true },
  });
  const lengths = buildingChunks.map((c) => c.content.length);
  const avg =
    lengths.length > 0
      ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
      : 0;

  if (built.tokenGateStatus !== "PASS") {
    await markPipelineStep({
      packId,
      runId,
      step: "CHUNKING",
      status: "FAIL",
      message: "검색 단위가 모델 입력 기준에 맞지 않습니다. 데이터 구조화를 다시 실행해 주세요.",
      details: {
        chunkCount: built.chunkCount,
        code: built.failureCode ?? "PASSAGE_TARGET_TOKEN_EXCEEDED",
        tokenGate: built.tokenGate,
        tokenGateStatus: built.tokenGateStatus,
        embeddingProfile: built.embeddingProfile,
        maxTokenCount: built.tokenGate.maxTokenCount,
        hardLimitExceededCount: built.tokenGate.hardLimitExceededCount,
        targetExceededCount: built.tokenGate.targetExceededCount,
      },
      lockOwner,
    });
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await failPipelineRun({
      packId,
      runId,
      userMessage: "Passage token gate not PASS",
      binding: ctx.binding,
      code: built.failureCode ?? "PASSAGE_TARGET_TOKEN_EXCEEDED",
    });
    return { ok: false };
  }

  const chunkStepStatus = built.coverage.provenanceMissing > 0 ? "WARNING" : "PASS";
  if (chunkStepStatus !== "PASS") {
    await markPipelineStep({
      packId,
      runId,
      step: "CHUNKING",
      status: "WARNING",
      message: `검색 Chunk ${built.chunkCount}개를 생성했지만 출처 추적이 불완전합니다.`,
      details: {
        chunkCount: built.chunkCount,
        averageLength: avg,
        minLength: lengths.length ? Math.min(...lengths) : 0,
        maxLength: lengths.length ? Math.max(...lengths) : 0,
        coverage: built.coverage,
        tokenGate: built.tokenGate,
        tokenGateStatus: built.tokenGateStatus,
        embeddingProfile: built.embeddingProfile,
      },
      lockOwner,
    });
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await finishPipelineRun({
      runId,
      status: "WARNING",
      summary: serializeKnowledgeRunBinding({
        ...ctx.binding,
        userMessage: `검색 Chunk 출처 보완 필요 (chunks=${built.chunkCount})`,
        lockOwner: null,
        lockExpiresAt: null,
      }),
    });
    await updatePackPipelineStatus({
      packId,
      pipelineStatus: "FAILED",
      message: "Docling structure pipeline warning — provenance incomplete",
    });
    return { ok: false };
  }

  await markPipelineStep({
    packId,
    runId,
    step: "CHUNKING",
    status: "PASS",
    message: `검색 Chunk ${built.chunkCount}개를 생성했습니다. Token Gate 통과.`,
    details: {
      chunkCount: built.chunkCount,
      averageLength: avg,
      minLength: lengths.length ? Math.min(...lengths) : 0,
      maxLength: lengths.length ? Math.max(...lengths) : 0,
      shortCount: lengths.filter((n) => n < 80).length,
      longCount: lengths.filter((n) => n > 3500).length,
      mergedCount: built.mergedCount,
      sampleChunks: built.sampleChunks,
      coverage: built.coverage,
      indexStatus: "BUILDING",
      tokenGate: built.tokenGate,
      tokenGateStatus: built.tokenGateStatus,
      embeddingProfile: built.embeddingProfile,
      maxTokenCount: built.tokenGate.maxTokenCount,
      withinTargetCount: built.tokenGate.withinTargetCount,
      targetExceededCount: built.tokenGate.targetExceededCount,
      hardLimitExceededCount: built.tokenGate.hardLimitExceededCount,
    },
    lockOwner,
  });

  return { ok: true };
}

/** Structure pipeline success: publish chunkCount and await search-data worker. */
export async function finalizeStructurePipelinePass(
  ctx: DoclingPipelineExecutionContext,
  built: KnowledgeBuildResult,
): Promise<void> {
  const { packId, runId, versionId, indexGenerationId } = ctx;

  await prisma.searchIndexGeneration.updateMany({
    where: { id: indexGenerationId, status: { in: ["PENDING", "EMBEDDING"] } },
    data: { chunkCount: built.chunkCount },
  });

  await finishPipelineRun({
    runId,
    status: "PASS",
    summary: serializeKnowledgeRunBinding({
      ...ctx.binding,
      userMessage: `데이터 구조화 완료 · 검색데이터 생성 대기 (units=${built.unitCount}, chunks=${built.chunkCount})`,
      lockOwner: null,
      lockExpiresAt: null,
    }),
  });
  const { markServiceValidationsStaleForVersion } = await import(
    "@/lib/distribution/mark-service-validations-stale"
  );
  await markServiceValidationsStaleForVersion(versionId);
  await updatePackPipelineStatus({
    packId,
    pipelineStatus: "CHUNKING",
    message: "Docling structure pipeline passed — awaiting search data",
  });
}

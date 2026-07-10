import { regenerateAutoChunksForPack } from "@/lib/auto-pipeline/provider-auto-chunk-service";
import { evaluatePackChunkQuality } from "@/lib/chunk-quality/chunk-quality-evaluate-service";
import {
  generateRetrievalEvaluationCasesForPack,
  runRetrievalEvaluationForPack,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-service";
import { evaluatePackStructureQuality } from "@/lib/structure-quality/structure-quality-evaluate-service";

export type QualityPipelineStatus = "PASS" | "WARNING" | "FAIL" | "SKIPPED";

export type ProviderReviewPreparationResult = {
  ok: true;
  generatedChunkCount: number;
  structureQualityStatus: QualityPipelineStatus;
  chunkQualityStatus: QualityPipelineStatus;
  retrievalCaseCount: number;
  retrievalEvaluationStatus: QualityPipelineStatus;
  warnings: string[];
};

function asQualityStatus(status: string | null | undefined): QualityPipelineStatus {
  if (status === "PASS" || status === "WARNING" || status === "FAIL") return status;
  return "FAIL";
}

export async function runProviderReviewPreparationPipeline(input: {
  packId: string;
  actorClientId?: string;
  replaceAutoChunks?: boolean;
  runRetrievalEvaluation?: boolean;
}): Promise<ProviderReviewPreparationResult> {
  const warnings: string[] = [];
  const packId = input.packId.trim();
  const replaceAutoChunks = input.replaceAutoChunks !== false;
  const runRetrievalEvaluation = input.runRetrievalEvaluation !== false;

  let structureQualityStatus: QualityPipelineStatus = "SKIPPED";
  let chunkQualityStatus: QualityPipelineStatus = "SKIPPED";
  let retrievalEvaluationStatus: QualityPipelineStatus = "SKIPPED";
  let generatedChunkCount = 0;
  let retrievalCaseCount = 0;

  const structure = await evaluatePackStructureQuality({
    packId,
    actorClientId: input.actorClientId,
  });

  if ("error" in structure) {
    structureQualityStatus = "FAIL";
    warnings.push(
      structure.error === "NO_VERSION"
        ? "버전이 없어 구조/품질 점검을 실행하지 못했습니다."
        : "구조/품질 점검을 실행하지 못했습니다.",
    );
  } else {
    const coverage = structure.structureCoverage.status;
    const quality = structure.knowledgeQuality.status;
    if (coverage === "FAIL" || quality === "FAIL") {
      structureQualityStatus = "FAIL";
    } else if (coverage === "WARNING" || quality === "WARNING") {
      structureQualityStatus = "WARNING";
    } else {
      structureQualityStatus = "PASS";
    }
  }

  const chunks = await regenerateAutoChunksForPack({
    packId,
    actorClientId: input.actorClientId,
    mode: "hybrid",
    replace: replaceAutoChunks,
  });

  if ("error" in chunks) {
    warnings.push(chunks.message);
  } else {
    generatedChunkCount = chunks.createdChunkCount;
    warnings.push(...chunks.warnings);
  }

  if (structureQualityStatus === "FAIL") {
    warnings.push("구조/품질 점검이 기준에 미달해 청킹·검색 품질 점검을 건너뛰었습니다.");
    return {
      ok: true,
      generatedChunkCount,
      structureQualityStatus,
      chunkQualityStatus: "SKIPPED",
      retrievalCaseCount: 0,
      retrievalEvaluationStatus: "SKIPPED",
      warnings,
    };
  }

  if (!("error" in chunks)) {
    const chunkQuality = await evaluatePackChunkQuality({
      packId,
      actorClientId: input.actorClientId,
    });
    if ("error" in chunkQuality) {
      chunkQualityStatus = "FAIL";
      warnings.push(
        "message" in chunkQuality && typeof chunkQuality.message === "string"
          ? chunkQuality.message
          : "청킹 품질 점검을 실행하지 못했습니다.",
      );
    } else {
      chunkQualityStatus = asQualityStatus(chunkQuality.report.status);
    }
  } else {
    chunkQualityStatus = "FAIL";
  }

  if (chunkQualityStatus === "FAIL") {
    warnings.push("청킹 품질 점검이 기준에 미달해 검색 품질 평가를 건너뛰었습니다.");
    return {
      ok: true,
      generatedChunkCount,
      structureQualityStatus,
      chunkQualityStatus,
      retrievalCaseCount: 0,
      retrievalEvaluationStatus: "SKIPPED",
      warnings,
    };
  }

  const cases = await generateRetrievalEvaluationCasesForPack({
    packId,
    actorClientId: input.actorClientId,
    replace: true,
  });

  if ("error" in cases) {
    warnings.push(
      "message" in cases && typeof cases.message === "string"
        ? cases.message
        : "검색 평가 케이스 생성에 실패했습니다.",
    );
  } else {
    retrievalCaseCount = cases.summary.set?.activeCaseCount ?? 0;
  }

  if (
    runRetrievalEvaluation &&
    retrievalCaseCount > 0 &&
    (chunkQualityStatus === "PASS" || chunkQualityStatus === "WARNING")
  ) {
    const run = await runRetrievalEvaluationForPack({
      packId,
      actorClientId: input.actorClientId,
    });
    if ("error" in run) {
      retrievalEvaluationStatus = "FAIL";
      warnings.push(
        "검색 품질 평가를 자동 실행했지만 완료하지 못했습니다. 점검 탭에서 자동 재점검을 실행해 주세요.",
      );
    } else {
      retrievalEvaluationStatus = asQualityStatus(run.summary.latestRun?.status);
      if (retrievalEvaluationStatus === "FAIL") {
        warnings.push(
          "검색 품질 평가를 자동 실행했지만 일부 케이스가 기준에 미달했습니다. 자동 재점검 후 다시 확인해 주세요.",
        );
      }
    }
  } else if (retrievalCaseCount === 0) {
    retrievalEvaluationStatus = "SKIPPED";
    warnings.push("검색 평가 케이스가 없어 검색 품질 평가를 건너뛰었습니다.");
  } else {
    retrievalEvaluationStatus = "SKIPPED";
  }

  return {
    ok: true,
    generatedChunkCount,
    structureQualityStatus,
    chunkQualityStatus,
    retrievalCaseCount,
    retrievalEvaluationStatus,
    warnings,
  };
}

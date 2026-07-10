import { getAdminReviewDetail } from "@/lib/admin-review-service";
import { evaluatePackChunkQuality } from "@/lib/chunk-quality/chunk-quality-evaluate-service";
import { prisma } from "@/lib/prisma";
import {
  generateRetrievalEvaluationCasesForPack,
  runRetrievalEvaluationForPack,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-service";
import { evaluateReleaseGateForPack } from "@/lib/release-gate/release-gate-service";
import { validateAllSourceDocumentsForPack } from "@/lib/source-validation/source-validation-report-service";
import { evaluatePackStructureQuality } from "@/lib/structure-quality/structure-quality-evaluate-service";

export type AdminReviewRefreshStep =
  | "source_validation"
  | "structure_quality"
  | "chunk_quality"
  | "retrieval_cases"
  | "retrieval_evaluation"
  | "release_gate";

export type AdminReviewRefreshResult = {
  detail: NonNullable<Awaited<ReturnType<typeof getAdminReviewDetail>>>;
  stepsCompleted: AdminReviewRefreshStep[];
  warnings: string[];
  stoppedAt: AdminReviewRefreshStep | null;
};

export async function refreshAdminReviewReadiness(input: {
  packId: string;
  reviewerClientId?: string;
}): Promise<{ error: "NOT_FOUND" } | AdminReviewRefreshResult> {
  const packId = input.packId.trim();
  const pack = await prisma.knowledgePack.findUnique({ where: { packId } });
  if (!pack) {
    return { error: "NOT_FOUND" };
  }

  const stepsCompleted: AdminReviewRefreshStep[] = [];
  const warnings: string[] = [];
  const actorClientId = input.reviewerClientId;

  await validateAllSourceDocumentsForPack(packId, { actorClientId });
  stepsCompleted.push("source_validation");

  let detail = (await getAdminReviewDetail(packId))!;
  if (detail.readiness.sourceValidation.failCount > 0) {
    warnings.push("원천 문서 검증 FAIL로 이후 점검을 건너뛰었습니다.");
    return { detail, stepsCompleted, warnings, stoppedAt: "source_validation" };
  }

  const structure = await evaluatePackStructureQuality({ packId, actorClientId });
  if ("error" in structure) {
    warnings.push(
      structure.error === "NO_VERSION"
        ? "버전이 없어 구조/품질 점검을 실행하지 못했습니다."
        : "구조/품질 점검을 실행하지 못했습니다.",
    );
    detail = (await getAdminReviewDetail(packId))!;
    return { detail, stepsCompleted, warnings, stoppedAt: "structure_quality" };
  }
  stepsCompleted.push("structure_quality");

  detail = (await getAdminReviewDetail(packId))!;
  if (
    detail.readiness.structureCoverageStatus === "FAIL" ||
    detail.readiness.knowledgeQualityStatus === "FAIL"
  ) {
    warnings.push("구조/품질 FAIL로 청킹·검색·릴리스 게이트 점검을 건너뛰었습니다.");
    return { detail, stepsCompleted, warnings, stoppedAt: "structure_quality" };
  }

  const chunk = await evaluatePackChunkQuality({ packId, actorClientId });
  if ("error" in chunk) {
    warnings.push(
      "message" in chunk && typeof chunk.message === "string"
        ? chunk.message
        : "청킹 품질 점검을 실행하지 못했습니다.",
    );
    detail = (await getAdminReviewDetail(packId))!;
    return { detail, stepsCompleted, warnings, stoppedAt: "chunk_quality" };
  }
  stepsCompleted.push("chunk_quality");

  detail = (await getAdminReviewDetail(packId))!;
  if (detail.readiness.chunkQualityStatus === "FAIL") {
    warnings.push("청킹 품질 FAIL로 검색·릴리스 게이트 점검을 건너뛰었습니다.");
    return { detail, stepsCompleted, warnings, stoppedAt: "chunk_quality" };
  }

  const cases = await generateRetrievalEvaluationCasesForPack({
    packId,
    actorClientId,
    replace: true,
  });
  if ("error" in cases) {
    warnings.push(
      "message" in cases && typeof cases.message === "string"
        ? cases.message
        : "검색 평가 케이스 생성에 실패했습니다.",
    );
    detail = (await getAdminReviewDetail(packId))!;
    return { detail, stepsCompleted, warnings, stoppedAt: "retrieval_cases" };
  }
  stepsCompleted.push("retrieval_cases");

  const retrieval = await runRetrievalEvaluationForPack({ packId, actorClientId });
  if ("error" in retrieval) {
    warnings.push(
      "message" in retrieval && typeof retrieval.message === "string"
        ? retrieval.message
        : "검색 품질 평가 실행에 실패했습니다.",
    );
    detail = (await getAdminReviewDetail(packId))!;
    // Still attempt release gate so FAIL is recorded when possible.
  } else {
    stepsCompleted.push("retrieval_evaluation");
  }

  detail = (await getAdminReviewDetail(packId))!;
  if (detail.readiness.retrievalEvaluationStatus === "FAIL") {
    warnings.push("검색 품질 FAIL 상태입니다. 릴리스 게이트를 실행해 최종 차단 여부를 확인합니다.");
  }

  const gate = await evaluateReleaseGateForPack({
    packId,
    actorClientId,
    targetStatus: "PUBLISHED",
    persist: true,
  });
  if ("error" in gate) {
    warnings.push("릴리스 게이트 최종 점검을 실행하지 못했습니다.");
    detail = (await getAdminReviewDetail(packId))!;
    return { detail, stepsCompleted, warnings, stoppedAt: "release_gate" };
  }
  stepsCompleted.push("release_gate");

  detail = (await getAdminReviewDetail(packId))!;
  return { detail, stepsCompleted, warnings, stoppedAt: null };
}

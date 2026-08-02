import { PipelineStatus } from "@prisma/client";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { canApproveAdminReview } from "@/lib/admin-review-decision";
import {
  completePipelineStep,
  createPipelineRun,
  finishPipelineRun,
  logPipelineRecordFailure,
  updatePackPipelineStatus,
} from "@/lib/pipeline-service";
import { getApprovalBlockingSourceValidationMessage } from "@/lib/source-validation-readiness";

export function validateApprovalReadiness(detail: AdminReviewDetailDto): string | null {
  if (canApproveAdminReview(detail)) {
    return null;
  }
  if (detail.pack.status !== "REVIEWING") {
    return "검수 중(REVIEWING) 상태의 지식팩만 승인할 수 있습니다.";
  }
  const sourceBlock = getApprovalBlockingSourceValidationMessage(
    detail.readiness.sourceValidation,
  );
  if (sourceBlock) {
    return sourceBlock;
  }
  if (detail.readiness.structureQualityMessage) {
    return detail.readiness.structureQualityMessage;
  }
  if (detail.readiness.chunkQualityMessage) {
    return detail.readiness.chunkQualityMessage;
  }
  if (detail.readiness.retrievalEvaluationMessage) {
    return detail.readiness.retrievalEvaluationMessage;
  }
  if (detail.readiness.releaseGateMessage) {
    return detail.readiness.releaseGateMessage;
  }
  return "승인에 필요한 버전·원천 문서·설명을 확인해 주세요.";
}

export async function recordApprovalPipeline(packId: string, reviewerClientId?: string) {
  const targetStatus = PipelineStatus.PUBLISHED;
  const triggerType = "ADMIN_APPROVE";
  try {
    const run = await createPipelineRun({
      packId,
      triggerType,
      triggeredByClientId: reviewerClientId,
      steps: [PipelineStatus.APPROVED, PipelineStatus.PUBLISHED],
    });

    if ("runId" in run) {
      await completePipelineStep({
        runId: run.runId,
        step: PipelineStatus.APPROVED,
        status: "PASS",
        message: "관리자 승인 완료",
      });
      await completePipelineStep({
        runId: run.runId,
        step: PipelineStatus.PUBLISHED,
        status: "PASS",
        message: "배포 처리 완료",
      });
      await finishPipelineRun({ runId: run.runId, status: "PASS", summary: "승인 및 배포 완료" });
    } else {
      logPipelineRecordFailure("recordApprovalPipeline", {
        packId,
        triggerType,
        targetStatus,
        error: run.error,
      });
    }

    const statusUpdate = await updatePackPipelineStatus({
      packId,
      pipelineStatus: targetStatus,
      triggeredByClientId: reviewerClientId,
    });
    if ("error" in statusUpdate) {
      logPipelineRecordFailure("recordApprovalPipeline", {
        packId,
        triggerType,
        targetStatus,
        error: "updatePackPipelineStatus NOT_FOUND",
      });
    }
  } catch (error) {
    logPipelineRecordFailure("recordApprovalPipeline", {
      packId,
      triggerType,
      targetStatus,
      error,
    });
  }
}

export async function recordRejectionPipeline(
  packId: string,
  rejectionReason: string,
  reviewerClientId?: string,
) {
  const targetStatus = PipelineStatus.SOURCE_REGISTERING;
  const triggerType = "ADMIN_REJECT";
  try {
    const run = await createPipelineRun({
      packId,
      triggerType,
      triggeredByClientId: reviewerClientId,
      steps: [PipelineStatus.REVIEWING],
    });

    if ("runId" in run) {
      await completePipelineStep({
        runId: run.runId,
        step: PipelineStatus.REVIEWING,
        status: "FAIL",
        message: rejectionReason,
      });
      await finishPipelineRun({ runId: run.runId, status: "FAIL", summary: "검수 반려" });
    } else {
      logPipelineRecordFailure("recordRejectionPipeline", {
        packId,
        triggerType,
        targetStatus,
        error: run.error,
      });
    }

    const statusUpdate = await updatePackPipelineStatus({
      packId,
      pipelineStatus: targetStatus,
      triggeredByClientId: reviewerClientId,
    });
    if ("error" in statusUpdate) {
      logPipelineRecordFailure("recordRejectionPipeline", {
        packId,
        triggerType,
        targetStatus,
        error: "updatePackPipelineStatus NOT_FOUND",
      });
    }
  } catch (error) {
    logPipelineRecordFailure("recordRejectionPipeline", {
      packId,
      triggerType,
      targetStatus,
      error,
    });
  }
}

/**
 * Standard pipeline worker result codes.
 */

export const PIPELINE_RESULT_CODE = {
  APPROVAL_WAITING: "APPROVAL_WAITING",
  MERGED: "MERGED",
  MERGE_PENDING: "MERGE_PENDING",
  REVIEW_REJECTED: "REVIEW_REJECTED",
  REVIEWER_NOT_CONFIGURED: "REVIEWER_NOT_CONFIGURED",
  REVIEW_EXCEPTION: "REVIEW_EXCEPTION",
  SECURITY_FAILED: "SECURITY_FAILED",
  SCM_HOLD: "SCM_HOLD",
  SCM_NOT_CONFIGURED: "SCM_NOT_CONFIGURED",
  PR_CREATE_FAILED: "PR_CREATE_FAILED",
  MERGE_FAILED: "MERGE_FAILED",
  INVALID_PIPELINE_PAYLOAD: "INVALID_PIPELINE_PAYLOAD",
  PROJECT_MISMATCH: "PROJECT_MISMATCH",
  ENV_TEST_REQUIRES_SYNC_LOOP: "ENV_TEST_REQUIRES_SYNC_LOOP",
} as const;

export type PipelineResultCode = (typeof PIPELINE_RESULT_CODE)[keyof typeof PIPELINE_RESULT_CODE];

export function pipelineMessageForCode(code: string | undefined, fallback: string): string {
  switch (code) {
    case PIPELINE_RESULT_CODE.APPROVAL_WAITING:
      return "사용자 승인 대기";
    case PIPELINE_RESULT_CODE.MERGED:
      return "병합 완료";
    case PIPELINE_RESULT_CODE.MERGE_PENDING:
      return "PR/merge 대기";
    case PIPELINE_RESULT_CODE.REVIEW_REJECTED:
      return "검토 반려";
    case PIPELINE_RESULT_CODE.REVIEWER_NOT_CONFIGURED:
      return "AI Reviewer 미설정";
    case PIPELINE_RESULT_CODE.REVIEW_EXCEPTION:
      return "리뷰 단계 오류";
    case PIPELINE_RESULT_CODE.SECURITY_FAILED:
      return "보안 점검 실패";
    case PIPELINE_RESULT_CODE.SCM_HOLD:
      return "SCM 보류";
    case PIPELINE_RESULT_CODE.SCM_NOT_CONFIGURED:
      return "SCM Manager 미설정";
    case PIPELINE_RESULT_CODE.PR_CREATE_FAILED:
      return "PR 생성 실패";
    case PIPELINE_RESULT_CODE.MERGE_FAILED:
      return "Merge 실패";
    default:
      return fallback;
  }
}

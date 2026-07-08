import type { PipelineStatus, PipelineStepStatus } from "@prisma/client";

export type PipelineStatusDto = {
  packId: string;
  pipelineStatus: string;
  pipelineUpdatedAt: string | null;
  sourceSummary: {
    totalCount: number;
    byType: Record<string, number>;
    byFormat: Record<string, number>;
    byValidationStatus: Record<string, number>;
  };
  latestRun: {
    id: string;
    status: string;
    triggerType: string;
    summary: string | null;
    startedAt: string;
    finishedAt: string | null;
  } | null;
  stepLogs: {
    id: string;
    step: string;
    status: string;
    message: string | null;
    startedAt: string | null;
    finishedAt: string | null;
  }[];
};

export const PIPELINE_STATUS_LABELS: Record<PipelineStatus, string> = {
  SOURCE_REGISTERING: "자료 등록",
  SOURCE_VALIDATING: "원문 검증",
  STRUCTURING: "구조화",
  STRUCTURE_VALIDATING: "구조 커버리지 검증",
  KNOWLEDGE_CHECKING: "지식 품질 검수",
  CHUNKING: "청킹",
  CHUNK_EVALUATING: "청킹 품질 평가",
  INDEXING: "검색 데이터 구축",
  SEARCH_EVALUATING: "검색 품질 평가",
  RELEASE_CHECKING: "릴리스 게이트 점검",
  READY_FOR_REVIEW: "검토 준비 완료",
  REVIEWING: "관리자 검토 중",
  APPROVED: "승인됨",
  PUBLISHED: "배포됨",
  FAILED: "실패",
};

export const PIPELINE_STEP_STATUS_LABELS: Record<PipelineStepStatus, string> = {
  PENDING: "대기",
  RUNNING: "진행 중",
  PASS: "통과",
  WARNING: "주의",
  FAIL: "실패",
  SKIPPED: "건너뜀",
};

export function getPipelineStatusLabel(value: string): string {
  return PIPELINE_STATUS_LABELS[value as PipelineStatus] ?? value;
}

export function getPipelineStepStatusLabel(value: string): string {
  return PIPELINE_STEP_STATUS_LABELS[value as PipelineStepStatus] ?? value;
}

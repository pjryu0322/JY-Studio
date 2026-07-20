import type { PipelineStatus } from "@prisma/client";

/**
 * Logical ZIP → Worker → Import stages.
 * Mapped onto existing PipelineStatus values (no Prisma schema change).
 *
 * If product later needs 1:1 enum names (ARCHIVE_STORED, WORKER_RUNNING, …),
 * propose a minimal migration before adding them.
 */
export const WORKER_ZIP_LOGICAL_STAGES = [
  "SUBMITTED",
  "ACCEPTED",
  "ARCHIVE_STORED",
  "WORKER_RUNNING",
  "WORKER_OUTPUT_CREATED",
  "WORKER_OUTPUT_VALIDATED",
  "WORKER_OUTPUT_STORED",
  "IMPORTED",
  "INDEXING",
  "VALIDATING",
  "PROVIDER_CONFIRMING",
  "APPROVED",
  "PUBLISHED",
] as const;

export type WorkerZipLogicalStage = (typeof WORKER_ZIP_LOGICAL_STAGES)[number];

const LOGICAL_TO_PIPELINE: Record<WorkerZipLogicalStage, PipelineStatus> = {
  SUBMITTED: "SOURCE_REGISTERING",
  ACCEPTED: "SOURCE_REGISTERING",
  ARCHIVE_STORED: "SOURCE_VALIDATING",
  WORKER_RUNNING: "STRUCTURING",
  WORKER_OUTPUT_CREATED: "STRUCTURE_VALIDATING",
  WORKER_OUTPUT_VALIDATED: "KNOWLEDGE_CHECKING",
  WORKER_OUTPUT_STORED: "CHUNKING",
  IMPORTED: "CHUNK_EVALUATING",
  INDEXING: "INDEXING",
  VALIDATING: "SEARCH_EVALUATING",
  PROVIDER_CONFIRMING: "READY_FOR_REVIEW",
  APPROVED: "APPROVED",
  PUBLISHED: "PUBLISHED",
};

export function mapWorkerZipStageToPipelineStatus(
  stage: WorkerZipLogicalStage,
): PipelineStatus {
  return LOGICAL_TO_PIPELINE[stage];
}

export function describeWorkerZipStage(stage: WorkerZipLogicalStage): string {
  switch (stage) {
    case "ARCHIVE_STORED":
      return "원본 ZIP이 Object Storage에 저장됨";
    case "WORKER_RUNNING":
      return "Python Worker 실행 중";
    case "WORKER_OUTPUT_CREATED":
      return "Local worker output 생성 완료";
    case "WORKER_OUTPUT_VALIDATED":
      return "Worker output JSON contract 검증 완료";
    case "WORKER_OUTPUT_STORED":
      return "Worker output이 Object Storage에 저장됨";
    case "IMPORTED":
      return "chunks/source_trace가 Store import payload로 반영됨";
    default:
      return stage;
  }
}

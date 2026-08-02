import type { WorkerZipLogicalStage } from "@/lib/python-worker/worker-zip-pipeline-stages";

export class WorkerZipImportServiceError extends Error {
  code: string;
  httpStatus: number;
  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = "WorkerZipImportServiceError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type WorkerZipImportUserError = {
  code: string;
  message: string;
  retryable: boolean;
  supportRequired: boolean;
  stage: WorkerZipLogicalStage;
};

/**
 * Map an internal pipeline/bridge failure code to safe, provider-facing copy.
 * Raw errors/stack traces stay in server logs — never surfaced here.
 */
export function mapWorkerZipFailureCode(code: string): { message: string; supportRequired: boolean } {
  switch (code) {
    case "WORKER_ZIP_FILE_TOO_LARGE":
      return { message: "업로드한 ZIP 파일이 너무 큽니다. 크기를 줄여 다시 업로드하세요.", supportRequired: false };
    case "WORKER_OUTPUT_FILE_TOO_LARGE":
      return { message: "생성된 결과 파일이 허용 크기를 초과했습니다. 자료를 나눠 다시 시도하세요.", supportRequired: false };
    case "WORKER_RUN_TIMEOUT":
      return { message: "데이터 구조화가 시간 내에 끝나지 않았습니다. 잠시 후 다시 시도하세요.", supportRequired: false };
    case "WORKER_RUN_FAILED":
    case "WORKER_OUTPUT_INVALID":
    case "MISSING_REQUIRED_OUTPUT":
    case "VALIDATION_REPORT_NOT_OK":
      return { message: "데이터 구조화 중 문제가 발생했습니다. 자료 구성을 확인하고 다시 실행하세요.", supportRequired: false };
    case "SEARCH_GENERATION_REQUIRED":
    case "SEARCH_GENERATION_MISMATCH":
    case "SEARCH_GENERATION_DESCRIPTOR_MISMATCH":
    case "WORKER_ZIP_EMPTY_EMBEDDINGS":
    case "WORKER_ZIP_INCONSISTENT_EMBEDDINGS":
      return {
        message: "검색데이터 생성을 위한 준비 정보가 없습니다. 다시 시도하거나 관리자에게 문의하세요.",
        supportRequired: true,
      };
    case "GENERATION_READY_DEFERRED":
      return {
        message: "데이터는 생성됐지만 검색데이터 준비가 지연되었습니다. 다시 시도하거나 관리자에게 문의하세요.",
        supportRequired: true,
      };
    case "SEARCH_RUNTIME_UNAVAILABLE":
    case "PAYLOAD_STORAGE_UNAVAILABLE":
      return { message: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.", supportRequired: true };
    default:
      return { message: "데이터 구조화 처리 중 오류가 발생했습니다. 다시 시도하거나 관리자에게 문의하세요.", supportRequired: true };
  }
}

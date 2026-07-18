/**
 * Maps SearchIndexGeneration / embedding failure codes to provider-facing copy.
 * Never expose stack traces, DB text, or worker tokens.
 */

export type SearchDataFailureGuidance = {
  message: string;
  retryable: boolean;
  supportRequired: boolean;
  /** When true, primary recovery is “go to structure” rather than regenerate. */
  preferStructure?: boolean;
};

const ADMIN =
  "검색 모델을 사용할 수 없습니다. 관리자에게 문의 바랍니다.";
const RUNTIME =
  "검색 저장소를 사용할 수 없습니다. 관리자에게 문의 바랍니다.";
const TRANSIENT =
  "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
const RUNNING =
  "검색데이터 생성이 이미 진행 중입니다. 잠시 후 진행 상태를 확인해 주세요.";
const GENERIC =
  "검색데이터 생성에 실패했습니다. 관리자에게 문의 바랍니다.";
const CLEANUP =
  "검색데이터를 초기화하지 못했습니다. 관리자에게 문의 바랍니다.";

const BY_CODE: Record<string, SearchDataFailureGuidance> = {
  SEARCH_RUNTIME_UNAVAILABLE: {
    message: RUNTIME,
    retryable: false,
    supportRequired: true,
  },
  EMBEDDING_PROVIDER_NOT_CONFIGURED: {
    message: ADMIN,
    retryable: false,
    supportRequired: true,
  },
  EMBEDDING_PROVIDER_REQUEST_FAILED: {
    message: ADMIN,
    retryable: false,
    supportRequired: true,
  },
  EMBEDDING_MODEL_REVISION_MISMATCH: {
    message: ADMIN,
    retryable: false,
    supportRequired: true,
  },
  EMBEDDING_CONFIG_INVALID: {
    message: ADMIN,
    retryable: false,
    supportRequired: true,
  },
  EMBEDDING_TOKEN_LIMIT_EXCEEDED: {
    message:
      "일부 검색 단위가 모델 입력 제한을 초과했습니다. 데이터 구조화를 확인해 주세요.",
    retryable: false,
    supportRequired: false,
    preferStructure: true,
  },
  VECTOR_COUNT_MISMATCH: {
    message:
      "일부 검색데이터가 저장되지 않았습니다. 검색데이터를 다시 생성해 주세요.",
    retryable: true,
    supportRequired: false,
  },
  SEARCH_GENERATION_TRANSITION_CONFLICT: {
    message: RUNNING,
    retryable: true,
    supportRequired: false,
  },
  SEARCH_DATA_ALREADY_RUNNING: {
    message: RUNNING,
    retryable: true,
    supportRequired: false,
  },
  TRANSIENT_DB_ERROR: {
    message: TRANSIENT,
    retryable: true,
    supportRequired: false,
  },
  WORKER_TEMPORARILY_UNAVAILABLE: {
    message: TRANSIENT,
    retryable: true,
    supportRequired: false,
  },
  SEARCH_DATA_CLEANUP_FAILED: {
    message: CLEANUP,
    retryable: false,
    supportRequired: true,
  },
  INDEX_BUILD_FAILED: {
    message: GENERIC,
    retryable: false,
    supportRequired: true,
  },
};

export function mapSearchDataFailureCode(
  code: string | null | undefined,
): SearchDataFailureGuidance {
  if (!code) {
    return { message: GENERIC, retryable: false, supportRequired: true };
  }
  return (
    BY_CODE[code] ?? {
      message: GENERIC,
      retryable: false,
      supportRequired: true,
    }
  );
}

export const IMPLEMENTATION_EXECUTION_STALE_MINUTES = 30 as const;
export const EXECUTION_STALE_FAILURE_REASON = "execution_stale" as const;
export const EXECUTION_FORCE_RELEASE_FAILURE_REASON = "admin_force_release" as const;

export const EXECUTION_STALE_USER_MESSAGE =
  "30분 이상 진행이 없어 실행을 만료(STALE) 처리했습니다. [선택한 CodeTask 실행]으로 다시 시도해 주세요." as const;

export const EXECUTION_FORCE_RELEASE_USER_MESSAGE =
  "실행 잠금을 해제했습니다. 환경을 확인한 뒤 [선택한 CodeTask 실행]으로 다시 시도해 주세요." as const;

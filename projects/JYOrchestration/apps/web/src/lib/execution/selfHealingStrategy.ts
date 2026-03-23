export type SelfHealingAction =
  | "RETRY_WITH_REBASE"
  | "REGENERATE_PATCH"
  | "RETRY_EXECUTION"
  | "RETRY_PR"
  | "REQUIRE_AUTH"
  | "RETRY_WITH_DELAY"
  | "MANUAL_REVIEW";

export function getSelfHealingAction(failureType?: string | null): {
  action: SelfHealingAction;
  message: string;
} {
  switch (failureType) {
    case "GIT_CONFLICT":
      return { action: "RETRY_WITH_REBASE", message: "Git 충돌 해결 후 재시도 필요" };
    case "GIT_APPLY_FAILED":
      return { action: "REGENERATE_PATCH", message: "Patch 재생성 후 재적용 필요" };
    case "CURSOR_EXECUTION_FAILED":
      return { action: "RETRY_EXECUTION", message: "Cursor 실행 재시도 필요" };
    case "PR_CREATION_FAILED":
      return { action: "RETRY_PR", message: "PR 생성 재시도 필요" };
    case "AUTH_ERROR":
      return { action: "REQUIRE_AUTH", message: "권한 또는 인증 확인 필요" };
    case "NETWORK_ERROR":
      return { action: "RETRY_WITH_DELAY", message: "네트워크 안정화 후 재시도 필요" };
    default:
      return { action: "MANUAL_REVIEW", message: "수동 점검 필요" };
  }
}


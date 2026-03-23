export type SelfHealingAction =
  | "RETRY_WITH_REBASE"
  | "REGENERATE_PATCH"
  | "RETRY_EXECUTION"
  | "RETRY_PR"
  | "REQUIRE_AUTH"
  | "RETRY_WITH_DELAY"
  | "MANUAL_REVIEW";

export function getSelfHealingStrategies(failureType?: string | null): SelfHealingAction[] {
  switch (failureType) {
    case "CURSOR_EXECUTION_FAILED":
      return ["RETRY_EXECUTION"];
    case "GIT_CONFLICT":
      return ["RETRY_WITH_REBASE"];
    case "GIT_APPLY_FAILED":
      return ["REGENERATE_PATCH", "RETRY_EXECUTION"];
    case "PR_CREATION_FAILED":
      return ["RETRY_PR"];
    case "AUTH_ERROR":
      return ["REQUIRE_AUTH"];
    case "NETWORK_ERROR":
      return ["RETRY_WITH_DELAY", "RETRY_EXECUTION"];
    default:
      return ["MANUAL_REVIEW"];
  }
}

export function getSelfHealingStrategyMessage(strategy: SelfHealingAction): string {
  switch (strategy) {
    case "RETRY_WITH_REBASE":
      return "Git 충돌 해결 후 재시도 필요";
    case "REGENERATE_PATCH":
      return "Patch 재생성 후 재적용 필요";
    case "RETRY_EXECUTION":
      return "Cursor 실행 재시도 필요";
    case "RETRY_PR":
      return "PR 생성 재시도 필요";
    case "REQUIRE_AUTH":
      return "권한 또는 인증 확인 필요";
    case "RETRY_WITH_DELAY":
      return "네트워크 안정화 후 재시도 필요";
    case "MANUAL_REVIEW":
    default:
      return "수동 점검 필요";
  }
}

export function getSelfHealingAction(failureType?: string | null): {
  action: SelfHealingAction;
  message: string;
} {
  // 기존 Phase 5-0/5-1 호환을 위해 단일 action을 제공한다.
  const [first] = getSelfHealingStrategies(failureType);
  return { action: first, message: getSelfHealingStrategyMessage(first) };
}

export function getSelfHealingActionLegacy(failureType?: string | null): {
  action: SelfHealingAction;
  message: string;
} {
  // (deprecated) 기존 매핑을 유지하려면 아래 함수를 사용한다.
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


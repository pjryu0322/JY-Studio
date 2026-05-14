/**
 * Harness Phase H5.5 — **Execution Routing Safety Report 타입**.
 *
 * **read-only / dry-run safety diagnostic only.** 이 타입의 어떤 값도 실제 provider switching,
 * Cursor execution, GitHub operation, execution blocking에 영향을 주지 않는다.
 *
 * 목적: H5의 `ExecutionRoutingPlan`이 "실제 실행"으로 오해되거나 자동 연결되지 않도록,
 * dry-run safety guard와 explainability를 보강한다.
 */

/**
 * Execution Routing의 안전 상태.
 *
 * - `safe_dry_run`: 미리보기 안전. 실제 실행과 연결되지 않음.
 * - `watch`: 관찰 필요. disabled/warning item 또는 hint 기반 미지원 후보가 일부 존재.
 * - `unsafe_to_apply`: 적용 부적합. 실제 적용 시도 시 위험 신호가 강함. **여전히 어떤 자동 차단도 수행하지 않음**(diagnostic 표시만).
 */
export type ExecutionRoutingSafetyStatus = "safe_dry_run" | "watch" | "unsafe_to_apply";

/** Safety finding의 severity(H5 / H4와 동일 어휘). */
export type ExecutionRoutingSafetyFindingSeverity = "info" | "warning";

export type ExecutionRoutingSafetyFinding = Readonly<{
  code: string;
  severity: ExecutionRoutingSafetyFindingSeverity;
  message: string;
}>;

/**
 * Execution Routing Safety Report.
 *
 * **핵심 보장(타입 시스템에서 강제):**
 * - `mode === "dry_run_safety"` 고정 — apply가 아닌 safety diagnostic only.
 * - `providerSwitchingEnabled === false` 고정 — provider lock-in/자동 전환 비활성 명시.
 * - `executionBlockingEnabled === false` 고정 — 실행 차단 비활성 명시.
 * - `automaticExecutionEnabled === false` 고정 — 자동 Cursor execution/GitHub operation 비활성.
 */
export type ExecutionRoutingSafetyReport = Readonly<{
  mode: "dry_run_safety";
  status: ExecutionRoutingSafetyStatus;
  providerSwitchingEnabled: false;
  executionBlockingEnabled: false;
  automaticExecutionEnabled: false;
  unsupportedCapabilityCount: number;
  warningItemCount: number;
  providerHintCount: number;
  totalItems: number;
  findings: readonly ExecutionRoutingSafetyFinding[];
}>;

/** 빈 Safety report(replay/empty fallback). 호출부 shape 안정화. */
export function emptyExecutionRoutingSafetyReport(): ExecutionRoutingSafetyReport {
  return {
    mode: "dry_run_safety",
    status: "safe_dry_run",
    providerSwitchingEnabled: false,
    executionBlockingEnabled: false,
    automaticExecutionEnabled: false,
    unsupportedCapabilityCount: 0,
    warningItemCount: 0,
    providerHintCount: 0,
    totalItems: 0,
    findings: [],
  };
}

/** 노출용: status 우선순위 비교(unsafe > watch > safe). UI 정렬·집계에 사용. */
export function executionRoutingSafetyStatusRank(status: ExecutionRoutingSafetyStatus): number {
  switch (status) {
    case "unsafe_to_apply":
      return 2;
    case "watch":
      return 1;
    default:
      return 0;
  }
}
